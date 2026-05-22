export async function searchStocksFilterSheet(accessToken: string) {
  const query = "mimeType='application/vnd.google-apps.spreadsheet'";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=modifiedTime desc&fields=files(id, name)&pageSize=20`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errData = await res.json();
    console.error("Drive API error:", errData);
    throw new Error(errData.error?.message || "Failed to search Drive");
  }

  const data = await res.json();
  return data.files || [];
}
