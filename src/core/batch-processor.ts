// Batch processing utilities for handling large document sets with rate limiting

import { Logger } from '../types';

export interface BatchItem {
  id: string;
  priority: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  data?: any;
  error?: string;
}

export interface BatchProcessorOptions {
  batchSize: number;
  concurrency: number;
  rateLimitDelay: number;
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff?: boolean;
  memoryThreshold?: number;
  onProgress?: (processed: number, total: number, current?: BatchItem) => void;
  onBatchComplete?: (batch: BatchItem[], batchIndex: number, totalBatches: number) => void;
  onItemComplete?: (item: BatchItem, success: boolean) => void;
  onError?: (item: BatchItem, error: Error, attempt: number) => void;
}

export interface BatchProcessorResult<T extends BatchItem> {
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  skippedItems: number;
  items: T[];
  duration: number;
  averageProcessingTime: number;
}

/**
 * Generic batch processor for handling large sets of items with rate limiting,
 * retry logic, and memory management
 */
export class BatchProcessor<T extends BatchItem> {
  private readonly logger: Logger;
  private readonly options: BatchProcessorOptions;
  private isProcessing = false;
  private shouldCancel = false;
  private currentBatch: T[] = [];
  private startTime = 0;
  private processedCount = 0;

  constructor(logger: Logger, options: BatchProcessorOptions) {
    this.logger = logger;
    this.options = {
      exponentialBackoff: true,
      memoryThreshold: 500, // 500MB default
      ...options
    };
  }

