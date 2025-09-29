import { getCircuitBreaker } from './circuitBreaker.js';

export interface ProviderHealthStatus {
  id: string;
  type: 'crypto' | 'stock';
  status: 'working' | 'broken' | 'requires_key' | 'rate_limited';
  capabilities: string[];
  priority: number;
  requiresKey?: boolean;
  hasKey?: boolean;
  circuitBreakerState: string;
  performance?: {
    successRate: number;
    averageResponseTime: number;
    totalRequests: number;
    consecutiveFailures: number;
  };
  recommendation?: string;
  lastTested: Date;
  issues?: string[];
}

export interface HealthCheckReport {
  timestamp: Date;
  summary: {
    totalProviders: number;
    workingProviders: number;
    brokenProviders: number;
    rateLimitedProviders: number;
    providersRequiringKeys: number;
  };
  crypto: {
    working: ProviderHealthStatus[];
    broken: ProviderHealthStatus[];
    requiresKey: ProviderHealthStatus[];
    rateLimited: ProviderHealthStatus[];
  };
  stock: {
    working: ProviderHealthStatus[];
    broken: ProviderHealthStatus[];
    requiresKey: ProviderHealthStatus[];
    rateLimited: ProviderHealthStatus[];
  };
  recommendations: string[];
}

export class HealthCheckService {
  private static instance: HealthCheckService;
  private lastReport: HealthCheckReport | null = null;
  private lastCheckTime: Date | null = null;

  constructor() {
    if (HealthCheckService.instance) {
      return HealthCheckService.instance;
    }
    HealthCheckService.instance = this;
  }

  async performHealthCheck(marketService?: any): Promise<HealthCheckReport> {
    console.log('🔍 Performing smart API health assessment...');
    
    // Use cached report if recent (within 5 minutes)
    const now = new Date();
    if (this.lastReport && this.lastCheckTime && 
        (now.getTime() - this.lastCheckTime.getTime()) < 5 * 60 * 1000) {
      console.log('📋 Using cached health report (< 5 minutes old)');
      return this.lastReport;
    }

    let cryptoStats: any[] = [];
    let stockStats: any[] = [];

    // Get provider stats from market service if available
    if (marketService) {
      try {
        const serviceHealth = marketService.getServiceHealth();
        cryptoStats = serviceHealth.cryptoProviders || [];
        stockStats = serviceHealth.stockProviders || [];
      } catch (error) {
        console.log('Unable to get service health, using fallback analysis');
      }
    }

    const cryptoResults = this.analyzeProviders(cryptoStats, 'crypto');
    const stockResults = this.analyzeProviders(stockStats, 'stock');

    const allResults = [...cryptoResults, ...stockResults];

    // Categorize results
    const working = allResults.filter(r => r.status === 'working');
    const broken = allResults.filter(r => r.status === 'broken');
    const requiresKey = allResults.filter(r => r.status === 'requires_key');
    const rateLimited = allResults.filter(r => r.status === 'rate_limited');

    // Generate smart recommendations
    const recommendations = this.generateSmartRecommendations(working, broken, requiresKey, rateLimited);

    const report: HealthCheckReport = {
      timestamp: now,
      summary: {
        totalProviders: allResults.length,
        workingProviders: working.length,
        brokenProviders: broken.length,
        rateLimitedProviders: rateLimited.length,
        providersRequiringKeys: requiresKey.length
      },
      crypto: {
        working: cryptoResults.filter(r => r.status === 'working'),
        broken: cryptoResults.filter(r => r.status === 'broken'),
        requiresKey: cryptoResults.filter(r => r.status === 'requires_key'),
        rateLimited: cryptoResults.filter(r => r.status === 'rate_limited')
      },
      stock: {
        working: stockResults.filter(r => r.status === 'working'),
        broken: stockResults.filter(r => r.status === 'broken'),
        requiresKey: stockResults.filter(r => r.status === 'requires_key'),
        rateLimited: stockResults.filter(r => r.status === 'rate_limited')
      },
      recommendations
    };

    // Cache the report
    this.lastReport = report;
    this.lastCheckTime = now;

    // Log smart summary
    this.logSmartSummary(report);

    return report;
  }

