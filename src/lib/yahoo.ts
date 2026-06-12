const fetchWithTimeout = async (url: string, ms = 15000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

export const getHistoricalPrice = async (ticker: string, date: string): Promise<number | null> => {
  try {
    const response = await fetchWithTimeout(`/api/historical-price?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error(`Error fetching historical price for ${ticker}:`, error);
    return null;
  }
};
