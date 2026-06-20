const SYNC_KEYS = [
  'saved_interactive_wallet_full',
  'saved_wallet_budget',
  'sheet_reference_date',
  'sheet_initial_price_col_idx',
  'sheet_current_price_col_idx',
  'active_strategy',
] as const;

const API_PATH = '/api/wallet-config';

export async function pullWalletConfig(): Promise<boolean> {
  try {
    const res = await fetch(API_PATH);
    if (!res.ok) return false;
    const config = await res.json();
    if (!config || Object.keys(config).length === 0) return false;
    let changed = false;
    for (const key of SYNC_KEYS) {
      if (config[key] !== undefined) {
        const serialized = typeof config[key] === 'string' ? config[key] : JSON.stringify(config[key]);
        if (localStorage.getItem(key) !== serialized) {
          localStorage.setItem(key, serialized);
          changed = true;
        }
      }
    }
    return changed;
  } catch {
    return false;
  }
}

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
  try {
    await fetch(API_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch {
    // Silently fail if server is unavailable
  }
}
