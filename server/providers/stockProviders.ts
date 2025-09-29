import { normalizeMarketData } from '../utils/formatters.js';
import { getCircuitBreaker } from '../utils/circuitBreaker.js';
import { stockProviderOptimizer } from '../utils/providerOptimizer.js';
import { type UnifiedMarketData } from '@shared/schema';

export interface StockProvider {
  id: string;
  priority: number;
  capabilities: ('live' | 'snapshot' | 'history')[];
  rateLimit: number;
  requiresKey: boolean;
  
  fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]>;
  fetchHistory?(symbol: string, range: string): Promise<any[]>;
}

export class IEXCloudProvider implements StockProvider {
  id = 'iex';
  priority = 1;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['live', 'snapshot', 'history'];
  rateLimit = 100; // varies by plan
  requiresKey = true;
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.IEX_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('IEX Cloud API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.join(',');
      const url = `https://cloud.iexapis.com/stable/stock/market/batch?symbols=${symbolsQuery}&types=quote&token=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`IEX Cloud API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return symbols.map(symbol => {
        const quote = data[symbol]?.quote;
        if (!quote) return null;
        
        return normalizeMarketData(quote, this.id, 'stock');
      }).filter(Boolean) as UnifiedMarketData[];
    });
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('IEX Cloud API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const iexRange = this.convertRange(range);
      const url = `https://cloud.iexapis.com/stable/stock/${symbol}/chart/${iexRange}?token=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`IEX Cloud history API error: ${response.statusText}`);
      }
      
      return await response.json();
    });
  }
  
  private convertRange(range: string): string {
    switch (range) {
      case '1d': return '1d';
      case '1w': return '5d';
      case '1M': return '1m';
      case '3M': return '3m';
      case '1Y': return '1y';
      default: return '1d';
    }
  }
}

export class FinnhubProvider implements StockProvider {
  id = 'finnhub';
  priority = 2;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['live', 'snapshot', 'history'];
  rateLimit = 60; // 60 calls per minute
  requiresKey = true;
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.FINNHUB_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols) {
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${this.apiKey}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            results.push(normalizeMarketData({ ...data, symbol }, this.id, 'stock'));
          }
        } catch (error) {
          console.error(`Error fetching ${symbol} from Finnhub:`, error);
        }
      }
      
      return results;
    });
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Finnhub API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const { from, to, resolution } = this.getTimeParams(range);
      const url = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=${resolution}&from=${from}&to=${to}&token=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Finnhub history API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.c?.map((close: number, index: number) => ({
        timestamp: data.t[index] * 1000,
        close: close,
        open: data.o[index],
        high: data.h[index],
        low: data.l[index],
        volume: data.v[index]
      })) || [];
    });
  }
  
  private getTimeParams(range: string) {
    const now = Math.floor(Date.now() / 1000);
    const day = 24 * 60 * 60;
    
    switch (range) {
      case '1d':
        return { from: now - day, to: now, resolution: '5' };
      case '1w':
        return { from: now - 7 * day, to: now, resolution: '60' };
      case '1M':
        return { from: now - 30 * day, to: now, resolution: 'D' };
      case '3M':
        return { from: now - 90 * day, to: now, resolution: 'D' };
      case '1Y':
        return { from: now - 365 * day, to: now, resolution: 'D' };
      default:
        return { from: now - day, to: now, resolution: '5' };
    }
  }
}

export class YahooFinanceProvider implements StockProvider {
  id = 'yahoo';
  priority = 3;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 2000; // Estimated limit
  requiresKey = false; // Can work without key but limited
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      // Using Yahoo Finance API v8 (free but unofficial)
      const symbolsQuery = symbols.join(',');
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbolsQuery}?interval=1d&range=1d`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: UnifiedMarketData[] = [];
      
      if (data.chart?.result) {
        for (const result of data.chart.result) {
          const meta = result.meta;
          const quote = result.indicators?.quote?.[0];
          
          if (meta && quote) {
            results.push(normalizeMarketData({
              symbol: meta.symbol,
              price: meta.regularMarketPrice,
              changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
              volume: quote.volume?.[quote.volume.length - 1],
              marketCap: meta.marketCap
            }, this.id, 'stock'));
          }
        }
      }
      
      return results;
    });
  }
}

export class MarketStackProvider implements StockProvider {
  id = 'marketstack';
  priority = 4;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'history'];
  rateLimit = 1000; // 1000 requests per month on free plan
  requiresKey = true;
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.MARKETSTACK_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('MarketStack API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.join(',');
      const url = `http://api.marketstack.com/v1/eod/latest?access_key=${this.apiKey}&symbols=${symbolsQuery}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`MarketStack API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data?.map((item: any) => normalizeMarketData(item, this.id, 'stock')) || [];
    });
  }
}

