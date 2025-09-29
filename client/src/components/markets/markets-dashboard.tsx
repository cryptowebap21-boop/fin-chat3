import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import MarketCard from './market-card';
import { useSSE } from '@/hooks/use-sse';

type MarketKind = 'crypto' | 'stock';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h?: number;
  volume?: number;
  marketCap?: number;
  timestamp: string;
  source: string;
  kind: MarketKind;
}

export default function MarketsDashboard() {
  const [activeMarket, setActiveMarket] = useState<MarketKind>('crypto');
  const [searchTerm, setSearchTerm] = useState('');
  const [watchlist, setWatchlist] = useState<string[]>(['BTC', 'ETH', 'SOL', 'ADA']);

  // Get default symbols based on market type
  const getDefaultSymbols = (kind: MarketKind): string[] => {
    if (kind === 'crypto') {
      return ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'LTC'];
    } else {
      return ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX', 'SPY', 'QQQ'];
    }
  };

  // Fetch market data via REST API
  const { data: marketData, isLoading, error } = useQuery({
    queryKey: [`/api/markets/snapshot?kind=${activeMarket}&symbols=${getDefaultSymbols(activeMarket).join(',')}`],
    refetchInterval: activeMarket === 'crypto' ? 15000 : 30000, // 15s for crypto, 30s for stocks
  });

  // Use SSE for real-time updates
  const sseData = useSSE(`/api/markets/stream?kind=${activeMarket}&symbols=${getDefaultSymbols(activeMarket).join(',')}`);

  // Use SSE data if available, otherwise fall back to REST API data
  const displayData: MarketData[] = sseData || marketData || [];

  // Filter data based on search term
  const filteredData = displayData.filter(item =>
    item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleWatchlist = (symbol: string) => {
    setWatchlist(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  return (
    <div className="space-y-6">
      {/* Market Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex space-x-2">
          <Button
            variant={activeMarket === 'crypto' ? 'default' : 'outline'}
            onClick={() => setActiveMarket('crypto')}
            data-testid="market-crypto"
            className={activeMarket === 'crypto' ? 'bg-primary/20 text-primary border-primary/30' : ''}
          >
            <i className="fas fa-bitcoin mr-2"></i>
            Crypto
          </Button>
          <Button
            variant={activeMarket === 'stock' ? 'default' : 'outline'}
            onClick={() => setActiveMarket('stock')}
            data-testid="market-stocks"
            className={activeMarket === 'stock' ? 'bg-primary/20 text-primary border-primary/30' : ''}
          >
            <i className="fas fa-chart-line mr-2"></i>
            Stocks
          </Button>
        </div>

        <div className="flex space-x-3">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search symbols..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="calculator-input rounded-lg pl-10 pr-4 py-2 w-64"
              data-testid="market-search"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
          </div>
          <Button
            variant="outline"
            className="glass-panel hover:neon-glow"
            data-testid="watchlist-button"
          >
            <i className="fas fa-heart mr-2"></i>
            Watchlist ({watchlist.length})
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-6 animate-pulse">
              <div className="h-16 bg-muted rounded mb-4"></div>
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="glass-panel rounded-xl p-6 border border-destructive/30">
          <div className="flex items-center space-x-2 text-destructive">
            <i className="fas fa-exclamation-triangle"></i>
            <span className="font-medium">Failed to load market data</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {activeMarket === 'stock' 
              ? 'Stock data requires API keys. Check your configuration or view crypto markets instead.'
              : 'Unable to connect to market data providers. Please try again later.'
            }
          </p>
        </div>
      )}

      {/* Market Data Grid */}
      {!isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredData.map((item) => (
            <MarketCard
              key={item.symbol}
              data={item}
              isInWatchlist={watchlist.includes(item.symbol)}
              onToggleWatchlist={() => toggleWatchlist(item.symbol)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredData.length === 0 && (
        <div className="glass-panel rounded-xl p-12 text-center">
          <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
          <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search term or switch to a different market.
          </p>
        </div>
      )}

      {/* Market Status */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full pulse-dot"></div>
              <span className="text-sm text-muted-foreground">
                {activeMarket === 'crypto' 
                  ? 'Live data via Binance WebSocket'
                  : 'Live/delayed data from multiple providers'
                }
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {activeMarket === 'crypto' 
                ? 'Fallback: CoinGecko → CoinPaprika → Kraken'
                : 'Fallback chain available with API keys'
              }
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Last sync: {sseData ? 'Live' : 'Just now'}
          </div>
        </div>
      </div>
    </div>
  );
}