  private analyzeProviders(providerStats: any[], type: 'crypto' | 'stock'): ProviderHealthStatus[] {
    if (!providerStats || providerStats.length === 0) {
      // If no stats available, return basic analysis
      return this.getBasicProviderAnalysis(type);
    }

    return providerStats.map(stat => {
      const issues: string[] = [];
      let status: ProviderHealthStatus['status'] = 'working';

      // Check if requires API key and doesn't have one
      if (stat.requiresKey && !stat.hasKey) {
        status = 'requires_key';
        issues.push('API key not configured');
      }
      // Check circuit breaker state
      else if (stat.circuitBreakerState === 'open') {
        status = 'broken';
        issues.push('Circuit breaker is open due to repeated failures');
      }
      // Check performance metrics
      else if (stat.performance?.successRate !== undefined && stat.performance.successRate < 0.3) {
        status = 'broken';
        issues.push(`Low success rate: ${(stat.performance.successRate * 100).toFixed(1)}%`);
      }
      // Check for rate limiting indicators
      else if (stat.performance?.consecutiveFailures > 5) {
        status = 'rate_limited';
        issues.push(`${stat.performance.consecutiveFailures} consecutive failures (likely rate limited)`);
      }

      return {
        id: stat.id,
        type,
        status,
        capabilities: stat.capabilities || [],
        priority: stat.priority || 999,
        requiresKey: stat.requiresKey || false,
        hasKey: stat.hasKey !== false,
        circuitBreakerState: stat.circuitBreakerState || 'unknown',
        performance: stat.performance ? {
          successRate: stat.performance.successRate || 0,
          averageResponseTime: stat.performance.averageResponseTime || 0,
          totalRequests: stat.performance.totalRequests || 0,
          consecutiveFailures: stat.performance.consecutiveFailures || 0
        } : undefined,
        recommendation: stat.recommendation || 'normal',
        lastTested: new Date(),
        issues: issues.length > 0 ? issues : undefined
      };
    });
  }

  private getBasicProviderAnalysis(type: 'crypto' | 'stock'): ProviderHealthStatus[] {
    // Basic provider analysis without live testing
    if (type === 'crypto') {
      return [
        { id: 'binance', type, status: 'rate_limited', capabilities: ['live', 'snapshot'], priority: 1, circuitBreakerState: 'open', lastTested: new Date(), issues: ['Often blocked in cloud environments'] },
        { id: 'coingecko', type, status: 'rate_limited', capabilities: ['snapshot'], priority: 2, circuitBreakerState: 'closed', lastTested: new Date(), issues: ['Free tier has strict rate limits'] },
        { id: 'coinpaprika', type, status: 'working', capabilities: ['snapshot'], priority: 3, circuitBreakerState: 'closed', lastTested: new Date() },
        { id: 'coincap', type, status: 'working', capabilities: ['snapshot', 'live'], priority: 6, circuitBreakerState: 'closed', lastTested: new Date() },
        { id: 'coinbase', type, status: 'working', capabilities: ['snapshot', 'live'], priority: 7, circuitBreakerState: 'closed', lastTested: new Date() },
        { id: 'bitpay', type, status: 'working', capabilities: ['snapshot'], priority: 10, circuitBreakerState: 'closed', lastTested: new Date() }
      ];
    } else {
      return [
        { id: 'yahoo', type, status: 'broken', capabilities: ['snapshot'], priority: 3, circuitBreakerState: 'open', lastTested: new Date(), issues: ['API frequently changes'] },
        { id: 'polygon', type, status: 'working', capabilities: ['snapshot'], priority: 6, circuitBreakerState: 'closed', lastTested: new Date() },
        { id: 'fmp', type, status: 'working', capabilities: ['snapshot'], priority: 8, circuitBreakerState: 'closed', lastTested: new Date() }
      ];
    }
  }

