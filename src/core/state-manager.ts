// Migration state management implementation

import * as fs from 'fs/promises';
import * as path from 'path';
import { MigrationState, MigrationConfig, QuipDocument } from '../types';
import { IStateManager } from './interfaces';
import { MigrationSession } from './types';

export class StateManager implements IStateManager {
  private readonly stateDir: string;

  constructor(stateDir: string = '.migration-state') {
    this.stateDir = stateDir;
  }

  /**
   * Initialize state directory if it doesn't exist
   */
  private async ensureStateDir(): Promise<void> {
    try {
      await fs.access(this.stateDir);
    } catch {
      await fs.mkdir(this.stateDir, { recursive: true });
    }
  }

  /**
   * Get the file path for a session state
   */
  private getSessionPath(sessionId: string): string {
    return path.join(this.stateDir, `${sessionId}.json`);
  }

  /**
   * Save migration state to disk
   */
  async saveState(sessionId: string, state: MigrationState): Promise<void> {
    await this.ensureStateDir();
    const sessionPath = this.getSessionPath(sessionId);
    
    try {
      const stateData = JSON.stringify(state, null, 2);
      await fs.writeFile(sessionPath, stateData, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save migration state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load migration state from disk
   */
  async loadState(sessionId: string): Promise<MigrationState | null> {
    const sessionPath = this.getSessionPath(sessionId);
    
    try {
      const stateData = await fs.readFile(sessionPath, 'utf8');
      const state = JSON.parse(stateData) as MigrationState;
      
      // Convert date strings back to Date objects
      state.startTime = new Date(state.startTime);
      state.lastUpdateTime = new Date(state.lastUpdateTime);
      state.errors = state.errors.map(error => ({
        ...error,
        timestamp: new Date(error.timestamp)
      }));
      
      return state;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // Session doesn't exist
      }
      throw new Error(`Failed to load migration state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete migration state from disk
   */
  async deleteState(sessionId: string): Promise<void> {
    const sessionPath = this.getSessionPath(sessionId);
    
    try {
      await fs.unlink(sessionPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`Failed to delete migration state: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      // If file doesn't exist, consider it already deleted
    }
  }

  /**
   * List all available migration sessions
   */
  async listSessions(): Promise<string[]> {
    try {
      await this.ensureStateDir();
      const files = await fs.readdir(this.stateDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      throw new Error(`Failed to list migration sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save complete migration session (state + config + documents)
   */
  async saveSession(session: MigrationSession): Promise<void> {
    await this.ensureStateDir();
    const sessionPath = this.getSessionPath(`session-${session.id}`);
    
    try {
      const sessionData = JSON.stringify(session, null, 2);
      await fs.writeFile(sessionPath, sessionData, 'utf8');
    } catch (error) {
      throw new Error(`Failed to save migration session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load complete migration session
   */
  async loadSession(sessionId: string): Promise<MigrationSession | null> {
    const sessionPath = this.getSessionPath(`session-${sessionId}`);
    
    try {
      const sessionData = await fs.readFile(sessionPath, 'utf8');
      const session = JSON.parse(sessionData) as MigrationSession;
      
      // Convert date strings back to Date objects
      session.createdAt = new Date(session.createdAt);
      session.updatedAt = new Date(session.updatedAt);
      session.state.startTime = new Date(session.state.startTime);
      session.state.lastUpdateTime = new Date(session.state.lastUpdateTime);
      session.state.errors = session.state.errors.map(error => ({
        ...error,
        timestamp: new Date(error.timestamp)
      }));
      
      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw new Error(`Failed to load migration session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update session with new state
   */
  async updateSession(sessionId: string, updates: Partial<MigrationSession>): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const updatedSession: MigrationSession = {
      ...session,
      ...updates,
      updatedAt: new Date()
    };

    await this.saveSession(updatedSession);
  }

  /**
   * Create a new migration session
   */
  async createSession(
    sessionId: string,
    config: MigrationConfig,
    documents: QuipDocument[]
  ): Promise<MigrationSession> {
    const now = new Date();
    const initialState: MigrationState = {
      sessionId,
      totalDocuments: documents.length,
      processedDocuments: 0,
      successfulMigrations: 0,
      failedMigrations: 0,
      errors: [],
      startTime: now,
      lastUpdateTime: now
    };

    const session: MigrationSession = {
      id: sessionId,
      config,
      state: initialState,
      documents,
      createdAt: now,
      updatedAt: now
    };

    await this.saveSession(session);
    return session;
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const session = await this.loadSession(sessionId);
    return session !== null;
  }

  /**
   * Get session summary information
   */
  async getSessionSummary(sessionId: string): Promise<{
    id: string;
    totalDocuments: number;
    processedDocuments: number;
    successfulMigrations: number;
    failedMigrations: number;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    return {
      id: session.id,
      totalDocuments: session.state.totalDocuments,
      processedDocuments: session.state.processedDocuments,
      successfulMigrations: session.state.successfulMigrations,
      failedMigrations: session.state.failedMigrations,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }
}