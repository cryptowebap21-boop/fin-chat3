/**
 * Background Worker for Market Data
 * 
 * This worker runs independently of user requests, fetching crypto and stock data
 * at fixed intervals. It updates the in-memory cache and persists to database.
 * 
 * Architecture:
 * - Fetches data every 5-10 seconds (configurable)
 * - Stores in memory cache for fast access
 * - Persists to database for fallback
 * - Broadcasts updates via WebSocket/SSE to connected clients
 * - Implements exponential backoff on failures
 */

import { CryptoProviderRegistry } from '../providers/cryptoProviders.js';
import { StockProviderRegistry } from '../providers/stockProviders.js';
import { marketCache, CACHE_TTL } from '../utils/cache.js';
import { storage } from '../storage.js';
import { type UnifiedMarketData } from '@shared/schema';

export interface WorkerConfig {
  cryptoInterval: number;     // Interval in milliseconds for crypto updates (default: 5000ms)
  stockInterval: number;       // Interval in milliseconds for stock updates (default: 10000ms)
  retryAttempts: number;       // Number of retry attempts on failure (default: 3)
  retryBackoffMs: number;      // Base backoff time in milliseconds (default: 1000ms)
}

export class MarketDataWorker {
  private cryptoRegistry: CryptoProviderRegistry;
  private stockRegistry: StockProviderRegistry;
  private config: WorkerConfig;
  private cryptoIntervalId?: NodeJS.Timeout;
  private stockIntervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private updateCallbacks: Array<(data: UnifiedMarketData[], kind: 'crypto' | 'stock') => void> = [];
  
  // Track default symbols to fetch
  private cryptoSymbols: string[] = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'LTC'];
  private stockSymbols: string[] = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'SPY', 'QQQ'];
  
  constructor(config: Partial<WorkerConfig> = {}) {
    this.cryptoRegistry = new CryptoProviderRegistry();
    this.stockRegistry = new StockProviderRegistry();
    
    // Set default config values
    this.config = {
      cryptoInterval: config.cryptoInterval || 5000,  // 5 seconds for crypto
      stockInterval: config.stockInterval || 10000,    // 10 seconds for stocks
      retryAttempts: config.retryAttempts || 3,
      retryBackoffMs: config.retryBackoffMs || 1000,
    };
  }
  
  /**
   * Start the background worker
   * Begins fetching market data at configured intervals
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  Market data worker is already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 Starting market data background worker...');
    console.log(`   - Crypto updates: every ${this.config.cryptoInterval}ms`);
    console.log(`   - Stock updates: every ${this.config.stockInterval}ms`);
    
    // Start fetching immediately, then set up intervals
    this.fetchCryptoData();
    this.fetchStockData();
    
    // Set up periodic fetching
    this.cryptoIntervalId = setInterval(() => {
      this.fetchCryptoData();
    }, this.config.cryptoInterval);
    
    this.stockIntervalId = setInterval(() => {
      this.fetchStockData();
    }, this.config.stockInterval);
    
    console.log('✅ Market data worker started successfully');
  }
  
  /**
   * Stop the background worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️  Market data worker is not running');
      return;
    }
    
    if (this.cryptoIntervalId) {
      clearInterval(this.cryptoIntervalId);
      this.cryptoIntervalId = undefined;
    }
    
    if (this.stockIntervalId) {
      clearInterval(this.stockIntervalId);
      this.stockIntervalId = undefined;
    }
    
    this.isRunning = false;
    console.log('🛑 Market data worker stopped');
  }
  
  /**
   * Register a callback to be notified when data is updated
   * Used for WebSocket/SSE broadcasting
   */
  onUpdate(callback: (data: UnifiedMarketData[], kind: 'crypto' | 'stock') => void): void {
    this.updateCallbacks.push(callback);
  }
  
  /**
   * Fetch cryptocurrency data with retry logic
   */
  private async fetchCryptoData(): Promise<void> {
    await this.fetchWithRetry('crypto', this.cryptoSymbols);
  }
  
  /**
   * Fetch stock data with retry logic
   */
  private async fetchStockData(): Promise<void> {
    await this.fetchWithRetry('stock', this.stockSymbols);
  }
  
  /**
   * Fetch market data with exponential backoff retry
   */
  private async fetchWithRetry(
    kind: 'crypto' | 'stock',
    symbols: string[],
    attempt: number = 1
  ): Promise<void> {
    const cacheKey = `${kind}-${symbols.join(',')}-snapshot`;
    
    try {
      let data: UnifiedMarketData[];
      
      // Fetch from appropriate provider registry
      if (kind === 'crypto') {
        data = await this.cryptoRegistry.fetchSnapshot(symbols);
      } else {
        data = await this.stockRegistry.fetchSnapshot(symbols);
      }
      
      // Cache the data with appropriate TTL
      const ttl = kind === 'crypto' ? CACHE_TTL.CRYPTO_SNAPSHOT : CACHE_TTL.STOCK_SNAPSHOT;
      marketCache.set(cacheKey, data, ttl);
      
      // Persist to database
      await this.saveToDatabase(data);
      
      // Notify all registered callbacks (for WebSocket/SSE broadcasting)
      this.notifyUpdateCallbacks(data, kind);
      
      // Log success (only periodically to avoid spam)
      if (attempt === 1 && Math.random() < 0.1) { // Log ~10% of successful fetches
        console.log(`📊 ${kind} data updated: ${data.length} symbols fetched`);
      }
      
    } catch (error) {
      console.error(`❌ Error fetching ${kind} data (attempt ${attempt}/${this.config.retryAttempts}):`, error);
      
      // Retry with exponential backoff
      if (attempt < this.config.retryAttempts) {
        const backoffDelay = this.config.retryBackoffMs * Math.pow(2, attempt - 1);
        console.log(`   Retrying in ${backoffDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        await this.fetchWithRetry(kind, symbols, attempt + 1);
      } else {
        console.error(`   Max retry attempts reached for ${kind} data. Using cached/database fallback.`);
      }
    }
  }
  
  /**
   * Save market data to database
   */
  private async saveToDatabase(data: UnifiedMarketData[]): Promise<void> {
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
      console.error('Error saving market data to database:', error);
    }
  }
  
  /**
   * Notify all registered callbacks about data updates
   */
  private notifyUpdateCallbacks(data: UnifiedMarketData[], kind: 'crypto' | 'stock'): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(data, kind);
      } catch (error) {
        console.error('Error in update callback:', error);
      }
    });
  }
  
  /**
   * Get current worker status
   */
  getStatus(): { isRunning: boolean; config: WorkerConfig; callbackCount: number } {
    return {
      isRunning: this.isRunning,
      config: this.config,
      callbackCount: this.updateCallbacks.length
    };
  }
  
  /**
   * Update symbols to fetch
   */
  setSymbols(kind: 'crypto' | 'stock', symbols: string[]): void {
    if (kind === 'crypto') {
      this.cryptoSymbols = symbols;
      console.log(`Updated crypto symbols: ${symbols.join(', ')}`);
    } else {
      this.stockSymbols = symbols;
      console.log(`Updated stock symbols: ${symbols.join(', ')}`);
    }
  }
}

// Export singleton instance
export const marketDataWorker = new MarketDataWorker();
