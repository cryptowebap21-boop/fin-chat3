import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage.js";
import { MarketService } from "./services/marketService.js";
import { NewsService } from "./services/newsService.js";
import { ChatService } from "./services/chatService.js";
import { CalculatorService } from "./services/calculatorService.js";
import { chatMessageSchema, calculatorInputSchema, taxCalculationSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize services
  const marketService = new MarketService();
  const newsService = new NewsService();
  const chatService = new ChatService();
  const calculatorService = new CalculatorService();
  
  // Initialize live market streams
  await marketService.initializeLiveStreams();
  
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
  function broadcastMarketUpdate(data: any) {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'market_update',
          data
        }));
      }
    });
  }
  
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
  
  // Markets API
  app.get('/api/markets/snapshot', async (req, res) => {
    try {
      const { kind = 'crypto', symbols } = req.query;
      
      if (!['crypto', 'stock'].includes(kind as string)) {
        return res.status(400).json({ error: 'Kind must be "crypto" or "stock"' });
      }
      
      let symbolList: string[];
      if (symbols && typeof symbols === 'string') {
        symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
      } else {
        symbolList = marketService.getDefaultSymbols(kind as 'crypto' | 'stock');
      }
      
      const data = await marketService.getMarketSnapshot(kind as 'crypto' | 'stock', symbolList);
      res.json(data);
      
    } catch (error) {
      console.error('Market snapshot error:', error);
      res.status(500).json({ error: 'Failed to fetch market data' });
    }
  });
  
  // Server-Sent Events for real-time market data
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
    
    // Send initial data
    res.write('event: connected\n');
    res.write('data: {"status":"connected"}\n\n');
    
    req.on('close', () => {
      sseConnections.delete(connection);
    });
  });
  
  // Periodic market data updates via SSE
  setInterval(async () => {
    for (const connection of Array.from(sseConnections)) {
      try {
        const { res, kind, symbols } = connection;
        
        let symbolList: string[];
        if (symbols && typeof symbols === 'string') {
          symbolList = symbols.split(',').map((s: string) => s.trim().toUpperCase());
        } else {
          symbolList = marketService.getDefaultSymbols(kind as 'crypto' | 'stock');
        }
        
        const data = await marketService.getMarketSnapshot(kind as 'crypto' | 'stock', symbolList);
        
        res.write('event: market_update\n');
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        
      } catch (error) {
        console.error('SSE update error:', error);
        sseConnections.delete(connection);
      }
    }
  }, 5000); // Update every 5 seconds for crypto, 15 seconds for stocks
  
  // Market history API
  app.get('/api/markets/history', async (req, res) => {
    try {
      const { kind = 'crypto', symbol, range = '1d' } = req.query;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ error: 'Symbol is required' });
      }
      
      const data = await marketService.getMarketHistory(
        kind as 'crypto' | 'stock', 
        symbol.toUpperCase(), 
        range as string
      );
      
      res.json(data);
      
    } catch (error) {
      console.error('Market history error:', error);
      res.status(500).json({ error: 'Failed to fetch market history' });
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
      
      // Get current market prices for conversion
      const cryptoSymbols = ['BTC', 'ETH', 'SOL', 'ADA'];
      const marketData = await marketService.getMarketSnapshot('crypto', cryptoSymbols);
      
      const prices: Record<string, number> = { USD: 1 };
      marketData.forEach(item => {
        prices[item.symbol] = item.price;
      });
      
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
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          market: marketService.getServiceHealth(),
          news: newsService.getServiceHealth(),
          chat: chatService.getServiceHealth(),
          calculator: calculatorService.getServiceHealth()
        },
        connections: {
          websocket: wss.clients.size,
          sse: sseConnections.size
        }
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
      // Access registries through market service
      const cryptoStats = marketService['cryptoRegistry']?.getProviderStats() || [];
      const stockStats = marketService['stockRegistry']?.getProviderStats() || [];
      
      const providerStats = {
        timestamp: new Date().toISOString(),
        crypto: {
          providers: cryptoStats,
          totalProviders: cryptoStats.length,
          activeProviders: cryptoStats.filter((p: any) => p.circuitBreakerState === 'closed').length
        },
        stock: {
          providers: stockStats,
          totalProviders: stockStats.length,
          activeProviders: stockStats.filter((p: any) => p.circuitBreakerState === 'closed').length
        }
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

  return httpServer;
}
