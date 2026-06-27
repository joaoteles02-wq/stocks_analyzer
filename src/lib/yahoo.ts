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

export const fetchDividendYield = async (ticker: string): Promise<number | null> => {
  try {
    const response = await fetch(`/api/dividend-yield?ticker=${encodeURIComponent(ticker)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const dy = data.dividendYield;
    if (dy === null || dy === undefined) return null;
    return dy > 1 ? dy / 100 : dy;
  } catch (error) {
    console.error(`Error fetching dividend yield for ${ticker}:`, error);
    return null;
  }
};

export const getCurrentPrice = async (ticker: string): Promise<number | null> => {
  try {
    const response = await fetch(`/api/current-price?ticker=${encodeURIComponent(ticker)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.price;
  } catch (error) {
    console.error(`Error fetching current price for ${ticker}:`, error);
    return null;
  }
};

interface MarketInfo {
  price: number | null;
  dividendYield: number | null;
}

export const fetchFinancialMarketInfo = async (ticker: string, formattedDate?: string): Promise<MarketInfo> => {
  try {
    const cleanTicker = (ticker || '')
      .trim()
      .toUpperCase()
      .replace(/\.SA$/, '')
      .replace(/^BVMF:/, '')
      .trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `/api/brapi-price?ticker=${encodeURIComponent(cleanTicker)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`fetchFinancialMarketInfo: Brapi API error for ${ticker}`, response.status);
      return { price: null, dividendYield: null };
    }

    const data = await response.json();
    return { price: data.price ?? null, dividendYield: data.dividendYield ?? null };
  } catch (error) {
    console.error(`fetchFinancialMarketInfo: Error fetching market info for ${ticker}:`, error);
    return { price: null, dividendYield: null };
  }
};
