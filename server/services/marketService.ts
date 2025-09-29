import { CryptoProviderRegistry } from '../providers/cryptoProviders.js';
import { StockProviderRegistry } from '../providers/stockProviders.js';
import { marketCache, CACHE_TTL } from '../utils/cache.js';
import { storage } from '../storage.js';
import { type UnifiedMarketData } from '@shared/schema';

export class MarketService {
  private cryptoRegistry: CryptoProviderRegistry;
  private stockRegistry: StockProviderRegistry;
  private activeStreams: Map<string, any> = new Map();
  
  constructor() {
    this.cryptoRegistry = new CryptoProviderRegistry();
    this.stockRegistry = new StockProviderRegistry();
  }
  
  async getMarketSnapshot(kind: 'crypto' | 'stock', symbols: string[]): Promise<UnifiedMarketData[]> {
    const cacheKey = `${kind}-${symbols.join(',')}-snapshot`;
    
    // Check cache first
    const cached = marketCache.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }
    
    let data: UnifiedMarketData[] = [];
    
    try {
      if (kind === 'crypto') {
        data = await this.cryptoRegistry.fetchSnapshot(symbols);
      } else {
        data = await this.stockRegistry.fetchSnapshot(symbols);
      }
      
      // Cache with optimized TTL for ultra-smooth performance
      const ttl = kind === 'crypto' ? CACHE_TTL.CRYPTO_SNAPSHOT : CACHE_TTL.STOCK_SNAPSHOT;
      marketCache.set(cacheKey, data, ttl);
      
      // Store in persistent storage
      await this.saveMarketData(data);
      
    } catch (error) {
      console.error(`Market snapshot error for ${kind}:`, error);
      
      // Try to return cached data from storage as fallback
      const fallbackData = await storage.getMarketDataBatch(symbols, kind);
      if (fallbackData.length > 0) {
        data = fallbackData.map(item => ({
          symbol: item.symbol,
          name: item.name,
          price: parseFloat(item.price),
          change24h: item.change24h ? parseFloat(item.change24h) : undefined,
          volume: item.volume ? parseFloat(item.volume) : undefined,
          marketCap: item.marketCap ? parseFloat(item.marketCap) : undefined,
          timestamp: item.timestamp.toISOString(),
          source: item.source,
          kind: item.kind as 'crypto' | 'stock'
        }));
      }
    }
    
    return data;
  }
  
  async getMarketHistory(kind: 'crypto' | 'stock', symbol: string, range: string): Promise<any[]> {
    const cacheKey = `${kind}-${symbol}-${range}-history`;
    
    // Check cache first
    const cached = marketCache.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }
    
    let data: any[] = [];
    
    try {
      if (kind === 'crypto') {
        data = await this.cryptoRegistry.fetchHistory(symbol, range);
      } else {
        data = await this.stockRegistry.fetchHistory(symbol, range);
      }
      
      // Cache for 5 minutes
      marketCache.set(cacheKey, data, 5 * 60 * 1000);
      
    } catch (error) {
      console.error(`Market history error for ${kind} ${symbol}:`, error);
    }
    
    return data;
  }
  
  private async saveMarketData(data: UnifiedMarketData[]): Promise<void> {
    try {
      for (const item of data) {
        await storage.saveMarketData({
          symbol: item.symbol,
          name: item.name,
          price: item.price.toString(),
          change24h: item.change24h?.toString(),
          volume: item.volume?.toString(),
          marketCap: item.marketCap?.toString(),
          source: item.source,
          kind: item.kind
        });
      }
    } catch (error) {
      console.error('Error saving market data:', error);
    }
  }
  
  async initializeLiveStreams(): Promise<void> {
    try {
      // Initialize crypto live streams
      const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK'];
      const connections = await this.cryptoRegistry.connectLiveStreams(cryptoSymbols);
      
      connections.forEach((ws, index) => {
        this.activeStreams.set(`crypto-stream-${index}`, ws);
      });
      
      console.log(`Initialized ${connections.length} crypto live streams`);
    } catch (error) {
      console.error('Error initializing live streams:', error);
    }
  }
  
  getServiceHealth() {
    return {
      cryptoProviders: this.cryptoRegistry.getProviderStats(),
      stockProviders: this.stockRegistry.getProviderStats(),
      cacheStats: marketCache.getStats(),
      activeStreams: this.activeStreams.size
    };
  }
  
  // Default symbols for each market type
  getDefaultSymbols(kind: 'crypto' | 'stock'): string[] {
    if (kind === 'crypto') {
      return ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'LTC'];
    } else {
      return ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'SPY', 'QQQ'];
    }
  }
}
