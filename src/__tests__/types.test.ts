// Basic test to verify TypeScript types and Jest setup

import { MigrationState, MigrationConfig, QuipDocument } from '../types';

describe('Core Types', () => {
  it('should create a valid MigrationConfig', () => {
    const config: MigrationConfig = {
      batchSize: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      outputFormat: 'native',
      preserveFolderStructure: true,

      includeSharedDocuments: false,
    };

    expect(config.batchSize).toBe(10);
    expect(config.outputFormat).toBe('native');
  });

  it('should create a valid MigrationState', () => {
    const state: MigrationState = {
      sessionId: 'test-session-123',
      totalDocuments: 100,
      processedDocuments: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      errors: [],
      startTime: new Date(),
      lastUpdateTime: new Date(),
    };

    expect(state.sessionId).toBe('test-session-123');
    expect(state.totalDocuments).toBe(100);
    expect(state.errors).toHaveLength(0);
  });

  it('should create a valid QuipDocument', () => {
    const document: QuipDocument = {
      id: 'doc-123',
      title: 'Test Document',
      type: 'DOCUMENT',
      created_usec: Date.now() * 1000,
      updated_usec: Date.now() * 1000,
      author_id: 'user-123',
      owning_company_id: 'company-123',
      link: 'https://quip.com/doc-123',
      secret_path: 'secret-path-123',
      is_template: false,
      is_deleted: false,
    };

    expect(document.id).toBe('doc-123');
    expect(document.type).toBe('DOCUMENT');
    expect(document.is_deleted).toBe(false);
  });
});