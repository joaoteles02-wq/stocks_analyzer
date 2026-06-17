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
// No custom prompt to keep the existing Google session alive
// Scopes will trigger consent only on first grant

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

// Callbacks for notifying App.tsx of token refresh results
let onRefreshSuccess: ((user: User, token: string) => void) | null = null;
let onRefreshFailure: (() => void) | null = null;

/**
 * Attempts to silently refresh the Google OAuth access token.
 * Works without user interaction when the user is already logged in to Google in the browser.
 * Falls back gracefully if the silent refresh fails (e.g., if cookies are blocked).
 */
export const tryAutoRefreshToken = async (): Promise<string | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser || isSigningIn) return null;

  try {
    isSigningIn = true;
    console.log('[Auth] Attempting silent token refresh...');

    // signInWithPopup causes Google to silently re-issue a token
    // if the user still has an active Google session in the browser
    const silentProvider = new GoogleAuthProvider();
    silentProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
    silentProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');

    const result = await signInWithPopup(auth, silentProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      localStorage.setItem('google_access_token', cachedAccessToken);
      sessionStorage.setItem('google_access_token', cachedAccessToken);
      await saveTokenToServer(currentUser.uid, cachedAccessToken);
      console.log('[Auth] Silent token refresh successful.');
      if (onRefreshSuccess) onRefreshSuccess(result.user, cachedAccessToken);
      return cachedAccessToken;
    }
  } catch (error: any) {
    // popup_closed_by_user or cancelled_popup_request are non-critical
    const errCode = error?.code || '';
    if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
      console.log('[Auth] Silent refresh popup closed — user intervention needed.');
    } else {
      console.warn('[Auth] Silent token refresh failed:', error?.message || error);
    }
  } finally {
    isSigningIn = false;
  }
  return null;
};

/**
 * Starts a background interval that refreshes the Google OAuth token
 * every 45 minutes (before the 1-hour expiry set by Google).
 */
const startRefreshInterval = (user: User) => {
  if (refreshIntervalId) clearInterval(refreshIntervalId);
  // Refresh every 45 minutes (2700000ms) to stay ahead of the 1h expiry
  refreshIntervalId = setInterval(async () => {
    console.log('[Auth] Background token refresh triggered.');
    const newToken = await tryAutoRefreshToken();
    if (!newToken && onRefreshFailure) {
      console.warn('[Auth] Background refresh failed — user may need to re-authenticate.');
    }
  }, 45 * 60 * 1000);
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
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('google_access_token', cachedAccessToken);
          sessionStorage.setItem('google_access_token', cachedAccessToken);
          if (result.user) {
            saveTokenToServer(result.user.uid, cachedAccessToken);
            startRefreshInterval(result.user);
          }
          if (onAuthSuccess && result.user) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }

      if (onInit) onInit();

      // ONLY subscribe to onAuthStateChanged AFTER checking the redirect result
      onAuthStateChanged(auth, async (user: User | null) => {
        const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
        
        if (user) {
          if (currentToken) {
            cachedAccessToken = currentToken;
            saveTokenToServer(user.uid, currentToken);
            startRefreshInterval(user);
            if (onAuthSuccess) onAuthSuccess(user, currentToken);
          } else {
            // Try server store first
            try {
              const serverToken = await getTokenFromServer(user.uid);
              if (serverToken) {
                cachedAccessToken = serverToken;
                localStorage.setItem('google_access_token', serverToken);
                sessionStorage.setItem('google_access_token', serverToken);
                startRefreshInterval(user);
                if (onAuthSuccess) onAuthSuccess(user, serverToken);
                return;
              }
            } catch (err) {
              console.error('Error fetching token on auth state changed:', err);
            }

            // No token found — attempt silent refresh before giving up
            console.log('[Auth] No token found after login — attempting silent refresh...');
            const silentToken = await tryAutoRefreshToken();
            if (!silentToken) {
              cachedAccessToken = null;
              localStorage.removeItem('google_access_token');
              sessionStorage.removeItem('google_access_token');
              if (onAuthFailure) onAuthFailure();
            } else {
              startRefreshInterval(user);
            }
          }
        } else {
          const hasToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
          // If we have a token but no user yet, Firebase may still be restoring
          // the session from persistence — don't clear anything, just wait.
          if (hasToken && !auth.currentUser) {
            return;
          }
          cachedAccessToken = null;
          localStorage.removeItem('google_access_token');
          sessionStorage.removeItem('google_access_token');
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
    
    if (method === 'redirect') {
      await signInWithRedirect(auth, provider);
      return null;
    }

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    sessionStorage.setItem('google_access_token', cachedAccessToken);
    if (result.user) {
      await saveTokenToServer(result.user.uid, cachedAccessToken);
      startRefreshInterval(result.user);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
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
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  sessionStorage.removeItem('google_access_token');
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
  }
};
