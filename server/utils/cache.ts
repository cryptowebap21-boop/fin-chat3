class LRUCache<T> {
  private capacity: number;
  private cache: Map<string, { value: T; expiry: number }>;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
}

// Optimized cache instances for ultra-smooth performance
export const marketCache = new LRUCache(1000); // Increased capacity for more symbols
export const newsCache = new LRUCache(300); // More news articles cached
export const chartCache = new LRUCache(200); // More chart data cached

// High-performance TTLs for real-time feel
export const CACHE_TTL = {
  CRYPTO_SNAPSHOT: 15 * 1000, // 15 seconds - very fresh crypto data
  STOCK_SNAPSHOT: 30 * 1000,  // 30 seconds - still fresh stock data  
  NEWS: 5 * 60 * 1000,        // 5 minutes - news doesn't change that fast
  CHARTS: 60 * 1000,          // 1 minute - balance between freshness and performance
  PROVIDER_ROTATION: 45 * 1000 // 45 seconds - rotate providers to avoid rate limits
};

export { LRUCache };
