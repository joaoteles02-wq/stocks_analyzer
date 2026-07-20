/**
 * sheets-public.ts
 * Fetches Google Sheets data without OAuth token.
 * Works for any spreadsheet that is publicly accessible (view link shared).
 *
 * Uses the server-side proxy (/api/public-sheet) to avoid CORS restrictions
 * that browsers enforce when fetching Google export URLs directly.
 */

/**
 * Fetches the data from a public Google Sheets tab via the backend proxy.
 * Returns a 2D array of strings (same shape as getSpreadsheetData).
 */
export async function fetchPublicSheetData(
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  let actualId = spreadsheetId;
  const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    actualId = match[1];
  }

  const isLocalhost =
    typeof window !== 'undefined' && window.location.hostname.includes('localhost');
  const apiHost = isLocalhost ? '' : `https://${window.location.host}`;

  const url = `${apiHost}/api/public-sheet?id=${encodeURIComponent(actualId)}&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`[PublicSheet] Erro ao buscar planilha pública: ${res.status} — ${text.slice(0, 120)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data.rows)) {
    throw new Error('[PublicSheet] Resposta inválida do servidor.');
  }

  return data.rows as string[][];
}

/**
 * Fetches the list of sheet (tab) names from a public spreadsheet
 * by scraping the export page. Returns an array of sheet names.
 * Falls back to a best-guess list based on known naming conventions.
 */
export async function fetchPublicSheetNames(spreadsheetId: string): Promise<string[]> {
  let actualId = spreadsheetId;
  const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    actualId = match[1];
  }

  const isLocalhost =
    typeof window !== 'undefined' && window.location.hostname.includes('localhost');
  const apiHost = isLocalhost ? '' : `https://${window.location.host}`;

  try {
    const url = `${apiHost}/api/public-sheet-names?id=${encodeURIComponent(actualId)}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sheets) && data.sheets.length > 0) {
        return data.sheets as string[];
      }
    }
  } catch (_) {
    // ignore, fall through to defaults
  }

  // Fallback: return known sheet names based on this project's spreadsheet structure
  return ['AÇÕES', 'FII', 'S&P500'];
}
