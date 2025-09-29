# FinChat - AI-Powered Financial Hub

FinChat is a modern financial trading application that provides real-time market data, AI-powered chat assistance, interactive charts, and financial calculators. Built with a sleek glassmorphism design, it offers a comprehensive suite of tools for cryptocurrency and stock market analysis.

## ✨ Features

- **AI Chat Assistant**: Powered by OpenRouter's DeepSeek Chat v3.1 for intelligent financial guidance
- **Real-time Market Data**: Live cryptocurrency and stock prices with automatic updates
- **Interactive Charts**: TradingView-style charts with technical analysis
- **Financial Calculators**: ROI, P/L, compound interest, and tax calculations
- **News Feed**: Aggregated financial news from multiple sources
- **Glassmorphism UI**: Modern, responsive design with light/dark theme support
- **Real-time Streaming**: WebSocket and SSE connections for live data

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- OpenRouter API key (free tier available)

### 2. Installation

```bash
# Clone the repository
git clone <repository-url>
cd finchat

# Install dependencies
npm install
```

### 3. Configuration

#### For Development (Local .env file):
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenRouter API key
OPENROUTER_API_KEY=your_openrouter_key_here
```

#### For Replit (Recommended):
1. Open the **Secrets** tab in your Replit workspace
2. Add a new secret:
   - **Key**: `OPENROUTER_API_KEY`
   - **Value**: Your OpenRouter API key from https://openrouter.ai/keys

### 4. Get Your OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/keys)
2. Sign up for a free account
3. Generate a new API key
4. Copy the key and add it to your environment variables

### 5. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 🤖 AI Chat Assistant

FinChat now uses **OpenRouter** with the **DeepSeek Chat v3.1** model, providing:

- **Free tier available**: Get started without costs
- **High-quality responses**: Advanced financial knowledge and analysis
- **Streaming responses**: Real-time chat experience
- **Financial expertise**: Specialized in crypto, stocks, and market analysis

### Chat Features:
- Cryptocurrency and stock analysis
- Market trend insights
- Investment strategy guidance
- Tax calculation assistance
- Portfolio optimization advice
- Risk assessment and management

## 📊 Market Data

### Cryptocurrency Data
- **Primary**: Binance API (WebSocket for real-time)
- **Fallback**: CoinGecko, CoinPaprika
- **No API keys required** - works with free tiers

### Stock Market Data
- **Primary**: IEX Cloud (requires API key for real-time)
- **Fallback**: Alpha Vantage, Yahoo Finance
- **Free tier**: Limited delayed data available

### News Sources
- Financial RSS feeds from major outlets
- Real-time aggregation
- No API keys required

## 🔧 Optional API Keys

While FinChat works with minimal configuration, you can enhance functionality with these optional API keys:

```env
# Stock Data Enhancement
IEX_CLOUD_TOKEN=your_iex_token_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# Additional providers (optional)
FINNHUB_KEY=your_finnhub_key_here
TWELVEDATA_KEY=your_twelve_data_key_here
```

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: WebSocket, Server-Sent Events
- **AI**: OpenRouter API with DeepSeek Chat v3.1
- **Charts**: TradingView Lightweight Charts
- **Deployment**: Replit (recommended)

## 📁 Project Structure

```
finchat/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities and configurations
├── server/                 # Express.js backend
│   ├── services/           # Business logic
│   ├── providers/          # Data provider implementations
│   └── routes.ts           # API routes
├── shared/                 # Shared types and schemas
└── .env.example           # Environment variables template
```

## 🚀 Deployment

### Replit (Recommended)

1. Fork this repository to Replit
2. Add your `OPENROUTER_API_KEY` to Replit Secrets
3. Run the application using the "Run" button
4. Your app will be live at `https://your-repl-name.replit.app`

### Manual Deployment

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🔒 Environment Variables

### Required:
- `OPENROUTER_API_KEY`: Your OpenRouter API key for chat functionality

### Optional:
- `IEX_CLOUD_TOKEN`: Enhanced stock market data
- `ALPHA_VANTAGE_API_KEY`: Additional stock data provider
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (development/production)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues:

1. Check that your `OPENROUTER_API_KEY` is correctly set
2. Verify your internet connection for real-time data
3. Review the console logs for specific error messages
4. Ensure you're using Node.js 18 or higher

## 🔄 Updates

FinChat is actively maintained with regular updates for:
- New market data providers
- Enhanced AI capabilities
- Additional financial tools
- UI/UX improvements

---

**Note**: This application provides educational information only and should not be considered as financial advice. Always consult with qualified financial advisors for investment decisions.