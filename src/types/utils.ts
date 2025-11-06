// Utility types for the migration tool

// Generic result type for operations that can succeed or fail
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

// Async result type
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Partial configuration type for updates
export type PartialConfig<T> = {
  [P in keyof T]?: T[P];
};

// Deep partial type for nested objects
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Extract keys of a specific type
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

// Make specific properties required
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Omit multiple keys
export type OmitMultiple<T, K extends keyof T> = Omit<T, K>;

// Event emitter types
export type EventMap = Record<string, unknown>;
export type EventKey<T extends EventMap> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

// Timeout configuration
export interface TimeoutConfig {
  connect: number;
  request: number;
  response: number;
}
