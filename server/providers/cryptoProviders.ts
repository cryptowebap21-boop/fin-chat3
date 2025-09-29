import WebSocket from 'ws';
import { normalizeMarketData } from '../utils/formatters.js';
import { getCircuitBreaker } from '../utils/circuitBreaker.js';
import { cryptoProviderOptimizer } from '../utils/providerOptimizer.js';
import { type UnifiedMarketData } from '@shared/schema';

export interface CryptoProvider {
  id: string;
  priority: number;
  capabilities: ('live' | 'snapshot' | 'history')[];
  rateLimit: number; // requests per minute
  
  fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]>;
  connect?(): Promise<WebSocket | undefined>;
  fetchHistory?(symbol: string, range: string): Promise<any[]>;
}

export class BinanceProvider implements CryptoProvider {
  id = 'binance';
  priority = 1;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['live', 'snapshot'];
  rateLimit = 1200; // 1200 requests per minute
  
  private ws?: WebSocket;
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.map(s => `"${s.toUpperCase()}USDT"`).join(',');
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=[${symbolsQuery}]`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return Array.isArray(data) 
        ? data.map(item => normalizeMarketData(item, this.id, 'crypto'))
        : [normalizeMarketData(data, this.id, 'crypto')];
    });
  }
  
  async connect(): Promise<WebSocket | undefined> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      return new Promise<WebSocket | undefined>((resolve, reject) => {
        const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
        
        ws.on('open', () => {
          console.log('Binance WebSocket connected');
          this.ws = ws;
          resolve(ws);
        });
        
        ws.on('error', (error) => {
          console.error('Binance WebSocket error:', error);
          // Don't throw synchronously, reject the promise instead
          reject(error);
        });
        
        // Add a timeout to avoid hanging
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.terminate();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      });
    });
  }
}

export class CoinGeckoProvider implements CryptoProvider {
  id = 'coingecko';
  priority = 2;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'history'];
  rateLimit = 30; // 30 requests per minute for free tier
  
  private symbolToId: Map<string, string> = new Map([
    ['BTC', 'bitcoin'],
    ['ETH', 'ethereum'],
    ['SOL', 'solana'],
    ['ADA', 'cardano'],
    ['DOT', 'polkadot'],
    ['MATIC', 'polygon'],
    ['AVAX', 'avalanche-2'],
    ['LINK', 'chainlink'],
    ['UNI', 'uniswap'],
    ['LTC', 'litecoin']
  ]);
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const ids = symbols.map(s => this.symbolToId.get(s) || s.toLowerCase()).join(',');
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.map((item: any) => normalizeMarketData(item, this.id, 'crypto'));
    });
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const id = this.symbolToId.get(symbol) || symbol.toLowerCase();
      const days = this.getRangeDays(range);
      const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=${this.getInterval(range)}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko history API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.prices?.map((price: [number, number]) => ({
        timestamp: price[0],
        close: price[1]
      })) || [];
    });
  }
  
  private getRangeDays(range: string): number {
    switch (range) {
      case '1m': case '5m': case '15m': case '30m': case '1h': return 1;
      case '4h': case '1d': return 7;
      case '1w': return 30;
      case '1M': return 365;
      default: return 7;
    }
  }
  
  private getInterval(range: string): string {
    if (['1m', '5m', '15m', '30m'].includes(range)) return 'minutely';
    if (['1h', '4h'].includes(range)) return 'hourly';
    return 'daily';
  }
}

export class CoinPaprikaProvider implements CryptoProvider {
  id = 'coinpaprika';
  priority = 3;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 20000; // 20k requests per month
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      // First get coin IDs for symbols
      const coinsResponse = await fetch('https://api.coinpaprika.com/v1/coins');
      if (!coinsResponse.ok) {
        throw new Error(`CoinPaprika coins API error: ${coinsResponse.statusText}`);
      }
      
      const coins = await coinsResponse.json();
      const symbolToId = new Map();
      coins.forEach((coin: any) => {
        if (symbols.includes(coin.symbol)) {
          symbolToId.set(coin.symbol, coin.id);
        }
      });
      
      // Fetch data for each symbol
      const results: UnifiedMarketData[] = [];
      for (const symbol of symbols) {
        const id = symbolToId.get(symbol);
        if (!id) continue;
        
        try {
          const response = await fetch(`https://api.coinpaprika.com/v1/tickers/${id}`);
          if (response.ok) {
            const data = await response.json();
            results.push(normalizeMarketData(data, this.id, 'crypto'));
          }
        } catch (error) {
          console.error(`Error fetching ${symbol} from CoinPaprika:`, error);
        }
      }
      
      return results;
    });
  }
}

