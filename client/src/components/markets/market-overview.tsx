import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}


interface MarketOverviewProps {
  onNavigateToCharts?: () => void;
}

export default function MarketOverview({ onNavigateToCharts }: MarketOverviewProps) {
  const { data: marketData = [], isLoading: loadingMarkets } = useQuery<MarketData[]>({
    queryKey: ['/api/markets/snapshot'],
    refetchInterval: 30000,
  });


  // Get up to 4 coins for display - prioritize preferred symbols but show whatever is available
  const preferredSymbols = ['BTC', 'ETH', 'AAPL', 'SPY'];
  const preferredCoins = marketData.filter(asset => 
    preferredSymbols.includes(asset.symbol)
  );
  const otherCoins = marketData.filter(asset => 
    !preferredSymbols.includes(asset.symbol) && asset.price != null
  );
  
  // Combine preferred + other coins, up to 4 total
  const displayCoins = [...preferredCoins, ...otherCoins].slice(0, 4);

  const formatPrice = (price: number | null | undefined, symbol: string) => {
    if (price === null || price === undefined || isNaN(price)) {
      return 'N/A';
    }
    if (['BTC', 'ETH'].includes(symbol)) {
      return price >= 1000 ? `$${(price / 1000).toFixed(1)}K` : `$${price.toFixed(2)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatChange = (change: number | undefined) => {
    if (change === undefined || change === null) return 'N/A';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  // Generate simple sparkline SVG
  const generateSparkline = (change?: number) => {
    const isPositive = (change || 0) >= 0;
    const points = isPositive 
      ? "0,20 5,15 10,10 15,5 20,0" 
      : "0,0 5,5 10,10 15,15 20,20";
    
    return (
      <svg width="40" height="20" className="inline-block">
        <polyline
          points={points}
          fill="none"
          stroke={isPositive ? "#10b981" : "#ef4444"}
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Market Overview */}
      <Card className="glass-panel border-primary/20 shadow-lg">
        <CardHeader className="pb-3 px-3 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center text-base sm:text-lg">
              <i className="fas fa-chart-line text-primary mr-2 text-sm sm:text-base"></i>
              Market Overview
            </CardTitle>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400">Live</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3 sm:px-6">
          {displayCoins.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {displayCoins.map((asset) => (
                <div key={asset.symbol} className="glass-panel p-2.5 sm:p-3 rounded-lg border border-primary/20 hover:border-primary/40 transition-all"
                     data-testid={`market-card-${asset.symbol}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold text-white ${
                        ['BTC', 'ETH'].includes(asset.symbol) 
                          ? 'bg-gradient-to-r from-orange-500 to-yellow-500'
                          : 'bg-gradient-to-r from-blue-500 to-purple-500'
                      }`}>
                        {asset.symbol === 'BTC' ? '₿' : asset.symbol === 'ETH' ? 'Ξ' : (asset.symbol || '').charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm sm:text-base">{asset.symbol}</div>
                        <div className="text-xs sm:text-sm font-medium text-primary">{formatPrice(asset.price, asset.symbol)}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="hidden sm:block">
                        {generateSparkline(asset.changePercent24h || asset.change24h)}
                      </div>
                      <div className="text-right">
                        <div className={`text-xs sm:text-sm font-semibold ${
                          (asset.changePercent24h || asset.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatChange(asset.changePercent24h || asset.change24h)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : loadingMarkets ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center text-sm text-muted-foreground">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Loading market data...
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">
                <i className="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>
                Market data temporarily unavailable
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Data providers experiencing issues
              </div>
            </div>
          )}

          {/* See More Button */}
          <div className="mt-4 sm:mt-6 flex justify-center">
            <Button
              onClick={onNavigateToCharts}
              className="bg-gradient-to-r from-primary to-accent text-black px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg font-semibold w-full sm:w-auto"
              data-testid="see-more-button"
            >
              <i className="fas fa-chart-area mr-2 text-sm sm:text-base"></i>
              See More
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}