import { type UnifiedMarketData } from "@shared/schema";

export function formatPrice(price: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(price);
}

export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return `$${(volume / 1e9).toFixed(2)}B`;
  } else if (volume >= 1e6) {
    return `$${(volume / 1e6).toFixed(2)}M`;
  } else if (volume >= 1e3) {
    return `$${(volume / 1e3).toFixed(2)}K`;
  }
  return `$${volume.toFixed(2)}`;
}

export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return `$${(marketCap / 1e12).toFixed(2)}T`;
  } else if (marketCap >= 1e9) {
    return `$${(marketCap / 1e9).toFixed(2)}B`;
  } else if (marketCap >= 1e6) {
    return `$${(marketCap / 1e6).toFixed(2)}M`;
  }
  return `$${marketCap.toFixed(2)}`;
}

export function normalizeMarketData(rawData: any, source: string, kind: 'crypto' | 'stock'): UnifiedMarketData {
  // This function normalizes data from different providers to unified format
  const timestamp = new Date().toISOString();
  
  switch (source) {
    case 'binance':
      return {
        symbol: rawData.symbol,
        name: rawData.symbol, // Binance doesn't provide full names
        price: parseFloat(rawData.price || rawData.c),
        change24h: parseFloat(rawData.priceChangePercent || rawData.P),
        volume: parseFloat(rawData.volume || rawData.v),
        marketCap: undefined, // Not provided by Binance
        timestamp,
        source,
        kind
      };
      
    case 'coingecko':
      return {
        symbol: rawData.symbol?.toUpperCase(),
        name: rawData.name,
        price: rawData.current_price,
        change24h: rawData.price_change_percentage_24h,
        volume: rawData.total_volume,
        marketCap: rawData.market_cap,
        timestamp,
        source,
        kind
      };
      
    case 'coinpaprika':
      return {
        symbol: rawData.symbol?.toUpperCase(),
        name: rawData.name,
        price: rawData.quotes?.USD?.price,
        change24h: rawData.quotes?.USD?.percent_change_24h,
        volume: rawData.quotes?.USD?.volume_24h,
        marketCap: rawData.quotes?.USD?.market_cap,
        timestamp,
        source,
        kind
      };
      
    case 'kraken':
      const pair = Object.keys(rawData.result || {})[0];
      const data = rawData.result?.[pair];
      return {
        symbol: pair?.replace('USD', ''),
        name: pair?.replace('USD', ''),
        price: parseFloat(data?.c?.[0]),
        change24h: undefined, // Calculate from open/close if available
        volume: parseFloat(data?.v?.[1]), // 24h volume
        marketCap: undefined,
        timestamp,
        source,
        kind
      };
      
    case 'iex':
      return {
        symbol: rawData.symbol,
        name: rawData.companyName || rawData.symbol,
        price: rawData.latestPrice,
        change24h: rawData.changePercent ? rawData.changePercent * 100 : undefined,
        volume: rawData.volume,
        marketCap: rawData.marketCap,
        timestamp,
        source,
        kind
      };
      
    case 'finnhub':
      return {
        symbol: rawData.symbol,
        name: rawData.symbol, // Finnhub provides symbol in quote endpoint
        price: rawData.c, // current price
        change24h: rawData.dp, // percent change
        volume: undefined, // Not in basic quote
        marketCap: undefined,
        timestamp,
        source,
        kind
      };
      
    default:
      // Generic fallback
      return {
        symbol: rawData.symbol || 'UNKNOWN',
        name: rawData.name || rawData.symbol || 'Unknown',
        price: parseFloat(rawData.price || rawData.last || rawData.close || 0),
        change24h: parseFloat(rawData.change24h || rawData.changePercent || 0),
        volume: parseFloat(rawData.volume || 0),
        marketCap: parseFloat(rawData.marketCap || 0),
        timestamp,
        source,
        kind
      };
  }
}

export function calculateHoldingPeriod(purchaseDate: string, saleDate?: string): number {
  const purchase = new Date(purchaseDate);
  const sale = saleDate ? new Date(saleDate) : new Date();
  return Math.floor((sale.getTime() - purchase.getTime()) / (1000 * 60 * 60 * 24));
}

export function isLongTermHolding(days: number): boolean {
  return days >= 365; // US tax law: 1 year for long-term capital gains
}

export function calculateTaxRate(income: number, isLongTerm: boolean, region: string = 'US'): number {
  if (region === 'US') {
    if (isLongTerm) {
      // Long-term capital gains rates for 2024
      if (income <= 44625) return 0;
      if (income <= 492300) return 15;
      return 20;
    } else {
      // Short-term capital gains = ordinary income tax rates
      if (income <= 10275) return 10;
      if (income <= 41775) return 12;
      if (income <= 89450) return 22;
      if (income <= 190750) return 24;
      if (income <= 364200) return 32;
      if (income <= 462500) return 35;
      return 37;
    }
  }
  
  // Default fallback rates for other regions
  return isLongTerm ? 15 : 25;
}