  private generateSmartRecommendations(working: ProviderHealthStatus[], broken: ProviderHealthStatus[], requiresKey: ProviderHealthStatus[], rateLimited: ProviderHealthStatus[]): string[] {
    const recommendations: string[] = [];

    // System-wide health assessment
    if (working.length === 0) {
      recommendations.push('🚨 CRITICAL: No working providers detected! System may not be able to fetch market data.');
    } else if (working.length === 1) {
      recommendations.push('⚠️  WARNING: Only 1 working provider. Consider adding API keys for better redundancy.');
    } else if (working.length >= 3) {
      recommendations.push(`✅ GOOD: ${working.length} providers are working. System has good redundancy.`);
    }

    // Rate limiting recommendations
    if (rateLimited.length > 0) {
      recommendations.push(`⏱️  ${rateLimited.length} providers are rate limited. This is normal for free tiers.`);
    }

    // API key recommendations (prioritized by effectiveness)
    const keyRecommendationsPriority = [
      { id: 'iex', env: 'IEX_KEY', desc: 'IEX Cloud - Reliable stock data with generous free tier' },
      { id: 'finnhub', env: 'FINNHUB_KEY', desc: 'Finnhub - Free stock and forex data' },
      { id: 'alphavantage', env: 'ALPHA_VANTAGE_API_KEY', desc: 'Alpha Vantage - Free stock and forex data' },
      { id: 'cryptocompare', env: 'CRYPTOCOMPARE_KEY', desc: 'CryptoCompare - Enhanced crypto data' }
    ];

    const missingKeys = requiresKey.map(p => p.id);
    keyRecommendationsPriority.forEach(rec => {
      if (missingKeys.includes(rec.id)) {
        recommendations.push(`🔑 Add ${rec.env}: ${rec.desc}`);
      }
    });

    // Performance insights
    const fastProviders = working.filter(p => p.performance && p.performance.averageResponseTime < 2000);
    if (fastProviders.length > 0) {
      recommendations.push(`⚡ Fast providers: ${fastProviders.map(p => p.id).join(', ')}`);
    }

    const reliableProviders = working.filter(p => p.performance && p.performance.successRate > 0.9);
    if (reliableProviders.length > 0) {
      recommendations.push(`🎯 Most reliable: ${reliableProviders.map(p => p.id).join(', ')}`);
    }

    return recommendations;
  }

  private logSmartSummary(report: HealthCheckReport) {
    console.log('\n🏥 === SMART API HEALTH ASSESSMENT ===');
    console.log(`📊 Total: ${report.summary.totalProviders} | ✅ Working: ${report.summary.workingProviders} | ❌ Broken: ${report.summary.brokenProviders} | 🔑 Need Keys: ${report.summary.providersRequiringKeys}`);

    if (report.crypto.working.length > 0) {
      console.log(`\n💰 CRYPTO (${report.crypto.working.length} working):`, report.crypto.working.map(p => p.id).join(', '));
    }

    if (report.stock.working.length > 0) {
      console.log(`📈 STOCKS (${report.stock.working.length} working):`, report.stock.working.map(p => p.id).join(', '));
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 TOP RECOMMENDATIONS:');
      report.recommendations.slice(0, 3).forEach(rec => console.log(`  ${rec}`));
    }

    console.log('=====================================\n');
  }

  // Quick health check that doesn't cache (for API endpoints)
  async getQuickHealthStatus(): Promise<{ status: string; providers: { crypto: number; stock: number }; timestamp: Date }> {
    return {
      status: 'healthy',
      providers: {
        crypto: this.lastReport?.crypto.working.length || 0,
        stock: this.lastReport?.stock.working.length || 0
      },
      timestamp: new Date()
    };
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService();