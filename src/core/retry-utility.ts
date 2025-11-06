// Retry utility with exponential backoff and circuit breaker pattern

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export class RetryUtility {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  };

  /**
   * Execute a function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if we should retry this error
        if (opts.retryCondition && !opts.retryCondition(lastError)) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === opts.maxRetries) {
          throw lastError;
        }

        // Call retry callback if provided
        if (opts.onRetry) {
          opts.onRetry(lastError, attempt + 1);
        }

        // Calculate delay and wait
        const delay = this.calculateDelay(attempt, opts);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Calculate delay with exponential backoff and optional jitter
   */
  private static calculateDelay(attempt: number, options: RetryOptions): number {
    const exponentialDelay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt);
    let delay = Math.min(exponentialDelay, options.maxDelay);

    // Add jitter to prevent thundering herd problem
    if (options.jitter) {
      const jitterAmount = delay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
      delay = Math.max(0, delay + jitter);
    }

    return Math.floor(delay);
  }

  /**
   * Utility method for delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry function with predefined options
   */
  static createRetryFunction<T>(
    options: Partial<RetryOptions> = {}
  ): (fn: () => Promise<T>) => Promise<T> {
    return (fn: () => Promise<T>) => this.withRetry(fn, options);
  }

  /**
   * Retry with exponential backoff for specific error types
   */
  static async retryOnCondition<T>(
    fn: () => Promise<T>,
    condition: (error: Error) => boolean,
    maxRetries: number = 3
  ): Promise<T> {
    return this.withRetry(fn, {
      maxRetries,
      retryCondition: condition
    });
  }

  /**
   * Retry with custom delay calculation
   */
  static async retryWithCustomDelay<T>(
    fn: () => Promise<T>,
    delayCalculator: (attempt: number) => number,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        const delay = delayCalculator(attempt);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }
}

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private options: CircuitBreakerOptions) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime < this.options.resetTimeout) {
        throw new Error('Circuit breaker is OPEN');
      } else {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = 'CLOSED';
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  /**
   * Get failure statistics
   */
  getStats(): {
    state: string;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Bulkhead pattern implementation for resource isolation
 */
export class Bulkhead {
  private activeRequests = 0;
  private readonly queue: Array<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    fn: () => Promise<any>;
  }> = [];

  constructor(private maxConcurrency: number) {}

  /**
   * Execute function with bulkhead protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.activeRequests < this.maxConcurrency) {
        this.executeImmediately(fn, resolve, reject);
      } else {
        this.queue.push({ resolve, reject, fn });
      }
    });
  }

  /**
   * Execute function immediately
   */
  private async executeImmediately<T>(
    fn: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: Error) => void
  ): Promise<void> {
    this.activeRequests++;

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error as Error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    if (this.queue.length > 0 && this.activeRequests < this.maxConcurrency) {
      const { resolve, reject, fn } = this.queue.shift()!;
      this.executeImmediately(fn, resolve, reject);
    }
  }

  /**
   * Get current bulkhead statistics
   */
  getStats(): {
    activeRequests: number;
    queuedRequests: number;
    maxConcurrency: number;
  } {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrency: this.maxConcurrency
    };
  }
}