  /**
   * Process items in batches
   */
  async process<R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<BatchProcessorResult<T>> {
    if (this.isProcessing) {
      throw new Error('Batch processor is already running');
    }

    this.isProcessing = true;
    this.shouldCancel = false;
    this.startTime = Date.now();
    this.processedCount = 0;

    try {
      this.logger.info(`Starting batch processing of ${items.length} items`);
      
      // Sort items by priority
      const sortedItems = [...items].sort((a, b) => a.priority - b.priority);
      
      // Create batches
      const batches = this.createBatches(sortedItems);
      this.logger.debug(`Created ${batches.length} batches of size ${this.options.batchSize}`);

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (this.shouldCancel) {
          this.logger.info('Batch processing cancelled');
          break;
        }

        const batch = batches[batchIndex];
        this.currentBatch = batch;

        this.logger.debug(`Processing batch ${batchIndex + 1}/${batches.length}`);
        
        await this.processBatch(batch, processor);
        
        // Callback for batch completion
        if (this.options.onBatchComplete) {
          this.options.onBatchComplete(batch, batchIndex, batches.length);
        }

        // Rate limiting between batches
        if (batchIndex < batches.length - 1 && this.options.rateLimitDelay > 0) {
          await this.delay(this.options.rateLimitDelay);
        }

        // Memory management
        await this.checkMemoryUsage();
      }

      const duration = Date.now() - this.startTime;
      const result = this.generateResult(items, duration);
      
      this.logger.info(`Batch processing completed: ${result.successfulItems}/${result.totalItems} successful`);
      return result;

    } finally {
      this.isProcessing = false;
      this.shouldCancel = false;
      this.currentBatch = [];
    }
  }

  /**
   * Cancel the current processing
   */
  cancel(): void {
    if (!this.isProcessing) {
      throw new Error('No batch processing in progress');
    }

    this.shouldCancel = true;
    this.logger.info('Batch processing cancellation requested');
  }

  /**
   * Check if processor is currently running
   */
  isRunning(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current processing statistics
   */
  getStatistics(): {
    isProcessing: boolean;
    processedCount: number;
    currentBatch: T[];
    elapsedTime: number;
    averageProcessingTime: number;
  } {
    const elapsedTime = this.isProcessing ? Date.now() - this.startTime : 0;
    const averageProcessingTime = this.processedCount > 0 ? elapsedTime / this.processedCount : 0;

    return {
      isProcessing: this.isProcessing,
      processedCount: this.processedCount,
      currentBatch: [...this.currentBatch],
      elapsedTime,
      averageProcessingTime
    };
  }

  /**
   * Process a single batch
   */
  private async processBatch<R>(
    batch: T[],
    processor: (item: T) => Promise<R>
  ): Promise<void> {
    // Create processing promises with concurrency control
    const semaphore = new Semaphore(this.options.concurrency);
    
    const promises = batch.map(item => 
      semaphore.acquire().then(async (release) => {
        try {
          await this.processItem(item, processor);
        } finally {
          release();
        }
      })
    );

    await Promise.all(promises);
  }

  /**
   * Process a single item with retry logic
   */
  private async processItem<R>(
    item: T,
    processor: (item: T) => Promise<R>
  ): Promise<void> {
    if (this.shouldCancel) {
      item.status = 'skipped';
      return;
    }

    item.status = 'processing';
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        await processor(item);
        
        item.status = 'completed';
        this.processedCount++;

        // Progress callback
        if (this.options.onProgress) {
          this.options.onProgress(this.processedCount, this.getTotalItems(), item);
        }

        // Item completion callback
        if (this.options.onItemComplete) {
          this.options.onItemComplete(item, true);
        }

        return;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        item.retryCount = attempt;

        // Error callback
        if (this.options.onError) {
          this.options.onError(item, lastError, attempt);
        }

        if (attempt < this.options.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          this.logger.debug(`Retrying item ${item.id} in ${delay}ms (attempt ${attempt + 1})`);
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    item.status = 'failed';
    item.error = lastError?.message || 'Unknown error';
    this.processedCount++;

    // Progress callback
    if (this.options.onProgress) {
      this.options.onProgress(this.processedCount, this.getTotalItems(), item);
    }

    // Item completion callback
    if (this.options.onItemComplete) {
      this.options.onItemComplete(item, false);
    }

    this.logger.warn(`Item ${item.id} failed after ${this.options.maxRetries + 1} attempts: ${item.error}`);
  }

  /**
   * Create batches from items
   */
  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }
    
    return batches;
  }

  /**
   * Calculate retry delay with optional exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (this.options.exponentialBackoff) {
      return this.options.retryDelay * Math.pow(2, attempt);
    }
    return this.options.retryDelay;
  }

  /**
   * Check memory usage and trigger garbage collection if needed
   */
  private async checkMemoryUsage(): Promise<void> {
    const usage = process.memoryUsage();
    const usedMB = usage.heapUsed / 1024 / 1024;
    const threshold = this.options.memoryThreshold || 500;

    if (usedMB > threshold) {
      this.logger.warn(`Memory usage high (${Math.round(usedMB)}MB), triggering garbage collection`);
      
      if (global.gc) {
        global.gc();
      }
      
      // Brief pause to allow memory cleanup
      await this.delay(1000);
      
      const newUsage = process.memoryUsage();
      const newUsedMB = newUsage.heapUsed / 1024 / 1024;
      this.logger.debug(`Memory usage after GC: ${Math.round(newUsedMB)}MB`);
    }
  }

  /**
   * Get total number of items being processed
   */
  private getTotalItems(): number {
    return this.currentBatch.length;
  }

  /**
   * Generate processing result
   */
  private generateResult(items: T[], duration: number): BatchProcessorResult<T> {
    const totalItems = items.length;
    const successfulItems = items.filter(item => item.status === 'completed').length;
    const failedItems = items.filter(item => item.status === 'failed').length;
    const skippedItems = items.filter(item => item.status === 'skipped').length;
    const processedItems = successfulItems + failedItems + skippedItems;
    const averageProcessingTime = processedItems > 0 ? duration / processedItems : 0;

    return {
      totalItems,
      processedItems,
      successfulItems,
      failedItems,
      skippedItems,
      items,
      duration,
      averageProcessingTime
    };
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Semaphore for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    }
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private readonly requestsPerSecond: number;
  private readonly burstSize: number;
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(_logger: Logger, requestsPerSecond: number, burstSize?: number) {
    this.requestsPerSecond = requestsPerSecond;
    this.burstSize = burstSize || requestsPerSecond;
    this.tokens = this.burstSize;
    this.lastRefill = Date.now();
  }

  /**
   * Wait for rate limit permission
   */
  async waitForPermission(): Promise<void> {
    return new Promise((resolve) => {
      if (this.tryAcquire()) {
        resolve();
      } else {
        this.queue.push(resolve);
        this.scheduleRefill();
      }
    });
  }

  /**
   * Try to acquire a token immediately
   */
  private tryAcquire(): boolean {
    this.refillTokens();
    
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    
    return false;
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = Math.floor(elapsed * this.requestsPerSecond);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.burstSize, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Schedule token refill and process queue
   */
  private scheduleRefill(): void {
    const timeToNextToken = (1 / this.requestsPerSecond) * 1000;
    
    setTimeout(() => {
      this.refillTokens();
      
      while (this.queue.length > 0 && this.tokens > 0) {
        this.tokens--;
        const resolve = this.queue.shift()!;
        resolve();
      }
      
      if (this.queue.length > 0) {
        this.scheduleRefill();
      }
    }, timeToNextToken);
  }

  /**
   * Get current rate limiter status
   */
  getStatus(): {
    tokens: number;
    queueLength: number;
    requestsPerSecond: number;
  } {
    this.refillTokens();
    
    return {
      tokens: this.tokens,
      queueLength: this.queue.length,
      requestsPerSecond: this.requestsPerSecond
    };
  }
}