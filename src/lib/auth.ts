import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, setPersistence, browserLocalPersistence, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Force local persistence so session survives page reloads and browser restarts
setPersistence(auth, browserLocalPersistence).catch(e => console.warn('setPersistence failed:', e));

const provider = new GoogleAuthProvider();
// Request Workspace scopes for Drive and Sheets
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

export const saveTokenToServer = async (uid: string, token: string) => {
  try {
    await fetch('/api/save-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, token })
    });
  } catch (err) {
    console.error('Failed to save token to server:', err);
  }
};

export const getTokenFromServer = async (uid: string): Promise<string | null> => {
  try {
    const res = await fetch(`/api/get-token?uid=${encodeURIComponent(uid)}`);
    if (res.ok) {
      const data = await res.json();
      return data.token;
    }
  } catch (err) {
    console.error('Failed to get token from server:', err);
  }
  return null;
};

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let tokenObtainedAt: number = parseInt(localStorage.getItem('google_token_obtained_at') || '0', 10);

// Callbacks for notifying App.tsx of token refresh results
let onRefreshSuccess: ((user: User, token: string) => void) | null = null;
let onRefreshFailure: (() => void) | null = null;

const TOKEN_LIFETIME_MS = 55 * 60 * 1000; // 55 minutes (Google tokens last 60min, refresh 5min early)

/**
 * Checks if the cached Google OAuth token is likely still valid based on when it was obtained.
 */
const isTokenLikelyValid = (): boolean => {
  if (!cachedAccessToken || !tokenObtainedAt) return false;
  return (Date.now() - tokenObtainedAt) < TOKEN_LIFETIME_MS;
};

/**
 * Saves the token along with a timestamp of when it was obtained.
 */
const persistToken = (token: string) => {
  cachedAccessToken = token;
  tokenObtainedAt = Date.now();
  localStorage.setItem('google_access_token', token);
  sessionStorage.setItem('google_access_token', token);
  localStorage.setItem('google_token_obtained_at', String(tokenObtainedAt));
};

/**
 * Attempts to recover the Google OAuth token from the server-side store.
 * This is the primary "silent refresh" mechanism — no popups needed.
 */
const tryRecoverTokenFromServer = async (uid: string): Promise<string | null> => {
  try {
    const serverToken = await getTokenFromServer(uid);
    if (serverToken) {
      console.log('[Auth] Recovered token from server store.');
      persistToken(serverToken);
      return serverToken;
    }
  } catch (err) {
    console.error('[Auth] Failed to recover token from server:', err);
  }
  return null;
};

/**
 * Starts a background interval that checks token validity.
 * When expired, it tries server recovery first. Only flags tokenExpired if that also fails.
 * NO popups are opened in the background — ever.
 */
