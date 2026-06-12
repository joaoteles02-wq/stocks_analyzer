import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Workspace scopes for Drive and Sheets
provider.addScope('https://www.googleapis.com/auth/drive.readonly');
provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
provider.setCustomParameters({
  prompt: 'select_account' // Let user pick account easily without forcing full consent prompts every time
});

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

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void,
  onInit?: () => void
) => {
  let authCheckCount = 0;

  const handleAuthState = async (user: User | null) => {
    authCheckCount++;
    const isInitialCheck = authCheckCount <= 1;

    const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');

    if (user) {
      if (currentToken) {
        cachedAccessToken = currentToken;
        saveTokenToServer(user.uid, currentToken);
        if (onAuthSuccess) onAuthSuccess(user, currentToken);
        if (isInitialCheck && onInit) onInit();
      } else {
        try {
          const serverToken = await getTokenFromServer(user.uid);
          if (serverToken) {
            cachedAccessToken = serverToken;
            localStorage.setItem('google_access_token', serverToken);
            sessionStorage.setItem('google_access_token', serverToken);
            if (onAuthSuccess) onAuthSuccess(user, serverToken);
            if (isInitialCheck && onInit) onInit();
            return;
          }
        } catch (err) {
          console.error('Error fetching token on auth state changed:', err);
        }

        cachedAccessToken = null;
        localStorage.removeItem('google_access_token');
        sessionStorage.removeItem('google_access_token');
        // Only call failure after the initial check resolves — avoids false null on page load
        if (!isInitialCheck && onAuthFailure) onAuthFailure();
        if (isInitialCheck && onInit) onInit();
      }
    } else {
      // On first call (page load), Firebase hasn't restored the session yet — wait for the real state
      if (isInitialCheck) {
        if (onInit) onInit();
        return;
      }
      cachedAccessToken = null;
      localStorage.removeItem('google_access_token');
      sessionStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  };

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
          }
          if (onAuthSuccess && result.user) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }

      // Subscribe to onAuthStateChanged AFTER checking the redirect result
      onAuthStateChanged(auth, handleAuthState);
    })
    .catch((error) => {
      console.error('Redirect sign in error:', error);
      onAuthStateChanged(auth, handleAuthState);
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

    // Default to popup which is highly reliable on Safari/Chrome mobile inside standard tabs
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
};
