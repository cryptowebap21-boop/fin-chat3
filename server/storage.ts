import { type User, type InsertUser, type MarketData, type InsertMarketData, type NewsArticle, type InsertNewsArticle, type ChatConversation, type InsertChatConversation, type Watchlist, type InsertWatchlist } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Market data methods
  getMarketData(symbol: string, kind: "crypto" | "stock"): Promise<MarketData | undefined>;
  getLatestMarketData(kind?: "crypto" | "stock"): Promise<MarketData[]>;
  saveMarketData(data: InsertMarketData): Promise<MarketData>;
  getMarketDataBatch(symbols: string[], kind: "crypto" | "stock"): Promise<MarketData[]>;

  // News methods
  getLatestNews(category?: string, limit?: number): Promise<NewsArticle[]>;
  saveNewsArticle(article: InsertNewsArticle): Promise<NewsArticle>;
  getNewsByUrl(url: string): Promise<NewsArticle | undefined>;

  // Chat methods
  getChatConversation(id: string): Promise<ChatConversation | undefined>;
  saveChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>;
  updateChatConversation(id: string, messages: any[]): Promise<ChatConversation>;

  // Watchlist methods
  getWatchlist(userId?: string): Promise<Watchlist | undefined>;
  saveWatchlist(watchlist: InsertWatchlist): Promise<Watchlist>;
  updateWatchlist(id: string, symbols: string[]): Promise<Watchlist>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private marketData: Map<string, MarketData>;
  private newsArticles: Map<string, NewsArticle>;
  private chatConversations: Map<string, ChatConversation>;
  private watchlists: Map<string, Watchlist>;

  constructor() {
    this.users = new Map();
    this.marketData = new Map();
    this.newsArticles = new Map();
    this.chatConversations = new Map();
    this.watchlists = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getMarketData(symbol: string, kind: "crypto" | "stock"): Promise<MarketData | undefined> {
    const key = `${kind}-${symbol}`;
    return this.marketData.get(key);
  }

  async getLatestMarketData(kind?: "crypto" | "stock"): Promise<MarketData[]> {
    const allData = Array.from(this.marketData.values());
    if (kind) {
      return allData.filter(data => data.kind === kind);
    }
    return allData;
  }

  async saveMarketData(insertData: InsertMarketData): Promise<MarketData> {
    const id = randomUUID();
    const data: MarketData = { 
      ...insertData, 
      id, 
      timestamp: new Date(),
      change24h: insertData.change24h ?? null,
      volume: insertData.volume ?? null,
      marketCap: insertData.marketCap ?? null
    };
    const key = `${data.kind}-${data.symbol}`;
    this.marketData.set(key, data);
    return data;
  }

  async getMarketDataBatch(symbols: string[], kind: "crypto" | "stock"): Promise<MarketData[]> {
    const results: MarketData[] = [];
    for (const symbol of symbols) {
      const data = await this.getMarketData(symbol, kind);
      if (data) results.push(data);
    }
    return results;
  }

  async getLatestNews(category?: string, limit: number = 50): Promise<NewsArticle[]> {
    let articles = Array.from(this.newsArticles.values());
    
    if (category && category !== "all") {
      articles = articles.filter(article => article.category === category);
    }
    
    return articles
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
  }

  async saveNewsArticle(insertArticle: InsertNewsArticle): Promise<NewsArticle> {
    const id = randomUUID();
    const article: NewsArticle = { 
      ...insertArticle, 
      id, 
      createdAt: new Date(),
      content: insertArticle.content ?? null,
      description: insertArticle.description ?? null,
      imageUrl: insertArticle.imageUrl ?? null
    };
    this.newsArticles.set(article.url, article);
    return article;
  }

  async getNewsByUrl(url: string): Promise<NewsArticle | undefined> {
    return this.newsArticles.get(url);
  }

  async getChatConversation(id: string): Promise<ChatConversation | undefined> {
    return this.chatConversations.get(id);
  }

  async saveChatConversation(insertConversation: InsertChatConversation): Promise<ChatConversation> {
    const id = randomUUID();
    const now = new Date();
    const conversation: ChatConversation = { 
      ...insertConversation, 
      id, 
      createdAt: now,
      updatedAt: now,
      messages: insertConversation.messages ?? []
    };
    this.chatConversations.set(id, conversation);
    return conversation;
  }

  async updateChatConversation(id: string, messages: any[]): Promise<ChatConversation> {
    const existing = this.chatConversations.get(id);
    if (!existing) {
      throw new Error("Conversation not found");
    }
    
    const updated: ChatConversation = {
      ...existing,
      messages,
      updatedAt: new Date()
    };
    
    this.chatConversations.set(id, updated);
    return updated;
  }

  async getWatchlist(userId?: string): Promise<Watchlist | undefined> {
    if (!userId) {
      // Return default watchlist
      return Array.from(this.watchlists.values())[0];
    }
    return Array.from(this.watchlists.values()).find(w => w.userId === userId);
  }

  async saveWatchlist(insertWatchlist: InsertWatchlist): Promise<Watchlist> {
    const id = randomUUID();
    const watchlist: Watchlist = { 
      ...insertWatchlist, 
      id, 
      createdAt: new Date(),
      name: insertWatchlist.name ?? "My Watchlist",
      userId: insertWatchlist.userId ?? null,
      symbols: insertWatchlist.symbols ?? []
    };
    this.watchlists.set(id, watchlist);
    return watchlist;
  }

  async updateWatchlist(id: string, symbols: string[]): Promise<Watchlist> {
    const existing = this.watchlists.get(id);
    if (!existing) {
      throw new Error("Watchlist not found");
    }
    
    const updated: Watchlist = {
      ...existing,
      symbols
    };
    
    this.watchlists.set(id, updated);
    return updated;
  }
}

export const storage = new MemStorage();