export class KrakenProvider implements CryptoProvider {
  id = 'kraken';
  priority = 4;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 60; // API rate limit
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const pairs = symbols.map(s => `${s}USD`).join(',');
      const url = `https://api.kraken.com/0/public/Ticker?pair=${pairs}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Kraken API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (data.error?.length > 0) {
        throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      }
      
      return Object.keys(data.result || {}).map(pair => 
        normalizeMarketData(data.result[pair], this.id, 'crypto')
      );
    });
  }
}

export class CryptoCompareProvider implements CryptoProvider {
  id = 'cryptocompare';
  priority = 5;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['history', 'snapshot'];
  rateLimit = 100000; // 100k requests per month
  
  private apiKey?: string;
  
  constructor() {
    this.apiKey = process.env.CRYPTOCOMPARE_KEY;
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    if (!this.apiKey) {
      throw new Error('CryptoCompare API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.join(',');
      const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${symbolsQuery}&tsyms=USD&api_key=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CryptoCompare API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return symbols.map(symbol => {
        const symbolData = data.RAW?.[symbol]?.USD;
        if (!symbolData) return null;
        
        return normalizeMarketData({
          symbol,
          price: symbolData.PRICE,
          change24h: symbolData.CHANGEPCT24HOUR,
          volume: symbolData.VOLUME24HOURTO,
          marketCap: symbolData.MKTCAP
        }, this.id, 'crypto');
      }).filter(Boolean) as UnifiedMarketData[];
    });
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    if (!this.apiKey) {
      throw new Error('CryptoCompare API key not provided');
    }
    
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const { endpoint, limit } = this.getHistoryParams(range);
      const url = `https://min-api.cryptocompare.com/data/v2/${endpoint}?fsym=${symbol}&tsym=USD&limit=${limit}&api_key=${this.apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CryptoCompare history API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.Data?.Data || [];
    });
  }
  
  private getHistoryParams(range: string): { endpoint: string; limit: number } {
    switch (range) {
      case '1m': case '5m': case '15m': case '30m': case '1h':
        return { endpoint: 'histominute', limit: 60 };
      case '4h': case '1d':
        return { endpoint: 'histohour', limit: 24 };
      case '1w':
        return { endpoint: 'histoday', limit: 7 };
      case '1M':
        return { endpoint: 'histoday', limit: 30 };
      default:
        return { endpoint: 'histoday', limit: 30 };
    }
  }
}

export class CoinCapProvider implements CryptoProvider {
  id = 'coincap';
  priority = 6;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'live'];
  rateLimit = 1000; // Very generous rate limit
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.join(',');
      const url = `https://api.coincap.io/v2/assets?ids=${symbolsQuery.toLowerCase()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinCap API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data?.map((item: any) => normalizeMarketData({
        symbol: item.symbol,
        name: item.name,
        price: parseFloat(item.priceUsd),
        change24h: parseFloat(item.changePercent24Hr),
        volume: parseFloat(item.volumeUsd24Hr),
        marketCap: parseFloat(item.marketCapUsd)
      }, this.id, 'crypto')) || [];
    });
  }
  
  async connect(): Promise<WebSocket | undefined> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      return new Promise<WebSocket | undefined>((resolve, reject) => {
        const ws = new WebSocket('wss://ws.coincap.io/prices?assets=ALL');
        
        ws.on('open', () => {
          console.log('CoinCap WebSocket connected');
          resolve(ws);
        });
        
        ws.on('error', (error) => {
          console.error('CoinCap WebSocket error:', error);
          reject(error);
        });
        
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.terminate();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      });
    });
  }
}

export class CoinbaseProProvider implements CryptoProvider {
  id = 'coinbase';
  priority = 7;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot', 'live'];
  rateLimit = 1000; // Public endpoints have good limits
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols) {
        try {
          const productId = `${symbol}-USD`;
          const [statsResponse, tickerResponse] = await Promise.all([
            fetch(`https://api.exchange.coinbase.com/products/${productId}/stats`),
            fetch(`https://api.exchange.coinbase.com/products/${productId}/ticker`)
          ]);
          
          if (statsResponse.ok && tickerResponse.ok) {
            const [stats, ticker] = await Promise.all([
              statsResponse.json(),
              tickerResponse.json()
            ]);
            
            results.push(normalizeMarketData({
              symbol,
              price: parseFloat(ticker.price),
              change24h: parseFloat(stats.last) / parseFloat(stats.open) * 100 - 100,
              volume: parseFloat(stats.volume)
            }, this.id, 'crypto'));
          }
        } catch (error) {
          console.error(`Error fetching ${symbol} from Coinbase:`, error);
        }
      }
      
      return results;
    });
  }
  
  async connect(): Promise<WebSocket | undefined> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      return new Promise<WebSocket | undefined>((resolve, reject) => {
        const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
        
        ws.on('open', () => {
          console.log('Coinbase Pro WebSocket connected');
          // Subscribe to ticker channel for major symbols
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels: ['ticker'],
            product_ids: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'ADA-USD']
          }));
          resolve(ws);
        });
        
        ws.on('error', (error) => {
          console.error('Coinbase Pro WebSocket error:', error);
          reject(error);
        });
        
        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.terminate();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      });
    });
  }
}

