export const getHistoricalPrice = async (ticker: string, date: string): Promise<number | null> => {
  try {
    const response = await fetch(`/api/historical-price?ticker=${encodeURIComponent(ticker)}&date=${encodeURIComponent(date)}`);
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