const startRefreshInterval = (user: User) => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  // Check every 10 minutes
  refreshIntervalId = setInterval(async () => {
    if (!isTokenLikelyValid()) {
      console.log('[Auth] Token likely expired, attempting server recovery...');
      const recovered = await tryRecoverTokenFromServer(user.uid);
      if (recovered) {
        if (onRefreshSuccess) onRefreshSuccess(user, recovered);
      } else {
        console.warn('[Auth] Token expired and server recovery failed — user needs to reconnect Google.');
        // Signal token expiration but do NOT log the user out of Firebase
        if (onRefreshFailure) onRefreshFailure();
      }
    }
  }, 10 * 60 * 1000);
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
  onInit?: () => void
) => {
  // Store callbacks for use by the auto-refresh logic
  if (onAuthSuccess) onRefreshSuccess = onAuthSuccess;
  if (onAuthFailure) onRefreshFailure = onAuthFailure;

  // Signal that auth is initialized immediately to prevent UI from hanging
  if (onInit) onInit();

  // Check redirect result first (handles returning from the Google login screen on mobile)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          persistToken(credential.accessToken);
          if (result.user) {
            saveTokenToServer(result.user.uid, credential.accessToken);
            startRefreshInterval(result.user);
          }
          if (onAuthSuccess && result.user) {
            onAuthSuccess(result.user, credential.accessToken);
          }
        }
      }

      if (onInit) onInit();

      // ONLY subscribe to onAuthStateChanged AFTER checking the redirect result
      onAuthStateChanged(auth, async (user: User | null) => {
        if (user) {
          // User is signed into Firebase — check if we have a valid Google OAuth token
          const storedToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');

          if (storedToken && isTokenLikelyValid()) {
            // Token exists and is likely still valid
            cachedAccessToken = storedToken;
            saveTokenToServer(user.uid, storedToken);
            startRefreshInterval(user);
            if (onAuthSuccess) onAuthSuccess(user, storedToken);
          } else if (storedToken) {
            // Token exists but may be expired — try server recovery
            console.log('[Auth] Stored token may be expired, trying server recovery...');
            const recovered = await tryRecoverTokenFromServer(user.uid);
            if (recovered) {
              startRefreshInterval(user);
              if (onAuthSuccess) onAuthSuccess(user, recovered);
            } else {
              // Token expired, but user is still logged in to Firebase
              // Signal that Google API access needs re-auth, but don't fully log out
              console.log('[Auth] Token expired, user stays logged in but needs Google reconnect.');
              cachedAccessToken = storedToken; // Keep old token as fallback for non-Sheets features
              startRefreshInterval(user);
              if (onAuthSuccess) onAuthSuccess(user, storedToken);
            }
          } else {
            // No token at all — try server store
            const serverToken = await tryRecoverTokenFromServer(user.uid);
            if (serverToken) {
              startRefreshInterval(user);
              if (onAuthSuccess) onAuthSuccess(user, serverToken);
            } else {
              // No token anywhere — user needs to sign in with Google
              console.log('[Auth] No Google OAuth token found — user needs to connect Google.');
              if (onAuthFailure) onAuthFailure();
            }
          }
        } else {
          // No Firebase user at all
          const hasToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
          // If we have a token but no user yet, Firebase may still be restoring
          // the session from persistence — don't clear anything, just wait.
          if (hasToken && !auth.currentUser) {
            return;
          }
          cachedAccessToken = null;
          localStorage.removeItem('google_access_token');
          sessionStorage.removeItem('google_access_token');
          localStorage.removeItem('google_token_obtained_at');
          if (refreshIntervalId) {
            clearInterval(refreshIntervalId);
            refreshIntervalId = null;
          }
          if (onAuthFailure) onAuthFailure();
        }
      });
    })
    .catch((error) => {
      console.error('Redirect sign in error:', error);
      if (onInit) onInit();
      onAuthStateChanged(auth, async (user: User | null) => {
        const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
        if (user && currentToken) {
          cachedAccessToken = currentToken;
          startRefreshInterval(user);
          if (onAuthSuccess) onAuthSuccess(user, currentToken);
        } else if (user) {
          // User exists but no token — try server
          const serverToken = await tryRecoverTokenFromServer(user.uid);
          if (serverToken) {
            startRefreshInterval(user);
            if (onAuthSuccess) onAuthSuccess(user, serverToken);
          } else {
            if (onAuthFailure) onAuthFailure();
          }
        } else {
          if (onAuthFailure) onAuthFailure();
        }
      });
    });
};

const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export const googleSignIn = async (method: 'popup' | 'redirect' = 'popup'): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    // On mobile, always prefer redirect to avoid popup blockers
    const effectiveMethod = (method === 'popup' && isMobileDevice()) ? 'redirect' : method;

    if (effectiveMethod === 'redirect') {
      await signInWithRedirect(auth, provider);
      return null;
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    persistToken(credential.accessToken);
    if (result.user) {
      await saveTokenToServer(result.user.uid, credential.accessToken);
      startRefreshInterval(result.user);
    }
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: any) {
    // If popup was blocked on mobile, auto-fallback to redirect
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/popup-closed-by-user') {
      console.log('[Auth] Popup blocked/closed, falling back to redirect...');
      await signInWithRedirect(auth, provider);
      return null;
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearCachedToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  sessionStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_obtained_at');
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  sessionStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_obtained_at');
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
};
