export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;

  constructor(
    private failureThreshold: number = 5, // Increased threshold for high-frequency trading
    private recoveryTimeMs: number = 30000, // Reduced to 30 seconds for faster recovery
    private successThreshold: number = 2
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime < this.recoveryTimeMs) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
      }
    } else {
      this.state = CircuitState.CLOSED;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.successCount = 0;
  }
}

// Circuit breakers for different providers
export const cryptoCircuitBreakers = new Map<string, CircuitBreaker>();
export const stockCircuitBreakers = new Map<string, CircuitBreaker>();
export const newsCircuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(type: 'crypto' | 'stock' | 'news', provider: string): CircuitBreaker {
  const circuitBreakers = type === 'crypto' ? cryptoCircuitBreakers : 
                         type === 'stock' ? stockCircuitBreakers : 
                         newsCircuitBreakers;
  
  if (!circuitBreakers.has(provider)) {
    circuitBreakers.set(provider, new CircuitBreaker());
  }
  
  return circuitBreakers.get(provider)!;
}
