# FinChat - AI-Powered Financial Hub

## Overview

FinChat is a production-grade financial hub that provides AI-powered chat assistance, real-time market data, interactive charts, news feeds, and financial calculators. Built with a modern TypeScript stack, it offers a comprehensive suite of tools for cryptocurrency and stock market analysis with real-time data streaming and a glassmorphism UI design.

The application integrates multiple free-first data providers with intelligent failover mechanisms, ensuring reliable access to market data even when individual providers experience issues. It features an OpenAI-powered chat assistant specifically trained for financial guidance, real-time market dashboards, TradingView-style charts, and specialized calculators for ROI, P/L, compound interest, and tax calculations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

**Frontend Architecture**
- React with TypeScript using Vite for build tooling
- shadcn/ui components with Tailwind CSS for styling
- React Router (wouter) for client-side navigation
- TanStack Query for server state management and caching
- Custom hooks for SSE connections, theme management, and mobile detection
- Glassmorphism design with light/dark theme support

**Backend Architecture**
- Express.js server with TypeScript
- WebSocket server for real-time data streaming
- Server-Sent Events (SSE) for live market updates
- Modular service architecture with dependency injection pattern
- Circuit breaker pattern for external API resilience
- In-memory LRU caching with configurable TTLs

**Data Provider System**
- Multi-provider architecture with automatic failover
- Crypto providers: Binance API, CoinGecko (fallback)
- Stock providers: IEX Cloud, Alpha Vantage (fallback)
- News providers: RSS aggregation from multiple financial sources
- Unified data format across all providers with normalization layer

**Database Architecture**
- Drizzle ORM with PostgreSQL for persistent storage
- Hybrid storage approach: in-memory for active data, PostgreSQL for persistence
- Schema supports users, market data caching, news articles, chat conversations, and watchlists
- Fallback to cached database data when live providers fail

**Real-time Data Flow**
- WebSocket connections for bi-directional market data streaming
- SSE endpoints for unidirectional live updates to frontend
- Automatic reconnection logic with exponential backoff
- Rate limiting and connection throttling

**AI Chat System**
- OpenAI GPT integration with financial domain specialization
- Context-aware conversations with market data integration
- Conversation persistence and retrieval
- Financial disclaimer enforcement in all responses

## External Dependencies

**Market Data APIs**
- Binance API for cryptocurrency real-time and snapshot data
- IEX Cloud for stock market data (requires API key)
- CoinGecko API as crypto fallback provider
- Alpha Vantage as stock fallback provider

**AI Services**
- OpenRouter API with DeepSeek Chat v3.1 for AI-powered financial chat assistant (requires OPENROUTER_API_KEY)
- Custom financial prompt engineering for domain-specific responses

**Database Services**
- PostgreSQL via Neon Database for persistent storage
- Connection managed through Drizzle ORM with connection pooling

**News Sources**
- RSS feeds from major financial news outlets
- CoinDesk, CryptoNews, MarketWatch, and other financial RSS sources
- XML parsing with fallback mechanisms for different RSS formats

**Development Tools**
- TradingView Lightweight Charts for market visualization
- Font Awesome for comprehensive icon library
- Google Fonts for typography (Inter, JetBrains Mono)

**Infrastructure**
- Replit hosting platform with always-on server capability
- Environment variable management through Replit Secrets
- Vite development server with HMR and Replit-specific plugins

**Third-party Libraries**
- Radix UI primitives for accessible component foundations
- React Hook Form with Zod validation for form management
- Date-fns for date manipulation and formatting
- WebSocket libraries for real-time communication
- LRU cache implementation for memory management

## Replit Environment Setup

**Current Configuration (September 30, 2025)**
- Successfully configured for Replit environment
- Server running on port 5000 (frontend and backend on same port)
- Vite dev server configured with `allowedHosts: true` for Replit proxy compatibility
- WebSocket and SSE real-time connections configured
- Build system: Vite + esbuild for production builds
- Deployment target: autoscale (for stateless web application)

**Working Features**
- 6 active data providers (coinpaprika, coincap, coinbase, bitpay, polygon, fmp)
- News aggregation (134 articles cached on startup)
- Real-time market data streaming via SSE
- Glassmorphism UI with light/dark theme
- Responsive design and navigation

**Known Limitations**
- Binance WebSocket blocked (451 error) - fallback providers active
- Some RSS feeds blocked by network filters - working providers compensate
- AI chat requires OPENROUTER_API_KEY to be set in Replit Secrets

**To Enable AI Chat**
1. Visit https://openrouter.ai/keys
2. Create a free account and generate API key
3. Add to Replit Secrets: key=`OPENROUTER_API_KEY`, value=your_api_key
4. Restart the application