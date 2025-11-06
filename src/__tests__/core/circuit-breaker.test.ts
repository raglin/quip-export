import { CircuitBreaker, CircuitBreakerManager, CircuitState } from '../../core/circuit-breaker';
import { ConsoleLogger } from '../../core/logger';

describe('CircuitBreaker', () => {
  let logger: ConsoleLogger;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    circuitBreaker = new CircuitBreaker(logger, {
      failureThreshold: 3,
      recoveryTimeout: 1000, // 1 second for testing
      successThreshold: 2,
      monitoringWindow: 5000, // 5 seconds
      minimumRequests: 2
    });
  });

  describe('Basic Operation', () => {
    it('should start in closed state', () => {
      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });

    it('should execute successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);

      const stats = circuitBreaker.getStats();
      expect(stats.successCount).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });

    it('should handle failed operations', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation failed');

      const stats = circuitBreaker.getStats();
      expect(stats.failureCount).toBe(1);
      expect(stats.totalRequests).toBe(1);
    });
  });

  describe('State Transitions', () => {
    it('should transition to open state after threshold failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Execute enough failures to trigger opening
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
    });

    it('should reject requests when open', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const initialCallCount = mockOperation.mock.calls.length;

      // Now try to execute - should be rejected immediately
      await expect(circuitBreaker.execute(mockOperation, 'test-operation'))
        .rejects.toThrow('Circuit breaker is OPEN for test-operation');

      // Operation should not have been called again
      expect(mockOperation).toHaveBeenCalledTimes(initialCallCount);
    });

    it('should transition to half-open after recovery timeout', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next execution should transition to half-open
      const successOperation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(successOperation);

      expect(result).toBe('success');
      expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
    });

    it('should transition to closed after successful operations in half-open', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const successOperation = jest.fn().mockResolvedValue('success');

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(failOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful operations to close circuit
      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);

      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should transition back to open if failure occurs in half-open', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      const successOperation = jest.fn().mockResolvedValue('success');

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(failOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute one successful operation to get to half-open
      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);

      // Now fail - should go back to open
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected to fail
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  describe('Configuration', () => {
    it('should respect minimum requests threshold', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Execute one failure (below minimum requests)
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected to fail
      }

      // Should still be closed because we haven't reached minimum requests
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
    });

    it('should use custom configuration', () => {
      const customBreaker = new CircuitBreaker(logger, {
        failureThreshold: 10,
        recoveryTimeout: 5000,
        successThreshold: 5,
        monitoringWindow: 10000,
        minimumRequests: 5
      });

      expect(customBreaker.canExecute()).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should calculate failure rate correctly', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Execute mixed operations
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected to fail
      }

      const stats = circuitBreaker.getStats();
      expect(stats.failureRate).toBeCloseTo(0.33, 2); // 1 failure out of 3 requests
    });

    it('should track last failure and success times', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await circuitBreaker.execute(successOperation);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected to fail
      }

      const stats = circuitBreaker.getStats();
      expect(stats.lastSuccessTime).toBeInstanceOf(Date);
      expect(stats.lastFailureTime).toBeInstanceOf(Date);
      expect(stats.lastFailureTime!.getTime()).toBeGreaterThanOrEqual(stats.lastSuccessTime!.getTime());
    });
  });

  describe('Manual Control', () => {
    it('should allow manual reset', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

      // Reset manually
      circuitBreaker.reset();

      const stats = circuitBreaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
    });

    it('should allow forcing open state', () => {
      expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);

      circuitBreaker.forceOpen();

      expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
    });
  });

  describe('canExecute method', () => {
    it('should return true when circuit is closed', () => {
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it('should return false when circuit is open and recovery timeout not reached', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it('should return true when circuit is open but recovery timeout reached', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Force circuit to open
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(circuitBreaker.canExecute()).toBe(false);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(circuitBreaker.canExecute()).toBe(true);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let logger: ConsoleLogger;
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');
    manager = new CircuitBreakerManager(logger, {
      failureThreshold: 2,
      recoveryTimeout: 1000,
      successThreshold: 1,
      monitoringWindow: 5000,
      minimumRequests: 1
    });
  });

  describe('Service Management', () => {
    it('should create circuit breakers for services', () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service2');

      expect(breaker1).toBeInstanceOf(CircuitBreaker);
      expect(breaker2).toBeInstanceOf(CircuitBreaker);
      expect(breaker1).not.toBe(breaker2);
    });

    it('should reuse existing circuit breakers', () => {
      const breaker1 = manager.getBreaker('service1');
      const breaker2 = manager.getBreaker('service1');

      expect(breaker1).toBe(breaker2);
    });

    it('should execute operations with circuit breaker protection', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await manager.execute('test-service', mockOperation);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide statistics for all circuit breakers', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      await manager.execute('service1', successOperation);
      
      try {
        await manager.execute('service2', failOperation);
      } catch (error) {
        // Expected to fail
      }

      const allStats = manager.getAllStats();

      expect(allStats).toHaveProperty('service1');
      expect(allStats).toHaveProperty('service2');
      expect(allStats.service1.successCount).toBe(1);
      expect(allStats.service2.failureCount).toBe(1);
    });

    it('should identify open circuits', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Force service1 circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('service1', failOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      const openCircuits = manager.getOpenCircuits();
      expect(openCircuits).toContain('service1');
      expect(manager.hasOpenCircuits()).toBe(true);
    });

    it('should reset all circuit breakers', async () => {
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Ensure both services are created by getting their breakers first
      manager.getBreaker('service1');
      manager.getBreaker('service2');

      // Force circuits to open
      for (let i = 0; i < 3; i++) {
        try {
          await manager.execute('service1', failOperation);
          await manager.execute('service2', failOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      expect(manager.hasOpenCircuits()).toBe(true);

      manager.resetAll();

      expect(manager.hasOpenCircuits()).toBe(false);
      
      const allStats = manager.getAllStats();
      expect(allStats).toHaveProperty('service1');
      expect(allStats).toHaveProperty('service2');
      expect(allStats.service1.state).toBe(CircuitState.CLOSED);
      expect(allStats.service2.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('Custom Configuration', () => {
    it('should use service-specific configuration', async () => {
      const customConfig = {
        failureThreshold: 10,
        recoveryTimeout: 5000
      };

      const breaker = manager.getBreaker('custom-service', customConfig);
      
      // This would require more failures to open due to higher threshold
      const failOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Execute failures that would open default config but not custom
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failOperation);
        } catch (error) {
          // Expected to fail
        }
      }

      // Should still be closed due to higher threshold
      expect(breaker.getStats().state).toBe(CircuitState.CLOSED);
    });
  });
});