export class BlockchainInfoProvider implements CryptoProvider {
  id = 'blockchain';
  priority = 8;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 300; // No official limit but being conservative
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      // Blockchain.info primarily focuses on Bitcoin
      if (symbols.includes('BTC')) {
        try {
          const [tickerResponse, statsResponse] = await Promise.all([
            fetch('https://api.blockchain.info/ticker'),
            fetch('https://api.blockchain.info/stats')
          ]);
          
          if (tickerResponse.ok && statsResponse.ok) {
            const [ticker, stats] = await Promise.all([
              tickerResponse.json(),
              statsResponse.json()
            ]);
            
            results.push(normalizeMarketData({
              symbol: 'BTC',
              name: 'Bitcoin',
              price: ticker.USD.last,
              volume: stats.trade_volume_usd,
              marketCap: stats.market_price_usd * stats.totalbc / 100000000
            }, this.id, 'crypto'));
          }
        } catch (error) {
          console.error('Error fetching BTC from Blockchain.info:', error);
        }
      }
      
      return results;
    });
  }
}

export class CoinLoreProvider implements CryptoProvider {
  id = 'coinlore';
  priority = 9;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 600; // 10 requests per minute
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      // CoinLore uses different approach - get tickers and filter by symbols
      const url = 'https://api.coinlore.net/api/tickers/';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinLore API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: UnifiedMarketData[] = [];
      
      if (data.data) {
        data.data.forEach((coin: any) => {
          if (symbols.includes(coin.symbol)) {
            results.push(normalizeMarketData({
              symbol: coin.symbol,
              name: coin.name,
              price: parseFloat(coin.price_usd),
              change24h: parseFloat(coin.percent_change_24h),
              volume: parseFloat(coin.volume24),
              marketCap: parseFloat(coin.market_cap_usd)
            }, this.id, 'crypto'));
          }
        });
      }
      
      return results;
    });
  }
}

export class BitPayProvider implements CryptoProvider {
  id = 'bitpay';
  priority = 10;
  capabilities: ('live' | 'snapshot' | 'history')[] = ['snapshot'];
  rateLimit = 300; // Conservative estimate
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      // BitPay has rates API for major cryptocurrencies
      const response = await fetch('https://bitpay.com/api/rates');
      if (!response.ok) {
        throw new Error(`BitPay API error: ${response.statusText}`);
      }
      
      const rates = await response.json();
      
      rates.forEach((rate: any) => {
        if (symbols.includes(rate.code) && rate.code !== 'USD') {
          results.push(normalizeMarketData({
            symbol: rate.code,
            name: rate.name,
            price: rate.rate
          }, this.id, 'crypto'));
        }
      });
      
      return results;
    });
  }
}

// === ADDITIONAL FREE PROVIDERS ===

export class SimpleSwapProvider implements CryptoProvider {
  id = 'simpleswap';
  priority = 2; // High priority - truly free
  capabilities: ('live' | 'snapshot')[] = ['snapshot'];
  rateLimit = 600;
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const results: UnifiedMarketData[] = [];
      
      for (const symbol of symbols.slice(0, 5)) { // Limit to avoid overwhelming
        try {
          const url = `https://api.simpleswap.io/get_estimated?fixed=false&currency_from=${symbol.toLowerCase()}&currency_to=usd&amount=1`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json();
            if (data && !isNaN(parseFloat(data))) {
              results.push(normalizeMarketData({
                symbol: symbol.toUpperCase(),
                name: symbol,
                price: parseFloat(data),
                priceUsd: parseFloat(data)
              }, this.id, 'crypto'));
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

export class MobulaProvider implements CryptoProvider {
  id = 'mobula';
  priority = 3;
  capabilities: ('live' | 'snapshot')[] = ['snapshot'];
  rateLimit = 1000; // Most generous free plan
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      const symbolsQuery = symbols.join(',');
      const url = `https://api.mobula.io/api/1/market/multi-data?assets=${symbolsQuery}&blockchain=1`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Mobula API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.data ? data.data.map((item: any) => normalizeMarketData(item, this.id, 'crypto')) : [];
    });
  }
}

export class CoinLayerProvider implements CryptoProvider {
  id = 'coinlayer';
  priority = 4;
  capabilities: ('live' | 'snapshot')[] = ['snapshot'];
  rateLimit = 1000;
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    const circuitBreaker = getCircuitBreaker('crypto', this.id);
    
