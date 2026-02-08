import type {
  DistributedAdapter,
  DistributedConfig,
  DistributedLockHandle,
  DistributedLockOptions,
  DistributedLockResult,
  DistributedLeaderState,
  DistributedLeaderOptions,
  DistributedMessage,
  DistributedSubscription,
  DistributedInfrastructureMetrics,
  DistributedCompareAndSwapOptions,
  DistributedCompareAndSwapResult,
  DistributedTransaction,
  DistributedTransactionOperation,
  DistributedTransactionOptions,
  DistributedTransactionResult,
  DistributedPublishOptions
} from '../types/index.js';
import { 
  DistributedLockStatus, 
  DistributedLeaderStatus,
  DistributedMessageDelivery
} from '../enums/index.js';

/**
 * Internal config type with all properties required
 */
interface InternalDistributedConfig {
  namespace: string;
  defaultLockTtlMs: number;
  defaultStateTtlMs: number;
  enableLeaderElection: boolean;
  leaderHeartbeatMs: number;
  syncOnEveryChange: boolean;
  syncIntervalMs: number;
  retryConfig: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };
}

/**
 * Prefixes a key with the configured namespace
 */
const prefixKey = (namespace: string | undefined, key: string): string => {
  return namespace ? `${namespace}:${key}` : key;
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
const calculateBackoff = (
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number => {
  const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
};

/**
 * DistributedCoordinator provides a high-level API for distributed operations
 * by wrapping a DistributedAdapter implementation.
 * 
 * Features:
 * - Distributed locking with automatic retry and timeout
 * - Leader election with automatic heartbeat
 * - Distributed state management with conflict resolution
 * - Distributed counters for rate limiting and concurrency control
 * - Pub/sub for real-time coordination
 * 
 * @example
 * ```typescript
 * const coordinator = new DistributedCoordinator({
 *   adapter: new RedisAdapter({ url: 'redis://localhost:6379' }),
 *   namespace: 'my-app',
 *   enableLeaderElection: true
 * });
 * 
 * await coordinator.connect();
 * 
 * // Acquire a lock
 * const lock = await coordinator.withLock('my-resource', async () => {
 *   // Critical section
 *   return await doWork();
 * });
 * 
 * // Use distributed state
 * await coordinator.setState('config', { maxRetries: 3 });
 * const config = await coordinator.getState<{ maxRetries: number }>('config');
 * ```
 */
export class DistributedCoordinator {
  private readonly adapter: DistributedAdapter;
  private readonly config: InternalDistributedConfig;
  private readonly activeLocks = new Map<string, DistributedLockHandle>();
  private readonly activeSubscriptions = new Map<string, DistributedSubscription>();
  private leaderHeartbeatTimer: NodeJS.Timeout | null = null;
  private stateSyncTimer: NodeJS.Timeout | null = null;
  private pendingStateChanges = new Map<string, any>();
  private connected = false;
  private isLeader = false;
  private currentLeaderElectionKey: string | null = null;

  // Metrics
  private metrics: DistributedInfrastructureMetrics;

  constructor(config: DistributedConfig) {
    this.adapter = config.adapter;
    this.config = {
      namespace: config.namespace ?? '',
      defaultLockTtlMs: config.defaultLockTtlMs ?? 30000,
      defaultStateTtlMs: config.defaultStateTtlMs ?? 0,
      enableLeaderElection: config.enableLeaderElection ?? false,
      leaderHeartbeatMs: config.leaderHeartbeatMs ?? 5000,
      syncOnEveryChange: config.syncOnEveryChange ?? true,
      syncIntervalMs: config.syncIntervalMs ?? 1000,
      retryConfig: {
        maxAttempts: config.retryConfig?.maxAttempts ?? 3,
        baseDelayMs: config.retryConfig?.baseDelayMs ?? 100,
        maxDelayMs: config.retryConfig?.maxDelayMs ?? 5000
      }
    };
    this.metrics = this.createInitialMetrics();
  }

  private createInitialMetrics(): DistributedInfrastructureMetrics {
    return {
      nodeId: this.adapter.nodeId,
      isLeader: false,
      connectedNodes: 0,
      lockAcquisitions: 0,
      lockReleases: 0,
      lockConflicts: 0,
      stateOperations: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastSyncTimestamp: 0,
      averageSyncLatencyMs: 0
    };
  }

  /**
   * Get the node ID of this coordinator instance
   */
  get nodeId(): string {
    return this.adapter.nodeId;
  }

  /**
   * Check if this node is currently the leader
   */
  get isCurrentLeader(): boolean {
    return this.isLeader;
  }

  /**
   * Connect to the distributed backend
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    await this.adapter.connect();
    this.connected = true;

    // Start batched state sync if not syncing on every change
    if (!this.config.syncOnEveryChange) {
      this.startStateSyncTimer();
    }
  }

  /**
   * Disconnect from the distributed backend
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    // Stop leader heartbeat
    if (this.leaderHeartbeatTimer) {
      clearInterval(this.leaderHeartbeatTimer);
      this.leaderHeartbeatTimer = null;
    }

    // Stop state sync timer
    if (this.stateSyncTimer) {
      clearInterval(this.stateSyncTimer);
      this.stateSyncTimer = null;
    }

    // Release all held locks
    for (const [_, handle] of this.activeLocks) {
      try {
        await this.adapter.releaseLock(handle);
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    this.activeLocks.clear();

    // Unsubscribe from all channels
    for (const [_, subscription] of this.activeSubscriptions) {
      try {
        await subscription.unsubscribe();
      } catch (e) {
        // Ignore errors during cleanup
      }
    }
    this.activeSubscriptions.clear();

    // Resign leadership if leader
    if (this.isLeader && this.currentLeaderElectionKey) {
      try {
        await this.adapter.resignLeadership(this.prefixKey(this.currentLeaderElectionKey));
      } catch (e) {
        // Ignore errors during cleanup
      }
    }

    await this.adapter.disconnect();
    this.connected = false;
    this.isLeader = false;
  }

  /**
   * Check if the coordinator is connected and healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.connected) return false;
    return this.adapter.isHealthy();
  }

  /**
   * Get current metrics
   */
  getMetrics(): DistributedInfrastructureMetrics {
    return { ...this.metrics, isLeader: this.isLeader };
  }

  // ============================================================================
  // Distributed Locking
  // ============================================================================

  /**
   * Acquire a distributed lock
   */
  async acquireLock(options: DistributedLockOptions): Promise<DistributedLockResult> {
    this.ensureConnected();

    const prefixedResource = this.prefixKey(options.resource);
    const lockOptions: DistributedLockOptions = {
      ...options,
      resource: prefixedResource,
      ttlMs: options.ttlMs ?? this.config.defaultLockTtlMs
    };

    const result = await this.retryOperation(() => this.adapter.acquireLock(lockOptions));

    if (result.status === DistributedLockStatus.ACQUIRED && result.handle) {
      this.activeLocks.set(prefixedResource, result.handle);
      this.metrics.lockAcquisitions++;
    } else if (result.status === DistributedLockStatus.FAILED) {
      this.metrics.lockConflicts++;
    }

    return result;
  }

  /**
   * Release a distributed lock
   */
  async releaseLock(handle: DistributedLockHandle): Promise<boolean> {
    this.ensureConnected();

    const released = await this.adapter.releaseLock(handle);
    if (released) {
      this.activeLocks.delete(handle.resource);
      this.metrics.lockReleases++;
    }
    return released;
  }

  /**
   * Execute a function while holding a distributed lock
   * Automatically acquires and releases the lock
   */
  async withLock<T>(
    resource: string,
    fn: () => T | Promise<T>,
    options?: Omit<DistributedLockOptions, 'resource'>
  ): Promise<T> {
    const lockResult = await this.acquireLock({ resource, ...options });

    if (lockResult.status !== DistributedLockStatus.ACQUIRED || !lockResult.handle) {
      throw new Error(`Failed to acquire lock on resource: ${resource}. Status: ${lockResult.status}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(lockResult.handle);
    }
  }

  /**
   * Extend the TTL of an existing lock
   */
  async extendLock(handle: DistributedLockHandle, additionalMs: number): Promise<DistributedLockResult> {
    this.ensureConnected();
    return this.adapter.extendLock(handle, additionalMs);
  }

  // ============================================================================
  // Distributed State
  // ============================================================================

  /**
   * Get a value from distributed state
   */
  async getState<T = any>(key: string): Promise<T | undefined> {
    this.ensureConnected();
    this.metrics.stateOperations++;

    const result = await this.adapter.getState<T>(this.prefixKey(key));
    return result.success ? result.value : undefined;
  }

  /**
   * Set a value in distributed state
   */
  async setState<T = any>(key: string, value: T, ttlMs?: number): Promise<boolean> {
    this.ensureConnected();
    this.metrics.stateOperations++;

    if (this.config.syncOnEveryChange) {
      const result = await this.adapter.setState(this.prefixKey(key), value, {
        ttlMs: ttlMs ?? this.config.defaultStateTtlMs
      });
      this.metrics.lastSyncTimestamp = Date.now();
      return result.success;
    } else {
      // Batch the change for later sync
      this.pendingStateChanges.set(key, value);
      return true;
    }
  }

  /**
   * Update a value atomically
   */
  async updateState<T = any>(
    key: string,
    updater: (current: T | undefined) => T
  ): Promise<T | undefined> {
    this.ensureConnected();
    this.metrics.stateOperations++;

    const result = await this.adapter.updateState<T>(this.prefixKey(key), updater, {
      ttlMs: this.config.defaultStateTtlMs
    });
    this.metrics.lastSyncTimestamp = Date.now();
    return result.success ? result.value : undefined;
  }

  /**
   * Delete a value from distributed state
   */
  async deleteState(key: string): Promise<boolean> {
    this.ensureConnected();
    this.metrics.stateOperations++;
    return this.adapter.deleteState(this.prefixKey(key));
  }

  /**
   * Get or set a value in distributed state
   * If the key doesn't exist, sets it to the default value
   */
  async getOrSetState<T = any>(key: string, defaultValue: T | (() => T | Promise<T>)): Promise<T> {
    const existing = await this.getState<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    const value = typeof defaultValue === 'function'
      ? await (defaultValue as () => T | Promise<T>)()
      : defaultValue;

    await this.setState(key, value);
    return value;
  }

  // ============================================================================
  // Distributed Counters
  // ============================================================================

  /**
   * Get the current value of a counter
   */
  async getCounter(key: string): Promise<number> {
    this.ensureConnected();
    return this.adapter.getCounter(this.prefixKey(key));
  }

  /**
   * Atomically increment a counter
   */
  async incrementCounter(key: string, delta: number = 1): Promise<number> {
    this.ensureConnected();
    return this.adapter.incrementCounter(this.prefixKey(key), delta);
  }

  /**
   * Atomically decrement a counter
   */
  async decrementCounter(key: string, delta: number = 1): Promise<number> {
    this.ensureConnected();
    return this.adapter.decrementCounter(this.prefixKey(key), delta);
  }

  /**
   * Reset a counter to a specific value
   */
  async resetCounter(key: string, value: number = 0): Promise<void> {
    this.ensureConnected();
    return this.adapter.resetCounter(this.prefixKey(key), value);
  }

  // ============================================================================
  // Leader Election
  // ============================================================================

  /**
   * Campaign to become the leader
   */
  async campaignForLeader(options: DistributedLeaderOptions): Promise<DistributedLeaderState> {
    this.ensureConnected();

    const prefixedKey = this.prefixKey(options.electionKey);
    const leaderOptions: DistributedLeaderOptions = {
      ...options,
      electionKey: prefixedKey,
      ttlMs: options.ttlMs ?? this.config.defaultLockTtlMs,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? this.config.leaderHeartbeatMs,
      onBecomeLeader: async () => {
        this.isLeader = true;
        this.currentLeaderElectionKey = options.electionKey;
        this.startLeaderHeartbeat(prefixedKey, options.heartbeatIntervalMs ?? this.config.leaderHeartbeatMs);
        await options.onBecomeLeader?.();
      },
      onLoseLeadership: async () => {
        this.isLeader = false;
        this.stopLeaderHeartbeat();
        await options.onLoseLeadership?.();
      }
    };

    const state = await this.adapter.campaignForLeader(leaderOptions);
    this.isLeader = state.status === DistributedLeaderStatus.LEADER;
    
    if (this.isLeader) {
      this.currentLeaderElectionKey = options.electionKey;
      this.startLeaderHeartbeat(prefixedKey, options.heartbeatIntervalMs ?? this.config.leaderHeartbeatMs);
    }

    return state;
  }

  /**
   * Resign from leadership
   */
  async resignLeadership(electionKey: string): Promise<void> {
    this.ensureConnected();

    this.stopLeaderHeartbeat();
    await this.adapter.resignLeadership(this.prefixKey(electionKey));
    this.isLeader = false;
    this.currentLeaderElectionKey = null;
  }

  /**
   * Get current leader status
   */
  async getLeaderStatus(electionKey: string): Promise<DistributedLeaderState> {
    this.ensureConnected();
    return this.adapter.getLeaderStatus(this.prefixKey(electionKey));
  }

  // ============================================================================
  // Pub/Sub
  // ============================================================================

  /**
   * Publish a message to a channel
   */
  async publish<T = any>(channel: string, payload: T): Promise<void> {
    this.ensureConnected();
    await this.adapter.publish(this.prefixKey(channel), payload);
    this.metrics.messagesSent++;
  }

  /**
   * Subscribe to messages on a channel
   */
  async subscribe<T = any>(
    channel: string,
    handler: (message: DistributedMessage<T>) => void | Promise<void>,
    options?: { deliveryMode?: DistributedMessageDelivery }
  ): Promise<DistributedSubscription> {
    this.ensureConnected();

    const prefixedChannel = this.prefixKey(channel);
    const wrappedHandler = async (message: DistributedMessage<T>) => {
      this.metrics.messagesReceived++;
      await handler(message);
    };

    const subscription = await this.adapter.subscribe(prefixedChannel, wrappedHandler, options);
    this.activeSubscriptions.set(prefixedChannel, subscription);

    return {
      ...subscription,
      channel,
      unsubscribe: async () => {
        await subscription.unsubscribe();
        this.activeSubscriptions.delete(prefixedChannel);
      }
    };
  }

  /**
   * Publish a message with delivery guarantees
   */
  async publishWithDelivery<T = any>(
    channel: string,
    payload: T,
    options?: DistributedPublishOptions
  ): Promise<void> {
    this.ensureConnected();
    await this.adapter.publish(this.prefixKey(channel), payload, options);
    this.metrics.messagesSent++;
  }

  /**
   * Acknowledge receipt of a message (for at-least-once/exactly-once delivery)
   */
  async acknowledgeMessage(channel: string, messageId: string): Promise<void> {
    this.ensureConnected();
    await this.adapter.acknowledgeMessage(this.prefixKey(channel), messageId);
  }

  /**
   * Get unacknowledged messages for redelivery
   */
  async getUnacknowledgedMessages<T = any>(channel: string, subscriberId: string): Promise<DistributedMessage<T>[]> {
    this.ensureConnected();
    return this.adapter.getUnacknowledgedMessages(this.prefixKey(channel), subscriberId);
  }

  // ============================================================================
  // Compare-and-Swap Operations
  // ============================================================================

  /**
   * Perform a compare-and-swap operation for optimistic concurrency control
   */
  async compareAndSwap<T = any>(options: DistributedCompareAndSwapOptions<T>): Promise<DistributedCompareAndSwapResult<T>> {
    this.ensureConnected();
    this.metrics.stateOperations++;
    
    return this.adapter.compareAndSwap({
      ...options,
      key: this.prefixKey(options.key)
    });
  }

  // ============================================================================
  // Fencing Token Operations
  // ============================================================================

  /**
   * Validate if a fencing token is still valid for a resource
   */
  async validateFencingToken(resource: string, token: number): Promise<boolean> {
    this.ensureConnected();
    return this.adapter.validateFencingToken(this.prefixKey(resource), token);
  }

  /**
   * Get the current fencing token for a resource
   */
  async getCurrentFencingToken(resource: string): Promise<number> {
    this.ensureConnected();
    return this.adapter.getCurrentFencingToken(this.prefixKey(resource));
  }

  /**
   * Execute an operation only if the fencing token is valid
   */
  async withFencedAccess<T>(
    resource: string,
    fencingToken: number,
    fn: () => T | Promise<T>
  ): Promise<T> {
    const isValid = await this.validateFencingToken(resource, fencingToken);
    if (!isValid) {
      throw new Error(`Fencing token ${fencingToken} is no longer valid for resource ${resource}`);
    }
    return fn();
  }

  // ============================================================================
  // Quorum-Based Leader Election
  // ============================================================================

  /**
   * Register this node for quorum-based leader election
   */
  async registerForElection(electionKey: string): Promise<void> {
    this.ensureConnected();
    await this.adapter.registerNode(this.prefixKey(electionKey));
  }

  /**
   * Unregister this node from leader election
   */
  async unregisterFromElection(electionKey: string): Promise<void> {
    this.ensureConnected();
    await this.adapter.unregisterNode(this.prefixKey(electionKey));
  }

  /**
   * Get list of known nodes participating in an election
   */
  async getElectionNodes(electionKey: string): Promise<string[]> {
    this.ensureConnected();
    return this.adapter.getKnownNodes(this.prefixKey(electionKey));
  }

  /**
   * Check if quorum is satisfied for the current leader election
   */
  async hasQuorum(electionKey: string): Promise<boolean> {
    this.ensureConnected();
    const status = await this.adapter.getLeaderStatus(this.prefixKey(electionKey));
    return status.quorum?.hasQuorum ?? true;
  }

  // ============================================================================
  // Distributed Transactions
  // ============================================================================

  /**
   * Begin a new distributed transaction
   */
  async beginTransaction(options?: DistributedTransactionOptions): Promise<DistributedTransaction> {
    this.ensureConnected();
    return this.adapter.beginTransaction(options);
  }

  /**
   * Add an operation to a pending transaction
   */
  async addTransactionOperation(
    transactionId: string, 
    operation: DistributedTransactionOperation
  ): Promise<void> {
    this.ensureConnected();
    // Prefix the key in the operation
    const prefixedOperation: DistributedTransactionOperation = {
      ...operation,
      key: this.prefixKey(operation.key)
    };
    await this.adapter.addTransactionOperation(transactionId, prefixedOperation);
  }

  /**
   * Prepare a transaction (2PC phase 1)
   */
  async prepareTransaction(transactionId: string): Promise<DistributedTransactionResult> {
    this.ensureConnected();
    return this.adapter.prepareTransaction(transactionId);
  }

  /**
   * Commit a prepared transaction (2PC phase 2)
   */
  async commitTransaction(transactionId: string): Promise<DistributedTransactionResult> {
    this.ensureConnected();
    return this.adapter.commitTransaction(transactionId);
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId: string): Promise<DistributedTransactionResult> {
    this.ensureConnected();
    return this.adapter.rollbackTransaction(transactionId);
  }

  /**
   * Execute a transaction atomically (combines begin, prepare, commit)
   * 
   * @example
   * ```typescript
   * const result = await coordinator.executeTransaction([
   *   { type: DistributedTransactionOperationType.SET, key: 'account:1', value: { balance: 100 } },
   *   { type: DistributedTransactionOperationType.SET, key: 'account:2', value: { balance: 200 } },
   *   { type: DistributedTransactionOperationType.INCREMENT, key: 'counter:transfers', delta: 1 }
   * ]);
   * ```
   */
  async executeTransaction(
    operations: DistributedTransactionOperation[],
    options?: DistributedTransactionOptions
  ): Promise<DistributedTransactionResult> {
    this.ensureConnected();
    
    // Prefix all keys in operations
    const prefixedOperations = operations.map(op => ({
      ...op,
      key: this.prefixKey(op.key)
    }));
    
    return this.adapter.executeTransaction(prefixedOperations, options);
  }

  /**
   * Execute multiple state operations atomically as a transaction
   * Convenience method for common transaction patterns
   */
  async atomicUpdate(
    updates: Array<{ key: string; value: any }>,
    options?: DistributedTransactionOptions
  ): Promise<DistributedTransactionResult> {
    const operations: DistributedTransactionOperation[] = updates.map(u => ({
      type: 'set' as any, // Will be DistributedTransactionOperationType.SET
      key: u.key,
      value: u.value
    }));
    
    return this.executeTransaction(operations, options);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private prefixKey(key: string): string {
    return prefixKey(this.config.namespace, key);
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('DistributedCoordinator is not connected. Call connect() first.');
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = this.config.retryConfig.maxAttempts
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxAttempts - 1) {
          const delay = calculateBackoff(
            attempt,
            this.config.retryConfig.baseDelayMs,
            this.config.retryConfig.maxDelayMs
          );
          await sleep(delay);
        }
      }
    }

    throw lastError ?? new Error('Operation failed after retries');
  }

  private startLeaderHeartbeat(electionKey: string, intervalMs: number): void {
    this.stopLeaderHeartbeat();

    this.leaderHeartbeatTimer = setInterval(async () => {
      try {
        const stillLeader = await this.adapter.sendLeaderHeartbeat(electionKey);
        if (!stillLeader) {
          this.isLeader = false;
          this.stopLeaderHeartbeat();
        }
      } catch (error) {
        console.warn('stable-infra: Leader heartbeat failed:', error);
      }
    }, intervalMs);
  }

  private stopLeaderHeartbeat(): void {
    if (this.leaderHeartbeatTimer) {
      clearInterval(this.leaderHeartbeatTimer);
      this.leaderHeartbeatTimer = null;
    }
  }

  private startStateSyncTimer(): void {
    this.stateSyncTimer = setInterval(async () => {
      await this.flushPendingStateChanges();
    }, this.config.syncIntervalMs);
  }

  private async flushPendingStateChanges(): Promise<void> {
    if (this.pendingStateChanges.size === 0) return;

    const changes = new Map(this.pendingStateChanges);
    this.pendingStateChanges.clear();

    const startTime = Date.now();
    for (const [key, value] of changes) {
      try {
        await this.adapter.setState(this.prefixKey(key), value, {
          ttlMs: this.config.defaultStateTtlMs
        });
      } catch (error) {
        console.warn(`stable-infra: Failed to sync state for key ${key}:`, error);
        // Re-queue failed changes
        this.pendingStateChanges.set(key, value);
      }
    }
    
    const syncLatency = Date.now() - startTime;
    this.metrics.averageSyncLatencyMs = 
      (this.metrics.averageSyncLatencyMs + syncLatency) / 2;
    this.metrics.lastSyncTimestamp = Date.now();
  }
}

/**
 * Create a distributed coordinator with the given configuration
 */
export const createDistributedCoordinator = (config: DistributedConfig): DistributedCoordinator => {
  return new DistributedCoordinator(config);
};
