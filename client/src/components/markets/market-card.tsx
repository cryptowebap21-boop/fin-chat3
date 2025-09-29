import { formatPrice, formatPercentage, formatVolume, formatMarketCap } from '@/lib/api';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h?: number;
  volume?: number;
  marketCap?: number;
  timestamp: string;
  source: string;
  kind: 'crypto' | 'stock';
}

interface MarketCardProps {
  data: MarketData;
  isInWatchlist: boolean;
  onToggleWatchlist: () => void;
}

export default function MarketCard({ data, isInWatchlist, onToggleWatchlist }: MarketCardProps) {
  const { symbol, name, price, change24h, volume, marketCap, timestamp } = data;
  
  const isPositive = change24h ? change24h >= 0 : true;
  const changeColor = isPositive ? 'text-green-400' : 'text-red-400';
  
  // Get icon based on symbol
  const getIcon = () => {
    switch (symbol) {
      case 'BTC':
        return 'fab fa-bitcoin text-orange-500';
      case 'ETH':
        return 'fab fa-ethereum text-blue-600';
      default:
        return data.kind === 'crypto' 
          ? 'fas fa-coins text-yellow-500'
          : 'fas fa-chart-line text-blue-500';
    }
  };

  // Generate sparkline data (simplified)
  const generateSparkline = () => {
    const points = 8;
    const baseY = 30;
    const amplitude = isPositive ? -10 : 10;
    
    return Array.from({ length: points }, (_, i) => {
      const x = (i / (points - 1)) * 200;
      const noise = (Math.sin(i * 0.8) + Math.cos(i * 1.2)) * amplitude;
      const y = baseY + noise + (isPositive ? -5 : 5);
      return `${x},${Math.max(5, Math.min(55, y))}`;
    }).join(' L');
  };

  const sparklinePath = `M${generateSparkline()}`;
  const sparklineColor = isPositive ? 'var(--primary)' : '#ef4444';

  return (
    <div 
      className="market-card glass-panel rounded-xl p-6 hover:neon-glow transition-all cursor-pointer"
      data-testid={`market-card-${symbol}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted/20">
            <i className={getIcon()}></i>
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <p className="text-sm text-muted-foreground">{symbol}</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleWatchlist();
          }}
          data-testid={`watchlist-${symbol}`}
          className={`transition-colors ${
            isInWatchlist 
              ? 'text-primary hover:text-accent' 
              : 'text-muted-foreground hover:text-primary'
          }`}
        >
          <i className={isInWatchlist ? 'fas fa-heart' : 'far fa-heart'}></i>
        </button>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold text-foreground" data-testid={`price-${symbol}`}>
            {formatPrice(price)}
          </span>
          {change24h !== undefined && (
            <span className={`text-sm font-medium ${changeColor}`} data-testid={`change-${symbol}`}>
              {formatPercentage(change24h)}
            </span>
          )}
        </div>
        
        {(volume || marketCap) && (
          <div className="flex justify-between text-sm text-muted-foreground">
            {volume && <span>Vol: {formatVolume(volume)}</span>}
            {marketCap && <span>MCap: {formatMarketCap(marketCap)}</span>}
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div className="mt-4 h-12">
        <svg className="w-full h-full" viewBox="0 0 200 60">
          <path 
            d={sparklinePath}
            stroke={sparklineColor}
            strokeWidth="2" 
            fill="none"
            className="transition-colors duration-300"
          />
        </svg>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>Last updated: {getTimeAgo(timestamp)}</span>
        <div className="w-2 h-2 bg-green-400 rounded-full pulse-dot"></div>
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}
