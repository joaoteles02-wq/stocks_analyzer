import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, off } from 'firebase/database';
import firebaseConfig from '../../firebase-applet-config.json';

// Keys synced between devices
export const SYNC_KEYS = [
  'saved_interactive_wallet_full',
  'saved_wallet_budget',
  'sheet_reference_date',
  'sheet_initial_price_col_idx',
  'sheet_current_price_col_idx',
  'active_strategy',
] as const;

// Single global node — shared across all devices (no per-user isolation)
const GLOBAL_NODE = 'wallet_config/global';

// Reuse the Firebase app instance already created by auth.ts (or create one if needed)
function getFirebaseDb() {
  const apps = getApps();
  const app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  return getDatabase(app);
}

/**
 * Pull wallet config from Firebase Realtime DB and apply to localStorage.
 * Returns true if any value changed.
 */
export async function pullWalletConfig(): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const snapshot = await get(ref(db, GLOBAL_NODE));
    if (!snapshot.exists()) return false;

    const config = snapshot.val() as Record<string, any>;
    if (!config || Object.keys(config).length === 0) return false;

    let changed = false;
    for (const key of SYNC_KEYS) {
      if (config[key] !== undefined) {
        const serialized =
          typeof config[key] === 'string' ? config[key] : JSON.stringify(config[key]);
        if (localStorage.getItem(key) !== serialized) {
          localStorage.setItem(key, serialized);
          changed = true;
        }
      }
    }
    return changed;
  } catch (err) {
    console.warn('[Sync] pullWalletConfig failed (Firebase):', err);
    return false;
  }
}

/**
 * Push current localStorage wallet config to Firebase Realtime DB.
 */
export async function pushWalletConfig(): Promise<void> {
  const config: Record<string, any> = {};
  for (const key of SYNC_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      try {
        config[key] = JSON.parse(val);
      } catch {
        config[key] = val;
      }
    }
  }

  if (Object.keys(config).length === 0) return;

  try {
    const db = getFirebaseDb();
    await set(ref(db, GLOBAL_NODE), config);
  } catch (err) {
    console.warn('[Sync] pushWalletConfig failed (Firebase):', err);
  }
}

/**
 * Subscribe to real-time changes from Firebase.
 * Calls `onChange` whenever another device updates the config.
 * Returns an unsubscribe function.
 */
export function subscribeToWalletConfig(onChange: (changed: boolean) => void): () => void {
  try {
    const db = getFirebaseDb();
    const configRef = ref(db, GLOBAL_NODE);

    const listener = onValue(configRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const config = snapshot.val() as Record<string, any>;
      if (!config) return;

      let changed = false;
      for (const key of SYNC_KEYS) {
        if (config[key] !== undefined) {
          const serialized =
            typeof config[key] === 'string' ? config[key] : JSON.stringify(config[key]);
          if (localStorage.getItem(key) !== serialized) {
            localStorage.setItem(key, serialized);
            changed = true;
          }
        }
      }

      if (changed) {
        // Dispatch a custom event so WalletView can react even in the same tab
        window.dispatchEvent(new CustomEvent('walletConfigSynced'));
        onChange(true);
      }
    });

    return () => off(configRef, 'value', listener);
  } catch (err) {
    console.warn('[Sync] subscribeToWalletConfig failed:', err);
    return () => {};
  }
}
