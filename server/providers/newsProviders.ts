import { Parser } from 'xml2js';
import { getCircuitBreaker } from '../utils/circuitBreaker.js';
import { type NewsArticleData } from '@shared/schema';

export interface NewsProvider {
  id: string;
  category: 'crypto' | 'stocks' | 'general';
  url: string;
  rateLimit: number;
  
  fetchNews(): Promise<NewsArticleData[]>;
}

export class CryptoNewsProvider implements NewsProvider {
  constructor(
    public id: string,
    public category: 'crypto' | 'stocks' | 'general',
    public url: string,
    public rateLimit: number = 10
  ) {}
  
  async fetchNews(): Promise<NewsArticleData[]> {
    const circuitBreaker = getCircuitBreaker('news', this.id);
    
    return circuitBreaker.execute(async () => {
      const response = await fetch(this.url, {
        headers: {
          'User-Agent': 'FinChat/1.0 (Financial News Aggregator)'
        }
      });
      
      if (!response.ok) {
        throw new Error(`${this.id} RSS fetch error: ${response.statusText}`);
      }
      
      const xmlText = await response.text();
      const parser = new Parser();
      const result = await parser.parseStringPromise(xmlText);
      
      const items = result.rss?.channel?.[0]?.item || result.feed?.entry || [];
      
      return items.slice(0, 20).map((item: any) => this.parseItem(item)).filter(Boolean) as NewsArticleData[];
    });
  }
  
  private parseItem(item: any): NewsArticleData | null {
    try {
      // Handle both RSS and Atom formats
      const title = item.title?.[0]?._ || item.title?.[0] || item.title;
      const description = item.description?.[0] || item.summary?.[0]?._ || item.summary?.[0];
      const link = item.link?.[0]?.$ ? item.link[0].$.href : (item.link?.[0] || item.link);
      const pubDate = item.pubDate?.[0] || item.published?.[0] || item.updated?.[0];
      
      if (!title || !link) return null;
      
      // Extract image URL from description or enclosure
      let imageUrl: string | undefined;
      if (item.enclosure?.[0]?.$ && item.enclosure[0].$.type?.startsWith('image/')) {
        imageUrl = item.enclosure[0].$.url;
      } else if (description) {
        const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
        if (imgMatch) imageUrl = imgMatch[1];
      }
      
      return {
        title: this.cleanText(title),
        description: description ? this.cleanText(description) : undefined,
        url: link,
        imageUrl,
        source: this.id,
        category: this.category,
        publishedAt: new Date(pubDate || Date.now()).toISOString()
      };
    } catch (error) {
      console.error(`Error parsing item from ${this.id}:`, error);
      return null;
    }
  }
  
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 500); // Limit length
  }
}

// News Provider Registry
export class NewsProviderRegistry {
  private providers: NewsProvider[];
  private cache: Map<string, { data: NewsArticleData[]; timestamp: number }> = new Map();
  private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes
  
  constructor() {
    this.providers = [
      // Crypto News Sources
      new CryptoNewsProvider('cointelegraph', 'crypto', 'https://cointelegraph.com/rss'),
      new CryptoNewsProvider('bitcoinist', 'crypto', 'https://bitcoinist.com/feed'),
      new CryptoNewsProvider('newsbtc', 'crypto', 'https://www.newsbtc.com/feed'),
      new CryptoNewsProvider('cryptopotato', 'crypto', 'https://cryptopotato.com/feed'),
      new CryptoNewsProvider('coinjournal', 'crypto', 'https://coinjournal.net/news/feed/'),
      new CryptoNewsProvider('99bitcoins', 'crypto', 'https://99bitcoins.com/feed'),
      
      // Stock/Finance News Sources
      new CryptoNewsProvider('yahoo-finance', 'stocks', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=GSPC,DJI,^IXIC'),
      new CryptoNewsProvider('investing', 'stocks', 'https://www.investing.com/rss/news_25.rss'),
      new CryptoNewsProvider('marketwatch', 'stocks', 'https://feeds.marketwatch.com/marketwatch/topstories/'),
      new CryptoNewsProvider('reuters', 'stocks', 'http://feeds.reuters.com/reuters/businessNews'),
      new CryptoNewsProvider('seekingalpha', 'stocks', 'https://seekingalpha.com/market_currents.xml')
    ];
  }
  
  async fetchAllNews(category?: string): Promise<NewsArticleData[]> {
    const providers = category 
      ? this.providers.filter(p => p.category === category)
      : this.providers;
    
    const allNews: NewsArticleData[] = [];
    const fetchPromises = providers.map(async (provider) => {
      try {
        // Check cache first
        const cached = this.cache.get(provider.id);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
        
        const news = await provider.fetchNews();
        
        // Update cache
        this.cache.set(provider.id, {
          data: news,
          timestamp: Date.now()
        });
        
        return news;
      } catch (error) {
        console.error(`Failed to fetch news from ${provider.id}:`, error);
        return [];
      }
    });
    
    const results = await Promise.allSettled(fetchPromises);
    
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allNews.push(...result.value);
      }
    });
    
    // Deduplicate by URL and sort by published date
    const uniqueNews = this.deduplicateNews(allNews);
    return uniqueNews.sort((a, b) => 
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }
  
  private deduplicateNews(news: NewsArticleData[]): NewsArticleData[] {
    const seen = new Set<string>();
    const unique: NewsArticleData[] = [];
    
    for (const article of news) {
      // Create a simple hash based on title and URL
      const hash = `${article.title.toLowerCase().substring(0, 50)}-${article.url}`;
      
      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(article);
      }
    }
    
    return unique;
  }
  
  getProviderStats() {
    return this.providers.map(provider => ({
      id: provider.id,
      category: provider.category,
      url: provider.url,
      circuitBreakerState: getCircuitBreaker('news', provider.id).getState(),
      lastFetch: this.cache.get(provider.id)?.timestamp,
      articleCount: this.cache.get(provider.id)?.data.length || 0
    }));
  }
  
  clearCache() {
    this.cache.clear();
  }
}
