interface ProviderMetrics {
  successRate: number;
  averageResponseTime: number;
  recentFailures: number;
  totalRequests: number;
  lastSuccessTime: number;
  consecutiveFailures: number;
}

interface ProviderPerformance {
  id: string;
  metrics: ProviderMetrics;
  priority: number;
  dynamicPriority: number;
}

export class ProviderOptimizer {
  private performanceMetrics = new Map<string, ProviderMetrics>();
  private requestHistory = new Map<string, number[]>(); // Response times for last 10 requests
  
  constructor() {
    // Clean up old metrics every 5 minutes
    setInterval(() => this.cleanupMetrics(), 5 * 60 * 1000);
  }
  
  async recordProviderRequest<T>(
    providerId: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    let metrics = this.getMetrics(providerId);
    
    try {
      const result = await operation();
      const responseTime = Date.now() - startTime;
      
      // Record successful request
      metrics.totalRequests++;
      metrics.lastSuccessTime = Date.now();
      metrics.consecutiveFailures = 0;
      
      // Update response time tracking
      this.updateResponseTime(providerId, responseTime);
      
      // Recalculate success rate
      metrics.successRate = this.calculateSuccessRate(providerId);
      metrics.averageResponseTime = this.calculateAverageResponseTime(providerId);
      
      this.performanceMetrics.set(providerId, metrics);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record failed request
      metrics.totalRequests++;
      metrics.recentFailures++;
      metrics.consecutiveFailures++;
      
      this.updateResponseTime(providerId, responseTime);
      metrics.successRate = this.calculateSuccessRate(providerId);
      metrics.averageResponseTime = this.calculateAverageResponseTime(providerId);
      
      this.performanceMetrics.set(providerId, metrics);
      throw error;
    }
  }
  
  optimizeProviderOrder<T extends { id: string; priority: number }>(providers: T[]): T[] {
    // Calculate dynamic priorities but keep original provider instances
    const providerPriorities = new Map<string, number>();
    
    providers.forEach(provider => {
      const metrics = this.getMetrics(provider.id);
      const dynamicPriority = this.calculateDynamicPriority(provider, metrics);
      providerPriorities.set(provider.id, dynamicPriority);
    });
    
    // Sort original providers by dynamic priority (lower is better)
    return [...providers].sort((a, b) => {
      const priorityA = providerPriorities.get(a.id) || a.priority;
      const priorityB = providerPriorities.get(b.id) || b.priority;
      return priorityA - priorityB;
    });
  }
  
  shouldSkipProvider(providerId: string): boolean {
    const metrics = this.getMetrics(providerId);
    
    // Don't skip if we don't have enough data yet
    if (metrics.totalRequests < 5) {
      return false;
    }
    
    // Skip if too many consecutive failures (increased threshold)
    if (metrics.consecutiveFailures >= 10) {
      return true;
    }
    
    // Skip if success rate is extremely low and we have significant data
    if (metrics.totalRequests > 20 && metrics.successRate < 0.1) {
      return true;
    }
    
    // Skip if average response time is extremely high (over 30 seconds)
    if (metrics.averageResponseTime > 30000 && metrics.totalRequests > 10) {
      return true;
    }
    
    return false;
  }
  
  getProviderRecommendations(): { fast: string[], reliable: string[], avoid: string[] } {
    const allMetrics = Array.from(this.performanceMetrics.entries());
    
    const fast = allMetrics
      .filter(([_, metrics]) => metrics.averageResponseTime < 2000 && metrics.totalRequests > 3)
      .sort((a, b) => a[1].averageResponseTime - b[1].averageResponseTime)
      .slice(0, 3)
      .map(([id]) => id);
    
    const reliable = allMetrics
      .filter(([_, metrics]) => metrics.successRate > 0.8 && metrics.totalRequests > 5)
      .sort((a, b) => b[1].successRate - a[1].successRate)
      .slice(0, 3)
      .map(([id]) => id);
    
    const avoid = allMetrics
      .filter(([_, metrics]) => metrics.successRate < 0.3 && metrics.totalRequests > 5)
      .map(([id]) => id);
    
    return { fast, reliable, avoid };
  }
  
