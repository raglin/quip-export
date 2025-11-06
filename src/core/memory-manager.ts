// Memory management utilities for efficient document processing
import * as os from 'os';

export class MemoryManager {
  private static readonly MB = 1024 * 1024;

  /**
   * Get current memory usage information
   */
  static getMemoryUsage(): {
    used: number;
    total: number;
    free: number;
    percentage: number;
  } {
    // const memUsage = process.memoryUsage(); // Reserved for future use
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      used: usedMemory,
      total: totalMemory,
      free: freeMemory,
      percentage: Math.round((usedMemory / totalMemory) * 100),
    };
  }

  /**
   * Get memory usage in human-readable format
   */
  static getMemoryUsageFormatted(): {
    used: string;
    total: string;
    free: string;
    percentage: number;
  } {
    const usage = this.getMemoryUsage();
    return {
      used: this.formatBytes(usage.used),
      total: this.formatBytes(usage.total),
      free: this.formatBytes(usage.free),
      percentage: usage.percentage,
    };
  }

  /**
   * Check if system has sufficient memory for processing
   */
  static hassufficientMemory(requiredMB: number): boolean {
    const usage = this.getMemoryUsage();
    const requiredBytes = requiredMB * this.MB;
    return usage.free > requiredBytes;
  }

  /**
   * Calculate recommended batch size based on available memory
   */
  static calculateMemoryBasedBatchSize(
    averageDocumentSizeMB: number = 5,
    memoryBufferMB: number = 500
  ): number {
    const usage = this.getMemoryUsage();
    const availableMemoryMB = (usage.free - memoryBufferMB * this.MB) / this.MB;

    if (availableMemoryMB <= 0) {
      return 1; // Minimum batch size
    }

    const batchSize = Math.floor(availableMemoryMB / averageDocumentSizeMB);
    return Math.max(1, Math.min(100, batchSize));
  }

  /**
   * Monitor memory usage and trigger garbage collection if needed
   */
  static async monitorMemoryUsage(
    threshold: number = 80,
    callback?: (usage: number) => void
  ): Promise<void> {
    const usage = this.getMemoryUsage();

    if (callback) {
      callback(usage.percentage);
    }

    if (usage.percentage > threshold) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for GC to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Create a memory-efficient buffer for large file processing
   */
  static createBuffer(sizeMB: number): Buffer {
    const sizeBytes = sizeMB * this.MB;

    if (!this.hassufficientMemory(sizeMB + 100)) {
      // Add 100MB buffer
      throw new Error(`Insufficient memory to create ${sizeMB}MB buffer`);
    }

    return Buffer.allocUnsafe(sizeBytes);
  }

  /**
   * Process data in chunks to avoid memory issues
   */
  static async processInChunks<T, R>(
    data: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);

      // Monitor memory after each chunk
      await this.monitorMemoryUsage();
    }

    return results;
  }

  /**
   * Format bytes to human-readable string
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get system memory recommendations
   */
  static getMemoryRecommendations(): {
    recommendedBatchSize: number;
    recommendedConcurrency: number;
    memoryStatus: 'low' | 'medium' | 'high';
    warnings: string[];
  } {
    const usage = this.getMemoryUsage();
    const warnings: string[] = [];
    let memoryStatus: 'low' | 'medium' | 'high' = 'high';

    if (usage.percentage > 90) {
      memoryStatus = 'low';
      warnings.push('System memory usage is very high (>90%)');
      warnings.push('Consider closing other applications or reducing batch size');
    } else if (usage.percentage > 70) {
      memoryStatus = 'medium';
      warnings.push('System memory usage is moderate (>70%)');
    }

    const recommendedBatchSize = this.calculateMemoryBasedBatchSize();
    const recommendedConcurrency = memoryStatus === 'low' ? 2 : memoryStatus === 'medium' ? 3 : 5;

    return {
      recommendedBatchSize,
      recommendedConcurrency,
      memoryStatus,
      warnings,
    };
  }

  /**
   * Clean up memory by releasing references
   */
  static cleanup(): void {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Create a memory-aware stream processor
   */
  static createMemoryAwareProcessor<T>(maxMemoryMB: number = 100): {
    add: (item: T) => boolean;
    process: (processor: (items: T[]) => Promise<void>) => Promise<void>;
    clear: () => void;
    size: () => number;
  } {
    let items: T[] = [];
    const maxItems = Math.floor((maxMemoryMB * this.MB) / 1000); // Rough estimate

    return {
      add: (item: T): boolean => {
        if (items.length >= maxItems) {
          return false; // Buffer full
        }
        items.push(item);
        return true;
      },

      process: async (processor: (items: T[]) => Promise<void>): Promise<void> => {
        if (items.length > 0) {
          await processor([...items]);
          items = []; // Clear after processing
        }
      },

      clear: (): void => {
        items = [];
      },

      size: (): number => {
        return items.length;
      },
    };
  }
}
