// Circuit breaker pattern for preventing cascading failures

import { Logger } from '../types';

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Failing fast
  HALF_OPEN = 'half_open' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  recoveryTimeout: number;       // Time to wait before trying half-open (ms)
  successThreshold: number;      // Successes needed to close from half-open
  monitoringWindow: number;      // Time window for failure counting (ms)
  minimumRequests: number;       // Minimum requests before considering failure rate
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  stateChangedAt: Date;
  failureRate: number;
}

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export class CircuitBreaker {
  private readonly logger: Logger;
  private readonly config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private totalRequests = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private stateChangedAt = new Date();
  private readonly requestHistory: Array<{ timestamp: Date; success: boolean }> = [];

  constructor(logger: Logger, config: Partial<CircuitBreakerConfig> = {}) {
    this.logger = logger;
    this.config = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      successThreshold: 3,
      monitoringWindow: 300000, // 5 minutes
      minimumRequests: 10,
      ...config
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>, operationName = 'operation'): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(`Circuit breaker is OPEN for ${operationName}. Service is currently unavailable.`);
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

  /**
   * Check if circuit breaker allows the request
   */
  canExecute(): boolean {
    if (this.state === CircuitState.OPEN) {
      return this.shouldAttemptReset();
    }
    return true;
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    this.cleanupHistory();
    
    const recentRequests = this.getRecentRequests();
    const failureRate = recentRequests.length > 0 
      ? recentRequests.filter(r => !r.success).length / recentRequests.length 
      : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChangedAt: this.stateChangedAt,
      failureRate
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stateChangedAt = new Date();
    this.requestHistory.length = 0;
    this.logger.info('Circuit breaker reset to CLOSED state');
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    this.transitionToOpen();
    this.logger.warn('Circuit breaker forced to OPEN state');
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.totalRequests++;
    this.lastSuccessTime = new Date();
    
    this.addToHistory(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(): void {
    this.failureCount++;
    this.totalRequests++;
    this.lastFailureTime = new Date();
    
    this.addToHistory(false);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Check if circuit breaker should open
   */
  private shouldOpen(): boolean {
    const recentRequests = this.getRecentRequests();
    
    // Need minimum requests to consider opening
    if (recentRequests.length < this.config.minimumRequests) {
      return false;
    }

    const recentFailures = recentRequests.filter(r => !r.success).length;
    return recentFailures >= this.config.failureThreshold;
  }

  /**
   * Check if should attempt reset from open to half-open
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.recoveryTimeout;
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.stateChangedAt = new Date();
    this.logger.info('Circuit breaker transitioned to CLOSED state');
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.stateChangedAt = new Date();
    this.logger.warn('Circuit breaker transitioned to OPEN state');
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.stateChangedAt = new Date();
    this.logger.info('Circuit breaker transitioned to HALF_OPEN state');
  }

  /**
   * Add request result to history
   */
  private addToHistory(success: boolean): void {
    this.requestHistory.push({
      timestamp: new Date(),
      success
    });

    // Keep history size manageable
    if (this.requestHistory.length > 1000) {
      this.requestHistory.shift();
    }
  }

  /**
   * Get recent requests within monitoring window
   */
  private getRecentRequests(): Array<{ timestamp: Date; success: boolean }> {
    const cutoff = new Date(Date.now() - this.config.monitoringWindow);
    return this.requestHistory.filter(r => r.timestamp >= cutoff);
  }

  /**
   * Clean up old history entries
   */
  private cleanupHistory(): void {
    const cutoff = new Date(Date.now() - this.config.monitoringWindow);
    const validEntries = this.requestHistory.filter(r => r.timestamp >= cutoff);
    
    if (validEntries.length !== this.requestHistory.length) {
      this.requestHistory.length = 0;
      this.requestHistory.push(...validEntries);
    }
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private readonly logger: Logger;
  private readonly breakers = new Map<string, CircuitBreaker>();
  private readonly defaultConfig: CircuitBreakerConfig;

  constructor(logger: Logger, defaultConfig?: Partial<CircuitBreakerConfig>) {
    this.logger = logger;
    this.defaultConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      successThreshold: 3,
      monitoringWindow: 300000,
      minimumRequests: 10,
      ...defaultConfig
    };
  }

  /**
   * Get or create circuit breaker for service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      const breakerConfig = { ...this.defaultConfig, ...config };
      const breaker = new CircuitBreaker(this.logger, breakerConfig);
      this.breakers.set(serviceName, breaker);
      this.logger.debug(`Created circuit breaker for service: ${serviceName}`);
    }

    return this.breakers.get(serviceName)!;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string, 
    operation: () => Promise<T>, 
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getBreaker(serviceName, config);
    return breaker.execute(operation, serviceName);
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [serviceName, breaker] of this.breakers) {
      stats[serviceName] = breaker.getStats();
    }
    
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const [serviceName, breaker] of this.breakers) {
      breaker.reset();
      this.logger.info(`Reset circuit breaker for service: ${serviceName}`);
    }
  }

  /**
   * Get services with open circuit breakers
   */
  getOpenCircuits(): string[] {
    const openCircuits: string[] = [];
    
    for (const [serviceName, breaker] of this.breakers) {
      if (breaker.getStats().state === CircuitState.OPEN) {
        openCircuits.push(serviceName);
      }
    }
    
    return openCircuits;
  }

  /**
   * Check if any circuit breakers are open
   */
  hasOpenCircuits(): boolean {
    return this.getOpenCircuits().length > 0;
  }
}