export async function getSpreadsheetSheets(accessToken: string, spreadsheetId: string): Promise<string[]> {
  let actualId = spreadsheetId;
  const match = spreadsheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    actualId = match[1];
  }
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${actualId}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const errorText = await metaRes.text();
    let errorMsg = "Failed to fetch spreadsheet metadata";
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) errorMsg = parsed.error.message;
    } catch(e) {}
    throw new Error(`[Metadata] ${errorMsg}`);
  }
  const metaData = await metaRes.json();
  const sheets = metaData.sheets || [];
  return sheets.map((s: any) => s.properties?.title || "").filter(Boolean);
}

export async function getSpreadsheetData(accessToken: string, spreadsheetId: string) {
  // First, get the list of sheets to find the first sheet name
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const errorText = await metaRes.text();
    let errorMsg = "Failed to fetch spreadsheet metadata";
    try {
      const parsed = JSON.parse(errorText);
      if (parsed.error && parsed.error.message) errorMsg = parsed.error.message;
    } catch(e) {}
    throw new Error(`[Metadata] ${errorMsg}`);
  }
  const metaData = await metaRes.json();
  const sheets = metaData.sheets || [];
  if (sheets.length === 0) {
    throw new Error("No sheets found in this file.");
  }
  
  const firstSheetName = sheets[0].properties.title;
  
  // Now fetch the values of the first sheet
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetName)}!A1:Z1000`;
  const valuesRes = await fetch(valuesUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!valuesRes.ok) {
    throw new Error("Failed to fetch spreadsheet values");
  }

  const valuesData = await valuesRes.json();
  return valuesData.values || [];
}