    return circuitBreaker.execute(async () => {
      // Use free access key (1000 requests/month free)
      const symbolsQuery = symbols.join(',');
      const url = `https://api.coinlayer.com/live?access_key=demo&symbols=${symbolsQuery}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinLayer API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const results: UnifiedMarketData[] = [];
      
      if (data.rates) {
        symbols.forEach(symbol => {
          const rate = data.rates[symbol];
          if (rate) {
            results.push(normalizeMarketData({
              symbol: symbol,
              name: symbol,
              price: rate,
              priceUsd: rate
            }, this.id, 'crypto'));
          }
        });
      }
      
      return results;
    });
  }
}

// Provider registry and failover logic
export class CryptoProviderRegistry {
  private providers: CryptoProvider[];
  private activeConnections: Map<string, WebSocket> = new Map();
  
  constructor() {
    this.providers = [
      new BinanceProvider(),
      new CoinGeckoProvider(),
      new CoinPaprikaProvider(),
      new KrakenProvider(),
      new CryptoCompareProvider(),
      new CoinCapProvider(),
      new CoinbaseProProvider(),
      new BlockchainInfoProvider(),
      new CoinLoreProvider(),
      new BitPayProvider(),
      new SimpleSwapProvider(),
      new MobulaProvider(),
      new CoinLayerProvider()
    ].sort((a, b) => a.priority - b.priority);
  }
  
  async fetchSnapshot(symbols: string[]): Promise<UnifiedMarketData[]> {
    // Get optimized provider order
    const optimizedProviders = cryptoProviderOptimizer.optimizeProviderOrder(this.providers);
    
    let attemptedProviders = 0;
    
    // First try with performance filtering
    for (const provider of optimizedProviders) {
      if (!provider.capabilities.includes('snapshot')) continue;
      
      // Runtime assertion to ensure provider methods exist
      if (typeof provider.fetchSnapshot !== 'function') {
        console.error(`Provider ${provider.id} is corrupted - missing fetchSnapshot method`);
        continue;
      }
      
      // Skip providers that should be avoided
      if (cryptoProviderOptimizer.shouldSkipProvider(provider.id)) {
        console.log(`Skipping provider ${provider.id} - poor performance metrics`);
        continue;
      }
      
      attemptedProviders++;
      
      try {
        const data = await cryptoProviderOptimizer.recordProviderRequest(
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
    
    // If all providers are skipped, try without performance filtering as fallback
    if (attemptedProviders === 0) {
      console.log('All providers skipped by optimizer - trying fallback without performance filtering');
      for (const provider of this.providers) {
        if (!provider.capabilities.includes('snapshot')) continue;
        
        // Runtime assertion for fallback too
        if (typeof provider.fetchSnapshot !== 'function') {
          console.error(`Fallback provider ${provider.id} is corrupted - missing fetchSnapshot method`);
          continue;
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
    
    throw new Error('All crypto providers failed');
  }
  
  async fetchHistory(symbol: string, range: string): Promise<any[]> {
    for (const provider of this.providers) {
      if (!provider.capabilities.includes('history') || !provider.fetchHistory) continue;
      
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
    
    return []; // Return empty array if all providers fail
  }
  
  async connectLiveStreams(symbols: string[]): Promise<WebSocket[]> {
    const connections: WebSocket[] = [];
    
    for (const provider of this.providers) {
      if (!provider.capabilities.includes('live') || !provider.connect) continue;
      
      try {
        const ws = await provider.connect();
        if (ws) {
          connections.push(ws);
          this.activeConnections.set(provider.id, ws);
        }
      } catch (error) {
        console.error(`Failed to connect to ${provider.id}:`, error);
      }
    }
    
    return connections;
  }
  
  getProviderStats() {
    const recommendations = cryptoProviderOptimizer.getProviderRecommendations();
    const performanceStats = cryptoProviderOptimizer.getProviderStats();
    
    return this.providers.map(provider => {
      const perfStat = performanceStats.find(p => p.id === provider.id);
      const metrics = cryptoProviderOptimizer.getProviderMetrics(provider.id);
      const dynamicPriority = cryptoProviderOptimizer.getProviderDynamicPriority(provider);
      
      return {
        id: provider.id,
        priority: provider.priority,
        dynamicPriority: dynamicPriority,
        capabilities: provider.capabilities,
        circuitBreakerState: getCircuitBreaker('crypto', provider.id).getState(),
        isConnected: this.activeConnections.has(provider.id),
        performance: perfStat || null,
        recommendation: recommendations.fast.includes(provider.id) ? 'fast' :
                      recommendations.reliable.includes(provider.id) ? 'reliable' :
                      recommendations.avoid.includes(provider.id) ? 'avoid' : 'normal'
      };
    });
  }
}
