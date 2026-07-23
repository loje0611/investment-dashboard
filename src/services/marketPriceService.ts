/**
 * Real-time Market Price Service for Investment Dashboard
 * Fetches live prices for Korean and US stocks/ETFs from Naver & Yahoo Finance APIs.
 */

export interface MarketPriceResult {
  symbol: string;
  price: number;
  name?: string;
  currency: 'KRW' | 'USD';
  timestamp: number;
}

const PRICE_CACHE: Record<string, MarketPriceResult> = {};
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5분 캐싱

/**
 * 미국 / 한국 주식 실시간 시세를 가져옵니다.
 * @param symbol - 종목 코드 (예: '005930', 'ACE 미국배당', 'SCHD', 'QQQ')
 */
export async function fetchLiveMarketPrice(symbol: string): Promise<MarketPriceResult | null> {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return null;

  // 캐시 확인
  const cached = PRICE_CACHE[cleanSymbol];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached;
  }

  // 1. 한국 종목코드 (6자리 숫자, 예: 005930, 368590)
  if (/^[0-9]{6}$/.test(cleanSymbol)) {
    try {
      const url = `/api/naver-stock/api/stock/${cleanSymbol}/basic`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const priceNum = parseFloat(String(data.closePrice).replace(/,/g, ''));
        if (!isNaN(priceNum) && priceNum > 0) {
          const result: MarketPriceResult = {
            symbol: cleanSymbol,
            price: priceNum,
            name: data.stockName ?? cleanSymbol,
            currency: 'KRW',
            timestamp: Date.now(),
          };
          PRICE_CACHE[cleanSymbol] = result;
          return result;
        }
      }
    } catch (e) {
      // Fallback or ignore
    }
  }

  // 2. 미국 종목 (알파벳 티커, 예: SCHD, QQQ, VOO, SPY)
  if (/^[A-Z]{3,5}$/.test(cleanSymbol)) {
    try {
      const url = `/api/yahoo-stock/v8/finance/chart/${cleanSymbol}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta && typeof meta.regularMarketPrice === 'number') {
          const result: MarketPriceResult = {
            symbol: cleanSymbol,
            price: meta.regularMarketPrice,
            name: meta.symbol ?? cleanSymbol,
            currency: 'USD',
            timestamp: Date.now(),
          };
          PRICE_CACHE[cleanSymbol] = result;
          return result;
        }
      }
    } catch (e) {
      // Fallback or ignore
    }
  }

  return null;
}

/**
 * 실시간 달러/원화(USD/KRW) 환율을 가져옵니다.
 */
export async function fetchLiveUsdKrwRate(): Promise<number> {
  const cacheKey = 'USD_KRW';
  const cached = PRICE_CACHE[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
    return cached.price;
  }

  try {
    const url = `/api/yahoo-stock/v8/finance/chart/KRW=X`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && typeof meta.regularMarketPrice === 'number') {
        const rate = meta.regularMarketPrice;
        PRICE_CACHE[cacheKey] = {
          symbol: cacheKey,
          price: rate,
          currency: 'KRW',
          timestamp: Date.now(),
        };
        return rate;
      }
    }
  } catch (e) {
    // Fallback
  }

  return 1470.0; // 기본 환율 힌트
}
