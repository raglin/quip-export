import { ErrorHandler, ErrorCategory, ErrorSeverity, RecoveryStrategy } from '../../core/error-handler';
import { ConsoleLogger } from '../../core/logger';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let logger: ConsoleLogger;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    errorHandler = new ErrorHandler(logger, 100); // Small history size for testing
  });

  describe('Error Categorization', () => {
    it('should categorize authentication errors', async () => {
      const error = new Error('Unauthorized access');
      const context = {
        operation: 'document_export',
        documentId: 'doc1',
        documentTitle: 'Test Doc',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.AUTHENTICATION);
      expect(categorizedError.severity).toBe(ErrorSeverity.HIGH);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.ABORT);
      expect(categorizedError.isRetryable).toBe(false);
    });

    it('should categorize rate limit errors', async () => {
      const error = new Error('Rate limit exceeded - too many requests');
      const context = {
        operation: 'api_call',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.API_RATE_LIMIT);
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(categorizedError.isRetryable).toBe(true);
      expect(categorizedError.maxRetries).toBe(5);
      expect(categorizedError.retryDelay).toBe(5000);
    });

    it('should categorize network errors', async () => {
      const error = new Error('ECONNRESET: Connection reset by peer');
      const context = {
        operation: 'api_request',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.API_NETWORK);
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
      expect(categorizedError.isRetryable).toBe(true);
    });

    it('should categorize server errors', async () => {
      const error = new Error('Internal Server Error (500)');
      const context = {
        operation: 'document_download',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.API_SERVER);
      expect(categorizedError.severity).toBe(ErrorSeverity.HIGH);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should categorize client errors', async () => {
      const error = new Error('Bad Request (400) - Invalid document ID');
      const context = {
        operation: 'document_export',
        documentId: 'invalid-id',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.API_CLIENT);
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.SKIP);
      expect(categorizedError.isRetryable).toBe(false);
    });

    it('should categorize file system errors', async () => {
      const error = new Error('ENOENT: no such file or directory');
      const context = {
        operation: 'file_write',
        filePath: '/invalid/path/file.txt',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.FILE_SYSTEM);
      expect(categorizedError.severity).toBe(ErrorSeverity.HIGH);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should categorize memory errors', async () => {
      const error = new Error('JavaScript heap out of memory');
      const context = {
        operation: 'document_processing',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.MEMORY);
      expect(categorizedError.severity).toBe(ErrorSeverity.CRITICAL);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.ABORT);
      expect(categorizedError.isRetryable).toBe(false);
    });

    it('should categorize timeout errors', async () => {
      const error = new Error('Request timeout after 30 seconds');
      const context = {
        operation: 'document_export',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.TIMEOUT);
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should categorize validation errors', async () => {
      const error = new Error('Invalid document format - validation failed');
      const context = {
        operation: 'document_validation',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.VALIDATION);
      expect(categorizedError.severity).toBe(ErrorSeverity.LOW);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.SKIP);
      expect(categorizedError.isRetryable).toBe(false);
    });

    it('should categorize unknown errors', async () => {
      const error = new Error('Some unexpected error');
      const context = {
        operation: 'unknown_operation',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.category).toBe(ErrorCategory.UNKNOWN);
      expect(categorizedError.severity).toBe(ErrorSeverity.MEDIUM);
      expect(categorizedError.recoveryStrategy).toBe(RecoveryStrategy.RETRY);
    });
  });

  describe('Recovery Strategy Determination', () => {
    it('should recommend retry for retryable errors', async () => {
      const error = new Error('Network timeout');
      const context = {
        operation: 'api_call',
        attemptNumber: 1,
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);
      const recovery = await errorHandler.determineRecovery(categorizedError);

      expect(recovery.success).toBe(true);
      expect(recovery.action).toBe('retry');
      expect(recovery.delay).toBeGreaterThan(0);
    });

    it('should recommend skip when max retries exceeded', async () => {
      const error = new Error('Network timeout');
      const context = {
        operation: 'api_call',
        attemptNumber: 5, // Exceeds max retries
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);
      const recovery = await errorHandler.determineRecovery(categorizedError);

      expect(recovery.success).toBe(true);
      expect(recovery.action).toBe('skip');
    });

    it('should recommend abort for critical errors', async () => {
      const error = new Error('Out of memory');
      const context = {
        operation: 'document_processing',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);
      const recovery = await errorHandler.determineRecovery(categorizedError);

      expect(recovery.success).toBe(false);
      expect(recovery.action).toBe('abort');
    });

    it('should recommend skip for non-retryable errors', async () => {
      const error = new Error('Bad Request (400)');
      const context = {
        operation: 'api_call',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);
      const recovery = await errorHandler.determineRecovery(categorizedError);

      expect(recovery.success).toBe(true);
      expect(recovery.action).toBe('skip');
    });

    it('should attempt fallback for client errors', async () => {
      const error = new Error('Bad Request (400)');
      const context = {
        operation: 'document_export',
        documentId: 'doc1',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);
      categorizedError.recoveryStrategy = RecoveryStrategy.FALLBACK; // Force fallback
      
      const recovery = await errorHandler.determineRecovery(categorizedError);

      expect(recovery.success).toBe(true);
      expect(recovery.action).toBe('fallback');
      expect(recovery.fallbackData).toBeDefined();
    });
  });

  describe('Error Statistics', () => {
    it('should track error statistics', async () => {
      const errors = [
        new Error('Unauthorized'),
        new Error('Rate limit exceeded'),
        new Error('Network timeout'),
        new Error('Bad Request (400)')
      ];

      for (let i = 0; i < errors.length; i++) {
        await errorHandler.handleError(errors[i], {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const stats = errorHandler.getStatistics();

      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByCategory[ErrorCategory.AUTHENTICATION]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.API_RATE_LIMIT]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.API_NETWORK]).toBe(1);
      expect(stats.errorsByCategory[ErrorCategory.API_CLIENT]).toBe(1);
    });

    it('should track recovery actions', async () => {
      const error = new Error('Network timeout');
      const context = {
        operation: 'api_call',
        attemptNumber: 1,
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);
      await errorHandler.determineRecovery(categorizedError);

      const stats = errorHandler.getStatistics();
      expect(stats.retriedErrors).toBe(1);
    });
  });

  describe('Error History', () => {
    it('should maintain error history', async () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test_operation',
        timestamp: new Date()
      };

      await errorHandler.handleError(error, context);

      const recentErrors = errorHandler.getRecentErrors(60000); // Last minute
      expect(recentErrors).toHaveLength(1);
      expect(recentErrors[0].message).toBe('Test error');
    });

    it('should filter errors by category', async () => {
      const errors = [
        new Error('Unauthorized'),
        new Error('Network timeout'),
        new Error('Unauthorized access denied')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error, {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const authErrors = errorHandler.getErrorsByCategory(ErrorCategory.AUTHENTICATION);
      expect(authErrors).toHaveLength(2);
    });

    it('should limit history size', async () => {
      // Create more errors than the history limit (100)
      for (let i = 0; i < 150; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`), {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const recentErrors = errorHandler.getRecentErrors(3600000); // Last hour
      expect(recentErrors.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Operation Abort Logic', () => {
    it('should recommend abort for multiple critical errors', async () => {
      // Create multiple critical errors
      for (let i = 0; i < 4; i++) {
        await errorHandler.handleError(new Error('Out of memory'), {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const shouldAbort = errorHandler.shouldAbortOperation();
      expect(shouldAbort).toBe(true);
    });

    it('should recommend abort for persistent authentication errors', async () => {
      // Create multiple authentication errors
      for (let i = 0; i < 6; i++) {
        await errorHandler.handleError(new Error('Unauthorized'), {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const shouldAbort = errorHandler.shouldAbortOperation();
      expect(shouldAbort).toBe(true);
    });

    it('should recommend abort for high error rate', async () => {
      // Create many errors quickly
      for (let i = 0; i < 25; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`), {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const shouldAbort = errorHandler.shouldAbortOperation();
      expect(shouldAbort).toBe(true);
    });

    it('should not recommend abort for normal error levels', async () => {
      // Create a few errors
      for (let i = 0; i < 3; i++) {
        await errorHandler.handleError(new Error('Network timeout'), {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const shouldAbort = errorHandler.shouldAbortOperation();
      expect(shouldAbort).toBe(false);
    });
  });

  describe('Error Report Generation', () => {
    it('should generate comprehensive error report', async () => {
      const errors = [
        new Error('Unauthorized'),
        new Error('Rate limit exceeded'),
        new Error('Network timeout')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error, {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const report = errorHandler.generateErrorReport();

      expect(report.summary.totalErrors).toBe(3);
      expect(report.recentErrors).toHaveLength(3);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide relevant recommendations', async () => {
      // Create authentication errors
      for (let i = 0; i < 2; i++) {
        await errorHandler.handleError(new Error('Unauthorized'), {
          operation: 'test_operation',
          timestamp: new Date()
        });
      }

      const report = errorHandler.generateErrorReport();
      const recommendations = report.recommendations;

      expect(recommendations).toContain('Check your authentication credentials and ensure they are still valid');
    });
  });

  describe('User Messages', () => {
    it('should generate user-friendly messages', async () => {
      const error = new Error('ECONNRESET');
      const context = {
        operation: 'document_export',
        documentTitle: 'My Document',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.userMessage).toContain('Network connection issue');
      expect(categorizedError.userMessage).toContain('My Document');
      expect(categorizedError.userMessage).toContain('Retrying');
    });

    it('should include technical details', async () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      
      const context = {
        operation: 'test_operation',
        documentId: 'doc1',
        timestamp: new Date()
      };

      const categorizedError = await errorHandler.handleError(error, context);

      expect(categorizedError.technicalDetails).toContain('Test error');
      expect(categorizedError.technicalDetails).toContain('test_operation');
      expect(categorizedError.technicalDetails).toContain('doc1');
    });
  });

  describe('History Management', () => {
    it('should clear history and reset statistics', () => {
      // Add some errors first
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(errorHandler.handleError(new Error(`Error ${i}`), {
          operation: 'test_operation',
          timestamp: new Date()
        }));
      }

      Promise.all(promises).then(() => {
        expect(errorHandler.getStatistics().totalErrors).toBe(5);

        errorHandler.clearHistory();

        expect(errorHandler.getStatistics().totalErrors).toBe(0);
        expect(errorHandler.getRecentErrors(3600000)).toHaveLength(0);
      });
    });
  });
});