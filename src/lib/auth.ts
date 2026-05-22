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
  prompt: 'consent' // Forces consent screen so user can check missing boxes
});

let isSigningIn = false;
let cachedAccessToken: string | null = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Check redirect result first (handles returning from the Google login screen on mobile)
  getRedirectResult(auth)
    .then((result) => {
      if (result) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('google_access_token', cachedAccessToken);
          sessionStorage.setItem('google_access_token', cachedAccessToken);
          if (onAuthSuccess && result.user) {
            onAuthSuccess(result.user, cachedAccessToken);
          }
        }
      }

      // ONLY subscribe to onAuthStateChanged AFTER checking the redirect result
      // This ensures any newly received redirect credentials are saved to localStorage first,
      // avoiding a race condition where onAuthStateChanged fires before getRedirectResult resolves.
      onAuthStateChanged(auth, async (user: User | null) => {
        const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
        
        if (user) {
          if (currentToken) {
            cachedAccessToken = currentToken;
            if (onAuthSuccess) onAuthSuccess(user, currentToken);
          } else {
            // We have a user but no Google Sheets/Drive OAuth token in storage. 
            // They need to click login again to grant specific Drive scopes.
            cachedAccessToken = null;
            localStorage.removeItem('google_access_token');
            sessionStorage.removeItem('google_access_token');
            if (onAuthFailure) onAuthFailure();
          }
        } else {
          cachedAccessToken = null;
          localStorage.removeItem('google_access_token');
          sessionStorage.removeItem('google_access_token');
          if (onAuthFailure) onAuthFailure();
        }
      });
    })
    .catch((error) => {
      console.error('Redirect sign in error:', error);
      // Fallback on error to still listen for changes
      onAuthStateChanged(auth, async (user: User | null) => {
        const currentToken = localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token');
        if (user && currentToken) {
          cachedAccessToken = currentToken;
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

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    
    if (isMobileDevice()) {
      // Use redirect on mobile to bypassed aggressive popup blockers
      await signInWithRedirect(auth, provider);
      return null;
    }

    // Use popup on desktop
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    localStorage.setItem('google_access_token', cachedAccessToken);
    sessionStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    // Only clear login loading screen state if we didn't redirect away
    if (!isMobileDevice()) {
      isSigningIn = false;
    }
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  localStorage.removeItem('google_access_token');
  sessionStorage.removeItem('google_access_token');
};