  private getMetrics(providerId: string): ProviderMetrics {
    if (!this.performanceMetrics.has(providerId)) {
      this.performanceMetrics.set(providerId, {
        successRate: 1.0,
        averageResponseTime: 0,
        recentFailures: 0,
        totalRequests: 0,
        lastSuccessTime: Date.now(),
        consecutiveFailures: 0
      });
    }
    return this.performanceMetrics.get(providerId)!;
  }
  
  private updateResponseTime(providerId: string, responseTime: number): void {
    if (!this.requestHistory.has(providerId)) {
      this.requestHistory.set(providerId, []);
    }
    
    const history = this.requestHistory.get(providerId)!;
    history.push(responseTime);
    
    // Keep only last 10 requests
    if (history.length > 10) {
      history.shift();
    }
  }
  
  private calculateSuccessRate(providerId: string): number {
    const metrics = this.getMetrics(providerId);
    if (metrics.totalRequests === 0) return 1.0;
    
    const successfulRequests = metrics.totalRequests - metrics.recentFailures;
    return successfulRequests / metrics.totalRequests;
  }
  
  private calculateAverageResponseTime(providerId: string): number {
    const history = this.requestHistory.get(providerId) || [];
    if (history.length === 0) return 0;
    
    return history.reduce((sum, time) => sum + time, 0) / history.length;
  }
  
  private calculateDynamicPriority(
    provider: { id: string; priority: number }, 
    metrics: ProviderMetrics
  ): number {
    let dynamicPriority = provider.priority;
    
    // Bonus for high success rate
    dynamicPriority -= (metrics.successRate - 0.5) * 2;
    
    // Bonus for fast response times (under 1 second)
    if (metrics.averageResponseTime < 1000) {
      dynamicPriority -= 1;
    }
    
    // Penalty for slow response times
    if (metrics.averageResponseTime > 5000) {
      dynamicPriority += 2;
    }
    
    // Penalty for recent failures
    dynamicPriority += metrics.consecutiveFailures * 0.5;
    
    // Bonus for recent activity
    const timeSinceLastSuccess = Date.now() - metrics.lastSuccessTime;
    if (timeSinceLastSuccess < 60000) { // Less than 1 minute
      dynamicPriority -= 0.5;
    }
    
    return Math.max(0, dynamicPriority);
  }
  
  private cleanupMetrics(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    
    for (const [providerId, metrics] of Array.from(this.performanceMetrics.entries())) {
      // Reset failure count if it's been a while
      if (metrics.lastSuccessTime < fiveMinutesAgo) {
        metrics.recentFailures = Math.max(0, metrics.recentFailures - 1);
      }
      
      // Clean up providers with no recent activity
      if (metrics.lastSuccessTime < now - 30 * 60 * 1000) { // 30 minutes
        this.performanceMetrics.delete(providerId);
        this.requestHistory.delete(providerId);
      }
    }
  }
  
  getProviderStats() {
    return Array.from(this.performanceMetrics.entries()).map(([id, metrics]) => ({
      id,
      ...metrics,
      responseTimeHistory: this.requestHistory.get(id) || []
    }));
  }

  // Public API for accessing metrics (replaces private method access)
  getProviderMetrics(providerId: string): ProviderMetrics {
    return this.getMetrics(providerId);
  }

  // Public API for calculating dynamic priority
  getProviderDynamicPriority(provider: { id: string; priority: number }): number {
    const metrics = this.getMetrics(provider.id);
    return this.calculateDynamicPriority(provider, metrics);
  }
}

export const cryptoProviderOptimizer = new ProviderOptimizer();
export const stockProviderOptimizer = new ProviderOptimizer();