export class TwelveDataProvider implements StockProvider {
  id = 'twelvedata';
  priority = 5;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'history'];
  rateLimit = 800; // 800 requests per day on free plan
  requiresKey = true;
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.TWELVEDATA_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('Twelve Data API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.join(',');
      const url = `https://api.twelvedata.com/price?symbol=${symbolsQuery}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Twelve Data API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Handle single symbol vs multiple symbols response format
      if (symbols.length === 1) {
        return [normalizeMarketData({ symbol: symbols[0], price: parseFloat(data.price) }, this.id, 'stock')];
      } else {
        return Object.keys(data).map(symbol => 
          normalizeMarketData({ symbol, price: parseFloat(data[symbol].price) }, this.id, 'stock')
        );
      }
    });
  }
}

export class PolygonFreeProvider implements StockProvider {
  id = 'polygon';
  priority = 6;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 5; // 5 requests per minute on free tier
  requiresKey = false; // Using free endpoints
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      // Polygon.io has some free endpoints for basic data
      for (const symbol of symbols) {
        try {
          // Using free previous close endpoint
          const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            const result = data.results?.[0];
            if (result) {
              results.push(normalizeMarketData({
                symbol,
                price: result.c, // Close price
                change24h: ((result.c - result.o) / result.o) * 100,
                volume: result.v
              }, this.id, 'stock'));
            }
          }
        } catch (error) {
          console.error(`Error fetching ${symbol} from Polygon:`, error);
        }
      }
      
      return results;
    });
  }
}

export class AlphaVantageFreeProvider implements StockProvider {
  id = 'alphavantage';
  priority = 7;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'history'];
  rateLimit = 5; // 5 requests per minute on free tier
  requiresKey = true;
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      // Alpha Vantage requires one symbol per request
      for (const symbol of symbols) {
        try {
          const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${this.apiKey}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            const quote = data['Global Quote'];
            if (quote && quote['05. price']) {
              results.push(normalizeMarketData({
                symbol,
                price: parseFloat(quote['05. price']),
                change24h: parseFloat(quote['10. change percent'].replace('%', '')),
                volume: parseFloat(quote['06. volume'])
              }, this.id, 'stock'));
            }
          }
          
          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error fetching ${symbol} from Alpha Vantage:`, error);
        }
      }
      
      return results;
    });
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const func = this.getTimeSeriesFunction(range);
      const url = `https://www.alphavantage.co/query?function=${func}&symbol=${symbol}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Alpha Vantage history API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
      const timeSeriesData = timeSeriesKey ? data[timeSeriesKey] : null;
      
      if (!timeSeriesData) return [];
      
      return Object.entries(timeSeriesData).map(([date, values]: [string, any]) => ({
        timestamp: new Date(date).getTime(),
        close: parseFloat(values['4. close']),
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        volume: parseFloat(values['5. volume'])
      }));
    });
  }
  
  private getTimeSeriesFunction(range: string): string {
    switch (range) {
      case '1d': return 'TIME_SERIES_INTRADAY&interval=5min';
      case '1w': case '1M': return 'TIME_SERIES_DAILY';
      case '3M': case '1Y': return 'TIME_SERIES_WEEKLY';
      default: return 'TIME_SERIES_DAILY';
    }
  }
}

export class FinancialModelingPrepProvider implements StockProvider {
  id = 'fmp';
  priority = 8;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 250; // 250 requests per day on free tier
  requiresKey = false; // Some endpoints don't require key
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      // FMP has some free endpoints for major stocks
      for (const symbol of symbols) {
        try {
          const url = `https://financialmodelingprep.com/api/v3/quote-short/${symbol}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              const quote = data[0];
              results.push(normalizeMarketData({
                symbol,
                price: quote.price,
                change24h: ((quote.price - quote.price) / quote.price) * 100 // Need to calculate from additional data
              }, this.id, 'stock'));
            }
          }
        } catch (error) {
          console.error(`Error fetching ${symbol} from FMP:`, error);
        }
      }
      
      return results;
    });
  }
}

export class TiingoFreeProvider implements StockProvider {
  id = 'tiingo';
  priority = 9;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'history'];
  rateLimit = 1000; // 1000 requests per day on free tier
  requiresKey = true;
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.TIINGO_API_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('Tiingo API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols) {
        try {
          const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?token=${this.apiKey}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              const latest = data[0];
              results.push(normalizeMarketData({
                symbol,
                price: latest.close,
                change24h: ((latest.close - latest.prevClose) / latest.prevClose) * 100,
                volume: latest.volume
              }, this.id, 'stock'));
            }
          }
        } catch (error) {
          console.error(`Error fetching ${symbol} from Tiingo:`, error);
        }
      }
      
      return results;
    });
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('Tiingo API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const { startDate, endDate } = this.getDateRange(range);
      const url = `https://api.tiingo.com/tiingo/daily/${symbol}/prices?startDate=${startDate}&endDate=${endDate}&token=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Tiingo history API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.map((item: any) => ({
        timestamp: new Date(item.date).getTime(),
        close: item.close,
        open: item.open,
        high: item.high,
        low: item.low,
        volume: item.volume
      }));
    });
  }
  
  private getDateRange(range: string) {
    const now = new Date();
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    
    switch (range) {
      case '1d':
        return { startDate: formatDate(new Date(now.getTime() - 24 * 60 * 60 * 1000)), endDate: formatDate(now) };
      case '1w':
        return { startDate: formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), endDate: formatDate(now) };
      case '1M':
        return { startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), endDate: formatDate(now) };
      case '3M':
        return { startDate: formatDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)), endDate: formatDate(now) };
      case '1Y':
        return { startDate: formatDate(new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)), endDate: formatDate(now) };
      default:
        return { startDate: formatDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), endDate: formatDate(now) };
    }
  }
}

export class WorldTradingDataProvider implements StockProvider {
  id = 'worldtradingdata';
  priority = 10;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 250; // 250 requests per day on free tier
  requiresKey = false; // Some basic endpoints are free
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      // World Trading Data has been discontinued, but keeping structure for alternative
      // Using alternative free endpoint structure
      const results: UnifiedMarketData[] = [];
      
      // Placeholder for when we find a replacement free API
      console.log('WorldTradingData provider - looking for alternative free endpoint');
      
      return results;
    });
  }
}

// === ADDITIONAL FREE STOCK PROVIDERS ===

export class QuandlFreeProvider implements StockProvider {
  id = 'quandl';
  priority = 8;
  capabilities: ('live' | 'snapshot')[] = ['snapshot'];
  rateLimit = 300; // Free tier
  requiresKey = false;
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols.slice(0, 5)) {
        try {
          // Use alternative free endpoint
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data.dataset?.data?.[0]) {
              const latest = data.dataset.data[0];
              results.push(normalizeMarketData({
                symbol: symbol,
                name: symbol,
                price: latest[4], // Close price
                close: latest[4],
                high: latest[2],
                low: latest[3],
                volume: latest[5]
              }, this.id, 'stock'));
            }
          }
        } catch (error) {
          // Continue with other symbols
        }
      }
      
      return results;
    });
  }
}

export class EODHDFreeProvider implements StockProvider {
  id = 'eodhd';
  priority = 9;
  capabilities: ('live' | 'snapshot')[] = ['snapshot'];
  rateLimit = 20; // 20 requests per day free
  requiresKey = false;
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols.slice(0, 3)) { // Limited free requests
        try {
          const url = `https://eodhd.com/api/real-time/${symbol}.US?fmt=json&api_token=demo`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data.code === symbol) {
              results.push(normalizeMarketData({
                symbol: data.code,
                name: data.code,
                price: data.close,
                close: data.close,
                high: data.high,
                low: data.low,
                volume: data.volume,
                change: data.change,
                changePercent: data.change_p
              }, this.id, 'stock'));
            }
          }
        } catch (error) {
          // Continue with other symbols
        }
      }
      
      return results;
    });
  }
}

export class StooqProvider implements StockProvider {
  id = 'stooq';
  priority = 10;
  capabilities: ('live' | 'snapshot')[] = ['snapshot'];
  rateLimit = 1000; // Very generous
  requiresKey = false;
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('stock', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols.slice(0, 10)) {
        try {
          // Stooq provides free CSV data
          const url = `https://stooq.com/q/l/?s=${symbol.toLowerCase()}&f=sd2t2ohlcv&h&e=csv`;
          const response = await fetch(url);
          
          if (response.ok) {
            const csv = await response.text();
            const lines = csv.trim().split('\n');
            if (lines.length > 1) {
              const data = lines[1].split(',');
              if (data.length >= 7) {
                results.push(normalizeMarketData({
                  symbol: data[0].toUpperCase(),
                  name: data[0],
                  price: parseFloat(data[6]) || 0, // Close
                  close: parseFloat(data[6]) || 0,
                  high: parseFloat(data[4]) || 0,
                  low: parseFloat(data[5]) || 0,
                  volume: parseFloat(data[7]) || 0
                }, this.id, 'stock'));
              }
            }
          }
        } catch (error) {
          // Continue with other symbols
        }
      }
      
      return results;
    });
  }
}

// Stock Provider Registry
export class StockProviderRegistry {
  private providers: StockProvider[];
  
  constructor() {
    this.providers = [
      new IEXCloudProvider(),
      new FinnhubProvider(),
      new YahooFinanceProvider(),
      new MarketStackProvider(),
      new TwelveDataProvider(),
      new PolygonFreeProvider(),
      new AlphaVantageFreeProvider(),
      new FinancialModelingPrepProvider(),
      new TiingoFreeProvider(),
      new WorldTradingDataProvider(),
      new QuandlFreeProvider(),
      new EODHDFreeProvider(),
      new StooqProvider()
    ].sort((a, b) => a.priority - b.priority);
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    // Get optimized provider order
    const optimizedProviders = stockProviderOptimizer.optimizeProviderOrder(this.providers);
    
    let attemptedProviders = 0;
    
    // First try with performance filtering
    for (const provider of optimizedProviders) {
      if (!provider.capabilities.includes('snapshot')) continue;
      
      // Runtime assertion to ensure provider methods exist
      if (typeof provider.fetchSnapshot !== 'function') {
        console.error(`Provider ${provider.id} is corrupted - missing fetchSnapshot method`);
        continue;
      }
      
      // Skip providers that require keys if keys aren't available
      if (provider.requiresKey) {
        const hasKey = this.hasRequiredKey(provider.id);
        if (!hasKey) {
          console.log(`Skipping ${provider.id} - API key not provided`);
          continue;
        }
      }
      
      // Skip providers that should be avoided based on performance
      if (stockProviderOptimizer.shouldSkipProvider(provider.id)) {
        console.log(`Skipping provider ${provider.id} - poor performance metrics`);
        continue;
      }
      
      attemptedProviders++;
      
      try {
        const data = await stockProviderOptimizer.recordProviderRequest(
          provider.id,
          () => provider.fetchSnapshot(symbols)
        );
        
        if (data.length > 0) {
          return data;
        }
      } catch (error) {
        console.error(`Provider ${provider.id} failed:`, error);
        continue;
      }
    }
    
    // If all providers are skipped/failed, try fallback without performance filtering
    if (attemptedProviders === 0) {
      console.log('All providers skipped by optimizer - trying fallback without performance filtering');
      for (const provider of this.providers) {
        if (!provider.capabilities.includes('snapshot')) continue;
        
        // Runtime assertion for fallback too
        if (typeof provider.fetchSnapshot !== 'function') {
          console.error(`Fallback provider ${provider.id} is corrupted - missing fetchSnapshot method`);
          continue;
        }
        
        // Still skip providers that require keys if keys aren't available
        if (provider.requiresKey) {
          const hasKey = this.hasRequiredKey(provider.id);
          if (!hasKey) {
            continue;
          }
        }
        
        try {
          const data = await provider.fetchSnapshot(symbols);
          if (data.length > 0) {
            return data;
          }
        } catch (error) {
          console.error(`Fallback provider ${provider.id} failed:`, error);
          continue;
        }
      }
    }
    
    // If all providers fail, return empty array with warning
    console.warn('All stock providers failed - consider adding API keys for live data');
    return [];
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    for (const provider of this.providers) {
      if (!provider.capabilities.includes('history') || !provider.fetchHistory) continue;
      
      if (provider.requiresKey && !this.hasRequiredKey(provider.id)) continue;
      
      try {
        const data = await provider.fetchHistory(symbol, range);
        if (data.length > 0) {
          return data;
        }
      } catch (error) {
        console.error(`Provider ${provider.id} history failed:`, error);
        continue;
      }
    }
    
    return [];
  }
  
  private hasRequiredKey(providerId: string): boolean {
    switch (providerId) {
      case 'iex': return !!process.env.IEX_KEY;
      case 'finnhub': return !!process.env.FINNHUB_KEY;
      case 'marketstack': return !!process.env.MARKETSTACK_KEY;
      case 'twelvedata': return !!process.env.TWELVEDATA_KEY;
      case 'alphavantage': return !!process.env.ALPHA_VANTAGE_API_KEY;
      case 'tiingo': return !!process.env.TIINGO_API_KEY;
      default: return true;
    }
  }
  
  getProviderStats() {
    const recommendations = stockProviderOptimizer.getProviderRecommendations();
    const performanceStats = stockProviderOptimizer.getProviderStats();
    
    return this.providers.map(provider => {
      const perfStat = performanceStats.find(p => p.id === provider.id);
      const metrics = stockProviderOptimizer.getProviderMetrics(provider.id);
      const dynamicPriority = stockProviderOptimizer.getProviderDynamicPriority(provider);
      
      return {
        id: provider.id,
        priority: provider.priority,
        dynamicPriority: dynamicPriority,
        capabilities: provider.capabilities,
        requiresKey: provider.requiresKey,
        hasKey: provider.requiresKey ? this.hasRequiredKey(provider.id) : true,
        circuitBreakerState: getCircuitBreaker('stock', provider.id).getState(),
        performance: perfStat || null,
        recommendation: recommendations.fast.includes(provider.id) ? 'fast' :
                      recommendations.reliable.includes(provider.id) ? 'reliable' :
                      recommendations.avoid.includes(provider.id) ? 'avoid' : 'normal'
      };
    });
  }
}
