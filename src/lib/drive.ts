export async function searchStocksFilterSheet(accessToken: string) {
  const query = "mimeType='application/vnd.google-apps.spreadsheet' and (name contains 'Filtros' and name contains 'ações')";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)&pageSize=10`;

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
