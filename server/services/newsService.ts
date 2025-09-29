import { NewsProviderRegistry } from '../providers/newsProviders.js';
import { newsCache } from '../utils/cache.js';
import { storage } from '../storage.js';
import { type NewsArticleData } from '@shared/schema';

export class NewsService {
  private newsRegistry: NewsProviderRegistry;
  private lastFetchTime: number = 0;
  private readonly fetchInterval = 10 * 60 * 1000; // 10 minutes
  
  constructor() {
    this.newsRegistry = new NewsProviderRegistry();
    this.startPeriodicFetch();
  }
  
  async getNews(category?: string, limit: number = 50): Promise<NewsArticleData[]> {
    const cacheKey = `news-${category || 'all'}-${limit}`;
    
    // Check cache first
    const cached = newsCache.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }
    
    let news: NewsArticleData[] = [];
    
    try {
      // Try to fetch from providers first
      news = await this.newsRegistry.fetchAllNews(category);
      
      if (news.length > 0) {
        // Save to storage
        await this.saveNewsArticles(news);
        
        // Cache for 10 minutes
        newsCache.set(cacheKey, news.slice(0, limit), this.fetchInterval);
      } else {
        // Fallback to storage
        const fallbackNews = await storage.getLatestNews(category, limit);
        news = this.transformStorageNewsToAPIFormat(fallbackNews);
      }
      
    } catch (error) {
      console.error('Error fetching news:', error);
      
      // Fallback to storage
      const fallbackNews = await storage.getLatestNews(category, limit);
      news = this.transformStorageNewsToAPIFormat(fallbackNews);
    }
    
    return news.slice(0, limit);
  }
  
  private transformStorageNewsToAPIFormat(storageNews: any[]): NewsArticleData[] {
    return storageNews.map(article => ({
      title: article.title,
      description: article.description || undefined,
      content: article.content || undefined,
      url: article.url,
      imageUrl: article.imageUrl || undefined,
      source: article.source,
      category: ['crypto', 'stocks', 'general'].includes(article.category) 
        ? article.category as 'crypto' | 'stocks' | 'general'
        : 'general',
      publishedAt: article.publishedAt instanceof Date 
        ? article.publishedAt.toISOString()
        : article.publishedAt
    }));
  }

  private async saveNewsArticles(articles: NewsArticleData[]): Promise<void> {
    try {
      for (const article of articles) {
        // Check if article already exists
        const existing = await storage.getNewsByUrl(article.url);
        if (!existing) {
          await storage.saveNewsArticle({
            title: article.title,
            description: article.description,
            content: undefined, // We don't fetch full content from RSS
            url: article.url,
            imageUrl: article.imageUrl,
            source: article.source,
            category: article.category,
            publishedAt: new Date(article.publishedAt)
          });
        }
      }
    } catch (error) {
      console.error('Error saving news articles:', error);
    }
  }
  
  private startPeriodicFetch(): void {
    // Initial fetch
    this.fetchAndCacheNews();
    
    // Set up periodic fetching
    setInterval(() => {
      this.fetchAndCacheNews();
    }, this.fetchInterval);
  }
  
  private async fetchAndCacheNews(): Promise<void> {
    try {
      console.log('Fetching news from all sources...');
      
      // Fetch all categories
      const allNews = await this.newsRegistry.fetchAllNews();
      const cryptoNews = allNews.filter(n => n.category === 'crypto');
      const stockNews = allNews.filter(n => n.category === 'stocks');
      
      // Save to storage
      await this.saveNewsArticles(allNews);
      
      // Update cache
      newsCache.set('news-all-50', allNews.slice(0, 50), this.fetchInterval);
      newsCache.set('news-crypto-50', cryptoNews.slice(0, 50), this.fetchInterval);
      newsCache.set('news-stocks-50', stockNews.slice(0, 50), this.fetchInterval);
      
      this.lastFetchTime = Date.now();
      
      console.log(`Fetched ${allNews.length} news articles (${cryptoNews.length} crypto, ${stockNews.length} stocks)`);
      
    } catch (error) {
      console.error('Error in periodic news fetch:', error);
    }
  }
  
  getFeaturedNews(category?: string): Promise<NewsArticleData | undefined> {
    return this.getNews(category, 1).then(news => news[0]);
  }
  
  getServiceHealth() {
    return {
      providers: this.newsRegistry.getProviderStats(),
      cacheStats: newsCache.getStats(),
      lastFetchTime: this.lastFetchTime,
      nextFetchIn: Math.max(0, this.fetchInterval - (Date.now() - this.lastFetchTime))
    };
  }
  
  clearCache(): void {
    this.newsRegistry.clearCache();
    newsCache.clear();
  }
}
