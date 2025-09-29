import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for basic auth if needed
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Market data schema for caching
export const marketData = pgTable("market_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  price: decimal("price", { precision: 20, scale: 8 }).notNull(),
  change24h: decimal("change24h", { precision: 10, scale: 4 }),
  volume: decimal("volume", { precision: 20, scale: 2 }),
  marketCap: decimal("market_cap", { precision: 20, scale: 2 }),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  source: text("source").notNull(),
  kind: text("kind").notNull(), // "crypto" | "stock"
});

// News articles schema
export const newsArticles = pgTable("news_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  content: text("content"),
  url: text("url").notNull(),
  imageUrl: text("image_url"),
  source: text("source").notNull(),
  category: text("category").notNull(), // "crypto" | "stocks" | "general"
  publishedAt: timestamp("published_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Chat conversations schema
export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messages: jsonb("messages").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// User watchlists
export const watchlists = pgTable("watchlists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  symbols: jsonb("symbols").notNull().default([]),
  name: text("name").notNull().default("My Watchlist"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schemas for API data structures
export const unifiedMarketDataSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change24h: z.number().optional(),
  volume: z.number().optional(),
  marketCap: z.number().optional(),
  timestamp: z.string(),
  source: z.string(),
  kind: z.enum(["crypto", "stock"]),
});

export const newsArticleSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  url: z.string(),
  imageUrl: z.string().optional(),
  source: z.string(),
  category: z.enum(["crypto", "stocks", "general"]),
  publishedAt: z.string(),
});

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
});

export const calculatorInputSchema = z.object({
  type: z.enum(["roi", "pl", "compound", "conversion"]),
  inputs: z.record(z.union([z.string(), z.number()])),
});

export const taxCalculationSchema = z.object({
  assetType: z.string(),
  symbol: z.string(),
  quantity: z.number(),
  purchasePrice: z.number(),
  salePrice: z.number(),
  purchaseDate: z.string(),
  saleDate: z.string().optional(),
  fees: z.number().optional(),
  region: z.string().default("US"),
  taxBracket: z.number(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  timestamp: true,
});

export const insertNewsArticleSchema = createInsertSchema(newsArticles).omit({
  id: true,
  createdAt: true,
});

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlists).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type MarketData = typeof marketData.$inferSelect;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type NewsArticle = typeof newsArticles.$inferSelect;
export type InsertNewsArticle = z.infer<typeof insertNewsArticleSchema>;
export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = z.infer<typeof insertChatConversationSchema>;
export type Watchlist = typeof watchlists.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

export type UnifiedMarketData = z.infer<typeof unifiedMarketDataSchema>;
export type NewsArticleData = z.infer<typeof newsArticleSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type CalculatorInput = z.infer<typeof calculatorInputSchema>;
export type TaxCalculation = z.infer<typeof taxCalculationSchema>;
