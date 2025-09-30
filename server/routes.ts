import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { marketDataWorker } from "./workers/marketDataWorker.js";
import { marketCache } from "./utils/cache.js";
import { NewsService } from "./services/newsService.js";
import { ChatService } from "./services/chatService.js";
import { CalculatorService } from "./services/calculatorService.js";
import { chatMessageSchema, calculatorInputSchema, taxCalculationSchema } from "@shared/schema";
import { healthCheckService } from "./utils/healthCheck.js";
import { type UnifiedMarketData } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize services (no market service - using worker instead)
  const newsService = new NewsService();
  const chatService = new ChatService();
  const calculatorService = new CalculatorService();
  
  // WebSocket server for real-time data
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active SSE connections
  const sseConnections = new Set<any>();
  
  // WebSocket connection handling
  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe') {
          // Handle subscription to market data streams
          console.log('Client subscribed to:', data.symbols, data.kind);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Broadcast market updates to WebSocket clients
  function broadcastMarketUpdate(data: UnifiedMarketData[], kind: 'crypto' | 'stock') {
    const message = JSON.stringify({
      type: 'market_update',
      kind,
      data,
      timestamp: new Date().toISOString()
    });
    
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Register callback with worker to broadcast updates when data is refreshed
  marketDataWorker.onUpdate((data: UnifiedMarketData[], kind: 'crypto' | 'stock') => {
    // Broadcast via WebSocket
    broadcastMarketUpdate(data, kind);
    
    // Broadcast via SSE
    const message = `event: market_update\ndata: ${JSON.stringify({ kind, data, timestamp: new Date().toISOString() })}\n\n`;
    sseConnections.forEach((connection: any) => {
      try {
        if (connection.kind === kind || !connection.kind) {
          connection.res.write(message);
        }
      } catch (error) {
        console.error('SSE broadcast error:', error);
        sseConnections.delete(connection);
      }
    });
  });
  
  // Chat Assistant API
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      if (!chatService.isConfigured()) {
        return res.status(503).json({ 
          error: 'AI chat service is not configured. Please add OPENROUTER_API_KEY to environment variables.' 
        });
      }
      
      const result = await chatService.sendMessage(message, conversationId);
      res.json(result);
      
    } catch (error) {
      console.error('Chat API error:', error);
      res.status(500).json({ 
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Chat streaming endpoint
  app.post('/api/chat/stream', async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      
      if (!chatService.isConfigured()) {
        return res.status(503).json({ 
          error: 'AI chat service is not configured' 
        });
      }
      
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const stream = await chatService.streamMessage(message, conversationId);
      
      for await (const chunk of stream) {
        res.write(chunk);
      }
      
      res.end();
      
    } catch (error) {
      console.error('Chat stream error:', error);
      res.status(500).json({ error: 'Failed to stream chat response' });
    }
  });
  
  // Markets API - Serves data ONLY from cache/database (backend-first architecture)
  app.get('/api/markets/snapshot', async (req, res) => {
    try {
      const { kind = 'crypto', symbols } = req.query;
      
      if (!['crypto', 'stock'].includes(kind as string)) {
        return res.status(400).json({ error: 'Kind must be "crypto" or "stock"' });
      }
      
      const defaultCryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'LTC'];
      const defaultStockSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'SPY', 'QQQ'];
      
      let symbolList: string[];
      if (symbols && typeof symbols === 'string') {
        symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
      } else {
        symbolList = kind === 'crypto' ? defaultCryptoSymbols : defaultStockSymbols;
      }
      
      // Try cache first (updated by background worker)
      const cacheKey = `${kind}-${symbolList.join(',')}-snapshot`;
      let data = marketCache.get(cacheKey);
      
      if (!data || !Array.isArray(data)) {
        // Fallback to database if cache miss
        const dbData = await storage.getMarketDataBatch(symbolList, kind as 'crypto' | 'stock');
        data = dbData.map(item => ({
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
      
      res.json(data);
      
    } catch (error) {
      console.error('Market snapshot error:', error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });
  
  // Server-Sent Events for real-time market data
  // NOTE: Updates are now pushed by the background worker, not by this endpoint
  app.get('/api/markets/stream', (req, res) => {
    const { kind = 'crypto', symbols } = req.query;
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    
    const connection = { res, kind, symbols };
    sseConnections.add(connection);
    
    // Send initial connection confirmation
    res.write('event: connected\n');
    res.write(`data: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    
    // Send current data immediately from cache
    const defaultCryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'LTC'];
    const defaultStockSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'SPY', 'QQQ'];
    
    let symbolList: string[];
    if (symbols && typeof symbols === 'string') {
      symbolList = symbols.split(',').map((s: string) => s.trim().toUpperCase());
    } else {
      symbolList = kind === 'crypto' ? defaultCryptoSymbols : defaultStockSymbols;
    }
    
    const cacheKey = `${kind}-${symbolList.join(',')}-snapshot`;
    const cachedData = marketCache.get(cacheKey);
    
    if (cachedData) {
      res.write('event: market_update\n');
      res.write(`data: ${JSON.stringify({ kind, data: cachedData, timestamp: new Date().toISOString() })}\n\n`);
    }
    
    req.on('close', () => {
      sseConnections.delete(connection);
    });
  });
  
  // Market history API - Returns latest price data
  // NOTE: Historical data (1m, 1h, 1d ranges) not supported in this version
  // Only returns latest real-time price
  app.get('/api/markets/history', async (req, res) => {
    try {
      const { kind = 'crypto', symbol } = req.query;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ error: 'Symbol is required' });
      }
      
      // Return latest price data from cache/database
      const symbolUpper = symbol.toUpperCase();
      const cacheKey = `${kind}-${symbolUpper}-snapshot`;
      let data = marketCache.get(cacheKey);
      
      if (!data) {
        // Fallback to database
        const dbData = await storage.getMarketData(symbolUpper, kind as 'crypto' | 'stock');
        if (dbData) {
          data = [{
            timestamp: dbData.timestamp.getTime(),
            close: parseFloat(dbData.price),
            open: parseFloat(dbData.price),
            high: parseFloat(dbData.price),
            low: parseFloat(dbData.price),
            volume: dbData.volume ? parseFloat(dbData.volume) : undefined
          }];
        } else {
          data = [];
        }
      } else if (Array.isArray(data)) {
        // Convert UnifiedMarketData to chart data format
        data = data.filter((item: any) => item.symbol === symbolUpper).map((item: any) => ({
          timestamp: new Date(item.timestamp).getTime(),
          close: item.price,
          open: item.price,
          high: item.price,
          low: item.price,
          volume: item.volume
        }));
      }
      
      res.json(data);
      
    } catch (error) {
      console.error('Market history error:', error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });
  
  // News API
  app.get('/api/news', async (req, res) => {
    try {
      const { category, limit } = req.query;
      
      const limitNum = limit ? parseInt(limit as string) : 50;
      const categoryStr = category && category !== 'all' ? category as string : undefined;
      
      const news = await newsService.getNews(categoryStr, limitNum);
      res.json(news);
      
    } catch (error) {
      console.error('News API error:', error);
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  });
  
  // Featured news API
  app.get('/api/news/featured', async (req, res) => {
    try {
      const { category } = req.query;
      const categoryStr = category && category !== 'all' ? category as string : undefined;
      
      const featured = await newsService.getFeaturedNews(categoryStr);
      res.json(featured || null);
      
    } catch (error) {
      console.error('Featured news error:', error);
      res.status(500).json({ error: 'Failed to fetch featured news' });
    }
  });
  
  // Calculator APIs
  app.post('/api/calculators/roi', async (req, res) => {
    try {
      const inputs = req.body;
      const result = calculatorService.calculateROI(inputs);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Calculation error' });
    }
  });
  
  app.post('/api/calculators/pl', async (req, res) => {
    try {
      const inputs = req.body;
      const result = calculatorService.calculateProfitLoss(inputs);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Calculation error' });
    }
  });
  
  app.post('/api/calculators/compound', async (req, res) => {
    try {
      const inputs = req.body;
      const result = calculatorService.calculateCompoundInterest(inputs);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Calculation error' });
    }
  });
  
  app.post('/api/calculators/convert', async (req, res) => {
    try {
      const inputs = req.body;
      
      // Get current market prices for conversion from cache/database
      const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA'];
      const cacheKey = `crypto-${cryptoSymbols.join(',')}-snapshot`;
      let marketData = marketCache.get(cacheKey);
      
      if (!marketData || !Array.isArray(marketData)) {
        const dbData = await storage.getMarketDataBatch(cryptoSymbols, 'crypto');
        marketData = dbData.map(item => ({
          symbol: item.symbol,
          price: parseFloat(item.price)
        }));
      }
      
      const prices: Record<string, number> = { USD: 1 };
      if (Array.isArray(marketData)) {
        marketData.forEach((item: any) => {
          prices[item.symbol] = item.price;
        });
      }
      
      const result = calculatorService.convertCurrency(inputs, prices);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Conversion error' });
    }
  });
  
  app.post('/api/calculators/tax', async (req, res) => {
    try {
      const validatedData = taxCalculationSchema.parse(req.body);
      const result = calculatorService.calculateTax(validatedData);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Tax calculation error' });
    }
  });
  
  // Watchlist API
  app.get('/api/watchlist', async (req, res) => {
    try {
      const watchlist = await storage.getWatchlist();
      res.json(watchlist || { symbols: [] });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch watchlist' });
    }
  });
  
  app.post('/api/watchlist', async (req, res) => {
    try {
      const { symbols } = req.body;
      
      if (!Array.isArray(symbols)) {
        return res.status(400).json({ error: 'Symbols must be an array' });
      }
      
      const existing = await storage.getWatchlist();
      
      if (existing) {
        const updated = await storage.updateWatchlist(existing.id, symbols);
        res.json(updated);
      } else {
        const created = await storage.saveWatchlist({ symbols });
        res.json(created);
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to update watchlist' });
    }
  });
  
  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      const workerStatus = marketDataWorker.getStatus();
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          worker: workerStatus,
          news: newsService.getServiceHealth(),
          chat: chatService.getServiceHealth(),
          calculator: calculatorService.getServiceHealth()
        },
        connections: {
          websocket: wss.clients.size,
          sse: sseConnections.size
        },
        cache: marketCache.getStats()
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Provider stats endpoint for debugging and monitoring
  app.get('/api/providers/stats', async (req, res) => {
    try {
      const workerStatus = marketDataWorker.getStatus();
      const providerStats = {
        timestamp: new Date().toISOString(),
        worker: workerStatus,
        message: 'Data is now fetched by background worker at fixed intervals'
      };
      
      res.json(providerStats);
    } catch (error) {
      console.error('Provider stats error:', error);
      res.status(500).json({ 
        error: 'Failed to get provider stats',
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Comprehensive API Health Check endpoint  
  app.get('/api/health/comprehensive', async (req, res) => {
    try {
      const workerStatus = marketDataWorker.getStatus();
      const healthReport = {
        timestamp: new Date().toISOString(),
        worker: workerStatus,
        cache: marketCache.getStats(),
        connections: {
          websocket: wss.clients.size,
          sse: sseConnections.size
        },
        services: {
          news: newsService.getServiceHealth(),
          chat: chatService.getServiceHealth(),
          calculator: calculatorService.getServiceHealth()
        }
      };
      res.json(healthReport);
    } catch (error) {
      console.error('Comprehensive health check error:', error);
      res.status(500).json({ 
        error: 'Failed to perform comprehensive health check',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  return httpServer;
}
