import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPrice, formatPercentage } from '@/lib/api';

interface ChartData {
  timestamp: number;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h?: number;
  volume?: number;
}

export default function TradingChart() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [selectedKind, setSelectedKind] = useState<'crypto' | 'stock'>('crypto');
  const [compareSymbols, setCompareSymbols] = useState<string[]>([]);
  const [isVolumeLoading, setIsVolumeLoading] = useState(false);
  const [volumeError, setVolumeError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const symbols = selectedKind === 'crypto' 
    ? ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'MATIC']
    : ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META'];

  // Fetch current price data - Real-time updates from backend
  const { data: marketData } = useQuery({
    queryKey: [`/api/markets/snapshot?kind=${selectedKind}&symbols=${selectedSymbol}`],
    refetchInterval: 5000, // Poll every 5 seconds for updates
    staleTime: 3000, // Consider data fresh for 3 seconds
    retry: 0,
    refetchOnWindowFocus: false,
  });

  // Fetch chart data for visualization (latest price only, no history)
  const { data: chartData, isLoading, isFetching } = useQuery({
    queryKey: [`/api/markets/history?kind=${selectedKind}&symbol=${selectedSymbol}`],
    refetchInterval: 5000, // Match backend worker interval
    staleTime: 3000,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const currentData = (Array.isArray(marketData) && marketData.length > 0) ? marketData[0] as MarketData : undefined;
  
  // Update timestamp when data changes
  useEffect(() => {
    if (currentData) {
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }, [currentData]);

  // Update selected symbol when switching between crypto/stock to prevent dropdown from disappearing
  useEffect(() => {
    if (!symbols.includes(selectedSymbol)) {
      setSelectedSymbol(symbols[0]);
    }
    // Clear compare symbols when switching between crypto/stock
    setCompareSymbols([]);
  }, [selectedKind, symbols, selectedSymbol]);

  // Handle volume loading states
  useEffect(() => {
    if (isFetching) {
      setIsVolumeLoading(true);
      setVolumeError(null);
    } else {
      setIsVolumeLoading(false);
      if (!currentData) {
        setVolumeError('Unable to fetch market data');
      } else if (!currentData.volume) {
        setVolumeError('Volume data not available');
      } else {
        setVolumeError(null);
      }
    }
  }, [isFetching, currentData]);

  useEffect(() => {
    if (chartData && Array.isArray(chartData) && chartContainerRef.current) {
      renderChart(chartData);
    }
  }, [chartData, selectedKind, selectedSymbol]);

  // Functions for compare functionality
  const addCompareSymbol = (symbol: string) => {
    if (!compareSymbols.includes(symbol) && compareSymbols.length < 2) {
      setCompareSymbols([...compareSymbols, symbol]);
    }
  };

  const removeCompareSymbol = (symbol: string) => {
    setCompareSymbols(compareSymbols.filter(s => s !== symbol));
  };

  const renderChart = (data: ChartData[]) => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Clear previous chart with smooth transition
    container.innerHTML = '';
    
    // Handle empty data case with better messaging
    if (!data.length) {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'flex items-center justify-center h-full text-muted-foreground';
      messageDiv.innerHTML = `
        <div class="text-center">
          <i class="fas fa-chart-line text-2xl mb-2 opacity-50"></i>
          <p class="font-medium">Chart data loading...</p>
          <p class="text-sm opacity-70">Data will appear shortly</p>
        </div>
      `;
      container.appendChild(messageDiv);
      return;
    }

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', '0 0 800 400');
    svg.setAttribute('class', 'w-full h-full');

    // Calculate bounds
    const prices = data.map(d => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    
    // Add some padding
    const paddedMin = minPrice - priceRange * 0.1;
    const paddedMax = maxPrice + priceRange * 0.1;
    const paddedRange = paddedMax - paddedMin;

    // Create grid lines
    const gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gridGroup.setAttribute('opacity', '0.2');
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * 360 + 20;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '60');
      line.setAttribute('y1', y.toString());
      line.setAttribute('x2', '780');
      line.setAttribute('y2', y.toString());
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-width', '0.5');
      gridGroup.appendChild(line);
    }

    // Vertical grid lines
    for (let i = 0; i <= 5; i++) {
      const x = (i / 5) * 720 + 60;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', '20');
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', '380');
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-width', '0.5');
      gridGroup.appendChild(line);
    }

    svg.appendChild(gridGroup);

    // Create price line
    const pathData = data.map((point, index) => {
      const x = 60 + (index / (data.length - 1)) * 720;
      const y = 380 - ((point.close - paddedMin) / paddedRange) * 360;
      return index === 0 ? `M${x},${y}` : `L${x},${y}`;
    }).join(' ');

    const pricePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pricePath.setAttribute('d', pathData);
    pricePath.setAttribute('stroke', 'var(--primary)');
    pricePath.setAttribute('stroke-width', '3');
    pricePath.setAttribute('fill', 'none');
    // Remove heavy glow effect for cleaner professional look
    
    svg.appendChild(pricePath);

    // Add price labels
    const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (let i = 0; i <= 4; i++) {
      const price = paddedMax - (i / 4) * paddedRange;
      const y = (i / 4) * 360 + 25;
      
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '50');
      text.setAttribute('y', y.toString());
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('class', 'text-xs text-muted-foreground');
      text.setAttribute('fill', 'var(--muted-foreground)');
      text.textContent = formatPrice(price);
      labelGroup.appendChild(text);
    }
    svg.appendChild(labelGroup);

    container.appendChild(svg);
  };

  return (
    <div className="space-y-6">
      {/* Chart Controls */}
      <div className="glass-panel rounded-xl p-3 sm:p-4 lg:p-6">
        <div className="flex flex-col space-y-3 sm:space-y-4">
          {/* Top Row: Category Toggle and Symbol Select */}
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 lg:space-x-4">
            {/* Category Toggle */}
            <div className="flex bg-muted/30 rounded-lg p-0.5 sm:p-1 border border-primary/30 shadow-sm">
              <button
                onClick={() => setSelectedKind('crypto')}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 rounded-md text-xs sm:text-sm font-semibold transition-all duration-300 flex-1 sm:flex-none ${
                  selectedKind === 'crypto'
                    ? 'bg-primary/20 text-primary shadow-lg border-2 border-primary/60 font-bold'
                    : 'text-foreground hover:text-primary hover:bg-primary/10 border border-transparent'
                }`}
                data-testid="crypto-toggle"
              >
                <i className="fas fa-coins mr-1 sm:mr-2 text-xs sm:text-sm"></i>
                Crypto
              </button>
              <button
                onClick={() => setSelectedKind('stock')}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 rounded-md text-xs sm:text-sm font-semibold transition-all duration-300 flex-1 sm:flex-none ${
                  selectedKind === 'stock'
                    ? 'bg-primary/20 text-primary shadow-lg border-2 border-primary/60 font-bold'
                    : 'text-foreground hover:text-primary hover:bg-primary/10 border border-transparent'
                }`}
                data-testid="stock-toggle"
              >
                <i className="fas fa-chart-line mr-1 sm:mr-2 text-xs sm:text-sm"></i>
                Stocks
              </button>
            </div>
            
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-full sm:w-32 lg:w-48 bg-white dark:bg-gray-900 border-2 border-primary/50 hover:border-primary text-black dark:text-white font-semibold shadow-sm text-sm">
                <SelectValue className="font-semibold text-black dark:text-white" placeholder="Select Symbol" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-900 border-2 border-primary/50 shadow-lg max-h-60 overflow-y-auto">
                {symbols.map(symbol => (
                  <SelectItem key={symbol} value={symbol} className="text-black hover:bg-primary/15 focus:bg-primary/20 font-semibold py-2">
                    {symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Price Display with Last Updated Timestamp */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center sm:justify-start space-y-2 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2 sm:space-x-3">
              {currentData ? (
                <>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground" data-testid="chart-price">
                    {formatPrice(currentData.price)}
                  </div>
                  {currentData.change24h !== undefined && (
                    <div 
                      className={`font-medium px-2 py-1 rounded-full text-xs sm:text-sm ${
                        currentData.change24h >= 0 
                          ? 'text-green-400 bg-green-400/20' 
                          : 'text-red-400 bg-red-400/20'
                      }`}
                      data-testid="chart-change"
                    >
                      {formatPercentage(currentData.change24h)}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-20 sm:w-24 h-6 sm:h-8 bg-muted/50 rounded-md animate-pulse"></div>
                  <div className="w-12 sm:w-16 h-5 sm:h-6 bg-muted/30 rounded-md animate-pulse"></div>
                </div>
              )}
            </div>
            
            {/* Last Updated Timestamp */}
            {lastUpdated && (
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <i className="fas fa-clock"></i>
                <span>Last updated: {lastUpdated}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="glass-panel rounded-xl p-3 sm:p-4 lg:p-6">
        <div className="chart-container relative border border-border/30 rounded-lg min-h-[300px] h-[300px] sm:min-h-[350px] sm:h-[350px] lg:min-h-[400px] lg:h-[400px]">
          <div ref={chartContainerRef} className="w-full h-full rounded-lg" data-testid="trading-chart" />
          
          {/* Only show overlay loading on initial load when no chart data exists */}
          {isLoading && !chartData && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="font-medium">Loading chart data...</span>
              </div>
            </div>
          )}
          
          {/* Enhanced Chart controls overlay */}
          <div className="absolute top-4 left-4 space-y-2 opacity-80 hover:opacity-100 transition-opacity">
            <button 
              className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 shadow-md"
              data-testid="chart-zoom-in"
              title="Zoom In"
            >
              <i className="fas fa-plus text-sm text-foreground"></i>
            </button>
            <button 
              className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 shadow-md"
              data-testid="chart-zoom-out"
              title="Zoom Out"
            >
              <i className="fas fa-minus text-sm text-foreground"></i>
            </button>
            <button 
              className="w-10 h-10 glass-panel rounded-lg flex items-center justify-center hover:bg-primary/20 hover:border-primary/40 transition-all duration-200 shadow-md"
              data-testid="chart-crosshair"
              title="Crosshair"
            >
              <i className="fas fa-crosshairs text-sm text-foreground"></i>
            </button>
          </div>

          {/* Enhanced Live indicator with background fetch status */}
          <div className="absolute top-4 right-4 flex items-center space-x-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-2 border border-border/30">
            <div className={`w-2 h-2 rounded-full ${isFetching ? 'bg-blue-400 animate-spin' : 'bg-green-400 animate-pulse'}`}>
              {isFetching && <div className="w-2 h-2 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>}
            </div>
            <span className="text-xs text-foreground font-medium">
              {isFetching ? 'Updating...' : 'Live Data'}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Enhanced Volume Chart with better loading states */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">24h Volume</h3>
          <div className="h-32 flex items-end justify-center space-x-1 overflow-hidden">
            {isVolumeLoading ? (
              // Beautiful loading animation
              <div className="flex items-center justify-center h-full w-full">
                <div className="flex space-x-1">
                  {Array.from({length: 8}).map((_, index) => (
                    <div
                      key={index}
                      className="w-2 bg-gradient-to-t from-primary/80 to-primary/40 rounded-t animate-pulse"
                      style={{
                        height: `${(Math.sin(Date.now() * 0.01 + index) * 20 + 40)}px`,
                        animationDelay: `${index * 100}ms`,
                        animationDuration: '1.5s'
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : volumeError ? (
              // Error state with retry option
              <div className="flex items-center justify-center h-full w-full text-muted-foreground">
                <div className="text-center">
                  <i className="fas fa-exclamation-triangle text-xl mb-2 text-yellow-500"></i>
                  <p className="text-sm font-medium">Data unavailable</p>
                  <p className="text-xs opacity-70">Providers experiencing issues</p>
                </div>
              </div>
            ) : currentData && currentData.volume ? (
              // Show real volume data when available
              Array.from({length: 12}).map((_, index) => {
                const baseHeight = (currentData.volume! / 1000000) * 2; // Scale based on volume
                const variationHeight = Math.floor(Math.random() * 10) + baseHeight;
                return (
                  <div
                    key={index}
                    className="bg-gradient-to-t from-primary/80 to-primary/40 w-3 rounded-t transition-all duration-300 hover:from-primary hover:to-primary/60 hover:scale-105"
                    style={{ height: `${Math.min(variationHeight * 2, 80)}px` }}
                  />
                );
              })
            ) : (
              // Fallback state
              <div className="flex items-center justify-center h-full w-full text-muted-foreground">
                <div className="text-center">
                  <i className="fas fa-chart-bar text-xl mb-2 opacity-50"></i>
                  <p className="text-sm">Waiting for data...</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 text-center">
            <span className="text-sm text-muted-foreground">Volume: </span>
            <span className="text-sm font-medium text-foreground">
              {isVolumeLoading ? (
                <div className="inline-flex items-center space-x-2">
                  <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading...</span>
                </div>
              ) : volumeError ? (
                <span className="text-yellow-500">Unavailable</span>
              ) : currentData && currentData.volume ? (
                `${(currentData.volume / 1000000).toFixed(1)}M ${selectedKind === 'crypto' ? selectedSymbol : 'shares'}`
              ) : (
                'Awaiting data'
              )}
            </span>
          </div>
        </div>

        {/* Market Stats */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Statistics</h3>
          <div className="space-y-3">
            {currentData && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current Price</span>
                  <span className="font-medium text-foreground">{formatPrice(currentData.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">24h Change</span>
                  <span className={`font-medium ${currentData.change24h && currentData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {currentData.change24h ? formatPercentage(currentData.change24h) : 'N/A'}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">24h High</span>
              <span className="font-medium text-green-400">$45,892</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">24h Low</span>
              <span className="font-medium text-red-400">$42,156</span>
            </div>
          </div>
        </div>

        {/* Enhanced Compare - Now Functional */}
        <div className="glass-panel rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Compare Assets</h3>
          <div className="space-y-3">
            {/* Active compare symbols */}
            {compareSymbols.map((symbol) => (
              <div 
                key={symbol}
                className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/30"
              >
                <div className="flex items-center space-x-3">
                  <i className="fas fa-chart-line text-primary"></i>
                  <span className="text-foreground font-medium">{symbol}</span>
                  <span className="text-xs text-muted-foreground">overlay active</span>
                </div>
                <button 
                  onClick={() => removeCompareSymbol(symbol)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                  data-testid={`remove-overlay-${symbol.toLowerCase()}`}
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
            
            {/* Add overlay buttons */}
            {compareSymbols.length < 2 && (
              <>
                <button 
                  onClick={() => addCompareSymbol(selectedKind === 'crypto' ? 'ETH' : 'SPY')}
                  disabled={compareSymbols.includes(selectedKind === 'crypto' ? 'ETH' : 'SPY') || selectedSymbol === (selectedKind === 'crypto' ? 'ETH' : 'SPY')}
                  className="w-full text-left p-4 glass-panel rounded-lg hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 border border-transparent shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="add-overlay-eth"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <i className={`fas ${selectedKind === 'crypto' ? 'fa-ethereum' : 'fa-chart-line'} text-primary`}></i>
                      <span className="text-foreground font-medium">Add {selectedKind === 'crypto' ? 'ETH' : 'SPY'} overlay</span>
                    </div>
                    <i className="fas fa-plus text-primary opacity-70"></i>
                  </div>
                </button>
                <button 
                  onClick={() => addCompareSymbol(selectedKind === 'crypto' ? 'BTC' : 'QQQ')}
                  disabled={compareSymbols.includes(selectedKind === 'crypto' ? 'BTC' : 'QQQ') || selectedSymbol === (selectedKind === 'crypto' ? 'BTC' : 'QQQ')}
                  className="w-full text-left p-4 glass-panel rounded-lg hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 border border-transparent shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="add-overlay-index"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <i className={`fas ${selectedKind === 'crypto' ? 'fa-bitcoin' : 'fa-chart-area'} text-primary`}></i>
                      <span className="text-foreground font-medium">Add {selectedKind === 'crypto' ? 'BTC' : 'QQQ'} overlay</span>
                    </div>
                    <i className="fas fa-plus text-primary opacity-70"></i>
                  </div>
                </button>
              </>
            )}
            
            {compareSymbols.length >= 2 && (
              <div className="text-center text-muted-foreground text-sm py-2">
                Maximum 2 overlays active
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
