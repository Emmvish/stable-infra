import type {
  DistributedAdapter,
  DistributedLockHandle,
  DistributedLockOptions,
  DistributedLockResult,
  DistributedLeaderState,
  DistributedLeaderOptions,
  DistributedStateResult,
  DistributedStateOptions,
  DistributedMessage,
  DistributedSubscription,
  DistributedCompareAndSwapOptions,
  DistributedCompareAndSwapResult,
  DistributedTransaction,
  DistributedTransactionOperation,
  DistributedTransactionOptions,
  DistributedTransactionResult,
  DistributedQuorumInfo,
  DistributedPublishOptions
} from '../types/index.js';
import { 
  DistributedLockStatus, 
  DistributedLeaderStatus,
  DistributedConsistencyLevel,
  DistributedTransactionStatus,
  DistributedTransactionOperationType,
  DistributedMessageDelivery,
  DistributedLockRenewalMode
} from '../enums/index.js';

/**
 * Generate a unique ID for this process/node
 */
const generateNodeId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `node-${timestamp}-${random}`;
};

/**
 * Generate a unique message ID
 */
const generateMessageId = (): string => {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Generate a unique transaction ID
 */
const generateTransactionId = (): string => {
  return `txn-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
};

interface StateEntry {
  value: any;
  version: number;
  expiresAt?: number;
}

interface LeaderEntry {
  leaderId: string;
  term: number;
  expiresAt: number;
  nodes: Set<string>;
  quorumSize: number;
  votes: Map<string, number>;
}

interface PendingMessage {
  message: DistributedMessage;
  acks: Set<string>;
  subscribers: Set<string>;
  retryCount: number;
  maxRetries: number;
}

/**
 * In-Memory Distributed Adapter with Full Feature Support
 * 
 * This adapter provides an in-memory implementation of the DistributedAdapter interface
 * with support for:
 * - Fencing tokens for locks
 * - Auto lock renewal
 * - Quorum-based leader election
 * - Distributed transactions
 * - Compare-and-swap operations
 * - Guaranteed message delivery (at-least-once, exactly-once)
 * 
 * NOTE: This adapter does NOT provide true distributed coordination across multiple
 * processes or machines. For production distributed deployments, use a proper
 * distributed backend adapter (Redis, PostgreSQL, etc.)
 * 
 * @example
 * ```typescript
 * const adapter = new InMemoryDistributedAdapter();
 * const coordinator = new DistributedCoordinator({
 *   adapter,
 *   namespace: 'my-app'
 * });
 * ```
 */
export class InMemoryDistributedAdapter implements DistributedAdapter {
  readonly nodeId: string;
  
  private connected = false;
  private readonly state = new Map<string, StateEntry>();
  private readonly locks = new Map<string, DistributedLockHandle>();
  private readonly fencingTokens = new Map<string, number>();
  private readonly counters = new Map<string, number>();
  private readonly leaders = new Map<string, LeaderEntry>();
  private readonly subscriptions = new Map<string, Map<string, (message: DistributedMessage) => void | Promise<void>>>();
  private readonly pendingMessages = new Map<string, Map<string, PendingMessage>>();
  private readonly processedMessageIds = new Map<string, Set<string>>();
  private readonly transactions = new Map<string, DistributedTransaction & { 
    stagedOperations: Map<string, { value: any; version: number }>;
    lockedKeys: Set<string>;
  }>();
  private readonly renewalTimers = new Map<string, NodeJS.Timeout>();
  
  private cleanupTimer: NodeJS.Timeout | null = null;
  private messageRetryTimer: NodeJS.Timeout | null = null;
  
  // Mutex for CAS operations to ensure atomicity
  private readonly casMutex = new Map<string, Promise<void>>();

  constructor(nodeId?: string) {
    this.nodeId = nodeId ?? generateNodeId();
  }

  async connect(): Promise<void> {
    this.connected = true;
    // Start cleanup timer for expired entries
    this.cleanupTimer = setInterval(() => this.cleanup(), 1000);
    // Start message retry timer for guaranteed delivery
    this.messageRetryTimer = setInterval(() => this.retryPendingMessages(), 500);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.messageRetryTimer) {
      clearInterval(this.messageRetryTimer);
      this.messageRetryTimer = null;
    }
    // Clear all renewal timers
    for (const timer of this.renewalTimers.values()) {
      clearInterval(timer);
    }
    this.renewalTimers.clear();
  }

  async isHealthy(): Promise<boolean> {
    return this.connected;
  }

  /**
   * Helper to acquire a mutex for atomic operations on a key
   */
  private async withMutex<T>(key: string, operation: () => T | Promise<T>): Promise<T> {
    // Wait for any existing operation on this key to complete
    const existing = this.casMutex.get(key);
    if (existing) {
      await existing;
    }
    
    // Create a new promise for our operation
    let resolve: () => void;
    const mutex = new Promise<void>(r => { resolve = r; });
    this.casMutex.set(key, mutex);
    
    try {
      return await operation();
    } finally {
      resolve!();
      this.casMutex.delete(key);
    }
  }

  // ============================================================================
  // Distributed Locking with Fencing Tokens
  // ============================================================================

  async acquireLock(options: DistributedLockOptions): Promise<DistributedLockResult> {
    const { 
      resource, 
      ttlMs = 30000, 
      waitTimeoutMs = 0, 
      retryIntervalMs = 100,
      renewalMode = DistributedLockRenewalMode.MANUAL,
      renewalIntervalMs,
      onRenewalFailure
    } = options;
    
    const startTime = Date.now();
    
    while (true) {
      const existingLock = this.locks.get(resource);
      const now = Date.now();
      
      // Check if existing lock is expired
      if (existingLock && existingLock.expiresAt > now) {
        // Lock is held by someone else
        if (waitTimeoutMs === 0 || (now - startTime) >= waitTimeoutMs) {
          return { status: DistributedLockStatus.FAILED, error: 'Lock is held by another owner' };
        }
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
        continue;
      }
      
      // Increment fencing token
      const currentFencingToken = this.fencingTokens.get(resource) ?? 0;
      const newFencingToken = currentFencingToken + 1;
      this.fencingTokens.set(resource, newFencingToken);
      
      // Acquire the lock
      const handle: DistributedLockHandle = {
        lockId: `lock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        resource,
        acquiredAt: now,
        expiresAt: now + ttlMs,
        ownerId: this.nodeId,
        fencingToken: newFencingToken
      };
      
      this.locks.set(resource, handle);
      
      // Setup auto-renewal if enabled
      if (renewalMode === DistributedLockRenewalMode.AUTO) {
        const interval = renewalIntervalMs ?? Math.floor(ttlMs / 3);
        const timer = setInterval(async () => {
          const result = await this.extendLock(handle, ttlMs);
          if (result.status !== DistributedLockStatus.ACQUIRED) {
            clearInterval(timer);
            this.renewalTimers.delete(handle.lockId);
            if (onRenewalFailure) {
              onRenewalFailure(handle, new Error('Failed to renew lock'));
            }
          }
        }, interval);
        
        handle.renewalTimerId = timer;
        this.renewalTimers.set(handle.lockId, timer);
      }
      
      return { 
        status: DistributedLockStatus.ACQUIRED, 
        handle,
        fencingToken: newFencingToken
      };
    }
  }

  async releaseLock(handle: DistributedLockHandle): Promise<boolean> {
    const existingLock = this.locks.get(handle.resource);
    
    if (!existingLock) {
      return false;
    }
    
    // Only release if we own the lock
    if (existingLock.ownerId !== handle.ownerId || existingLock.lockId !== handle.lockId) {
      return false;
    }
    
    // Stop renewal timer if active
    if (handle.renewalTimerId) {
      clearInterval(handle.renewalTimerId);
      this.renewalTimers.delete(handle.lockId);
    }
    
    this.locks.delete(handle.resource);
    return true;
  }

  async extendLock(handle: DistributedLockHandle, additionalMs: number): Promise<DistributedLockResult> {
    const existingLock = this.locks.get(handle.resource);
    
    if (!existingLock || existingLock.ownerId !== handle.ownerId || existingLock.lockId !== handle.lockId) {
      return { status: DistributedLockStatus.FAILED, error: 'Lock not found or not owned' };
    }
    
    // Check if lock has been fenced (a newer lock was acquired)
    if (existingLock.fencingToken !== handle.fencingToken) {
      return { status: DistributedLockStatus.FENCED, error: 'Lock has been fenced' };
    }
    
    const newHandle: DistributedLockHandle = {
      ...existingLock,
      expiresAt: existingLock.expiresAt + additionalMs
    };
    
    this.locks.set(handle.resource, newHandle);
    return { status: DistributedLockStatus.ACQUIRED, handle: newHandle };
  }

  async validateFencingToken(resource: string, token: number): Promise<boolean> {
    const currentToken = this.fencingTokens.get(resource) ?? 0;
    return token >= currentToken;
  }

  async getCurrentFencingToken(resource: string): Promise<number> {
    return this.fencingTokens.get(resource) ?? 0;
  }

  // ============================================================================
  // Distributed State with Versioning and Consistency
  // ============================================================================

  async getState<T = any>(
    key: string, 
    options?: { consistencyLevel?: DistributedConsistencyLevel }
  ): Promise<DistributedStateResult<T>> {
    // In-memory adapter always provides linearizable reads
    // Real implementations would handle different consistency levels
    const entry = this.state.get(key);
    
    if (!entry) {
      return { success: true, value: undefined, version: 0 };
    }
    
    // Check expiration
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.state.delete(key);
      return { success: true, value: undefined, version: 0 };
    }
    
    return { success: true, value: entry.value, version: entry.version };
  }

  async setState<T = any>(
    key: string, 
    value: T, 
    options?: Omit<DistributedStateOptions, 'key'>
  ): Promise<DistributedStateResult<T>> {
    const existing = this.state.get(key);
    
    // Optimistic locking check
    if (options?.version !== undefined && existing && existing.version !== options.version) {
      return { success: false, error: 'Version mismatch', conflicted: true, version: existing.version };
    }
    
    // Fencing token validation
    if (options?.fencingToken !== undefined) {
      const isValid = await this.validateFencingToken(key, options.fencingToken);
      if (!isValid) {
        return { success: false, error: 'Invalid fencing token', conflicted: true };
      }
    }
    
    const newVersion = (existing?.version ?? 0) + 1;
    
    this.state.set(key, {
      value,
      version: newVersion,
      expiresAt: options?.ttlMs ? Date.now() + options.ttlMs : undefined
    });
    
    return { success: true, value, version: newVersion };
  }

  async updateState<T = any>(
    key: string, 
    updater: (current: T | undefined) => T,
    options?: Omit<DistributedStateOptions, 'key'>
  ): Promise<DistributedStateResult<T>> {
    const existing = this.state.get(key);
    const currentValue = existing?.value as T | undefined;
    const newValue = updater(currentValue);
    
    return this.setState(key, newValue, { 
      ...options, 
      version: existing?.version 
    });
  }

  async deleteState(key: string): Promise<boolean> {
    return this.state.delete(key);
  }

  async compareAndSwap<T = any>(options: DistributedCompareAndSwapOptions<T>): Promise<DistributedCompareAndSwapResult<T>> {
    const { key, expectedValue, expectedVersion, newValue, ttlMs } = options;
    
    // Use mutex to ensure atomic check-and-swap
    return this.withMutex(key, () => {
      const existing = this.state.get(key);
      
      // Check version condition
      if (expectedVersion !== undefined) {
        const currentVersion = existing?.version ?? 0;
        if (currentVersion !== expectedVersion) {
          return {
            success: false,
            swapped: false,
            currentValue: existing?.value,
            currentVersion
          };
        }
      }
      
      // Check value condition
      if (expectedValue !== undefined) {
        if (JSON.stringify(existing?.value) !== JSON.stringify(expectedValue)) {
          return {
            success: false,
            swapped: false,
            currentValue: existing?.value,
            currentVersion: existing?.version ?? 0
          };
        }
      }
      
      // Perform the swap
      const newVersion = (existing?.version ?? 0) + 1;
      this.state.set(key, {
        value: newValue,
        version: newVersion,
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined
      });
      
      return {
        success: true,
        swapped: true,
        currentValue: newValue,
        currentVersion: newVersion,
        version: newVersion
      };
    });
  }

  // ============================================================================
  // Distributed Counters
  // ============================================================================

  async getCounter(key: string): Promise<number> {
    return this.counters.get(key) ?? 0;
  }

  async incrementCounter(key: string, delta: number = 1): Promise<number> {
    const current = this.counters.get(key) ?? 0;
    const newValue = current + delta;
    this.counters.set(key, newValue);
    return newValue;
  }

  async decrementCounter(key: string, delta: number = 1): Promise<number> {
    const current = this.counters.get(key) ?? 0;
    const newValue = current - delta;
    this.counters.set(key, newValue);
    return newValue;
  }

  async resetCounter(key: string, value: number = 0): Promise<void> {
    this.counters.set(key, value);
  }

  // ============================================================================
  // Quorum-Based Leader Election
  // ============================================================================

  async campaignForLeader(options: DistributedLeaderOptions): Promise<DistributedLeaderState> {
    const { 
      electionKey, 
      ttlMs = 30000,
      quorumSize = 0,
      onPartitionDetected,
      onPartitionResolved
    } = options;
    const now = Date.now();
    
    let existing = this.leaders.get(electionKey);
    
    // Initialize election state if not exists
    if (!existing) {
      existing = {
        leaderId: '',
        term: 0,
        expiresAt: 0,
        nodes: new Set(),
        quorumSize: quorumSize,
        votes: new Map()
      };
      this.leaders.set(electionKey, existing);
    }
    
    // Register this node
    existing.nodes.add(this.nodeId);
    existing.quorumSize = quorumSize > 0 ? quorumSize : Math.floor(existing.nodes.size / 2) + 1;
    
    // Check if current leader's lease has expired
    const leaderExpired = existing.expiresAt < now;
    const isCurrentLeader = existing.leaderId === this.nodeId;
    
    if (!leaderExpired && !isCurrentLeader && existing.leaderId) {
      // Another leader exists and is still valid
      const quorumInfo = this.getQuorumInfo(existing);
      
      // Check for partition
      if (!quorumInfo.hasQuorum && onPartitionDetected) {
        setTimeout(() => onPartitionDetected(), 0);
      }
      
      return {
        leaderId: existing.leaderId,
        status: DistributedLeaderStatus.FOLLOWER,
        term: existing.term,
        lastHeartbeat: now,
        nodeId: this.nodeId,
        quorum: quorumInfo,
        partitionDetected: !quorumInfo.hasQuorum
      };
    }
    
    // Try to become the leader
    const newTerm = existing.term + 1;
    existing.votes.set(this.nodeId, newTerm);
    
    // Check if we have enough votes (quorum)
    const votesForTerm = Array.from(existing.votes.entries())
      .filter(([_, term]) => term === newTerm).length;
    
    const hasQuorum = existing.quorumSize === 0 || votesForTerm >= existing.quorumSize;
    
    if (hasQuorum) {
      // Become the leader
      existing.leaderId = this.nodeId;
      existing.term = newTerm;
      existing.expiresAt = now + ttlMs;
      
      // Trigger callback
      if (options.onBecomeLeader) {
        setTimeout(() => options.onBecomeLeader!(), 0);
      }
      
      return {
        leaderId: this.nodeId,
        status: DistributedLeaderStatus.LEADER,
        term: newTerm,
        lastHeartbeat: now,
        nodeId: this.nodeId,
        quorum: this.getQuorumInfo(existing),
        partitionDetected: false
      };
    }
    
    // Not enough votes, remain candidate
    return {
      leaderId: existing.leaderId || null,
      status: DistributedLeaderStatus.CANDIDATE,
      term: newTerm,
      lastHeartbeat: now,
      nodeId: this.nodeId,
      quorum: this.getQuorumInfo(existing),
      partitionDetected: !hasQuorum
    };
  }

  private getQuorumInfo(entry: LeaderEntry): DistributedQuorumInfo {
    const votesForCurrentTerm = Array.from(entry.votes.entries())
      .filter(([_, term]) => term === entry.term)
      .map(([nodeId]) => nodeId);
    
    return {
      totalNodes: entry.nodes.size,
      votesReceived: votesForCurrentTerm.length,
      required: entry.quorumSize,
      quorumThreshold: entry.quorumSize,
      hasQuorum: entry.quorumSize === 0 || votesForCurrentTerm.length >= entry.quorumSize,
      acknowledgedNodes: votesForCurrentTerm
    };
  }

  async resignLeadership(electionKey: string): Promise<void> {
    const existing = this.leaders.get(electionKey);
    if (existing && existing.leaderId === this.nodeId) {
      existing.leaderId = '';
      existing.expiresAt = 0;
      existing.votes.clear();
    }
  }

  async getLeaderStatus(electionKey: string): Promise<DistributedLeaderState> {
    const existing = this.leaders.get(electionKey);
    const now = Date.now();
    
    if (!existing || existing.expiresAt < now) {
      return {
        leaderId: null,
        status: DistributedLeaderStatus.CANDIDATE,
        term: existing?.term ?? 0,
        lastHeartbeat: 0,
        nodeId: this.nodeId,
        quorum: existing ? this.getQuorumInfo(existing) : undefined
      };
    }
    
    return {
      leaderId: existing.leaderId || null,
      status: existing.leaderId === this.nodeId 
        ? DistributedLeaderStatus.LEADER 
        : DistributedLeaderStatus.FOLLOWER,
      term: existing.term,
      lastHeartbeat: now,
      nodeId: this.nodeId,
      quorum: this.getQuorumInfo(existing)
    };
  }

  async sendLeaderHeartbeat(electionKey: string): Promise<boolean> {
    const existing = this.leaders.get(electionKey);
    
    if (!existing || existing.leaderId !== this.nodeId) {
      return false;
    }
    
    // Extend the lease
    existing.expiresAt = Date.now() + 30000;
    // Refresh vote
    existing.votes.set(this.nodeId, existing.term);
    return true;
  }

  async registerNode(electionKey: string): Promise<void> {
    let existing = this.leaders.get(electionKey);
    if (!existing) {
      existing = {
        leaderId: '',
        term: 0,
        expiresAt: 0,
        nodes: new Set(),
        quorumSize: 0,
        votes: new Map()
      };
      this.leaders.set(electionKey, existing);
    }
    existing.nodes.add(this.nodeId);
  }

  async unregisterNode(electionKey: string): Promise<void> {
    const existing = this.leaders.get(electionKey);
    if (existing) {
      existing.nodes.delete(this.nodeId);
      existing.votes.delete(this.nodeId);
    }
  }

  async getKnownNodes(electionKey: string): Promise<string[]> {
    const existing = this.leaders.get(electionKey);
    return existing ? Array.from(existing.nodes) : [];
  }

  // ============================================================================
  // Pub/Sub with Guaranteed Delivery
  // ============================================================================

  async publish<T = any>(
    channel: string, 
    payload: T, 
    options?: DistributedPublishOptions
  ): Promise<void> {
    const channelSubs = this.subscriptions.get(channel);
    
    if (!channelSubs || channelSubs.size === 0) {
      return;
    }
    
    const deliveryMode = options?.deliveryMode ?? DistributedMessageDelivery.AT_MOST_ONCE;
    const messageId = generateMessageId();
    
    const message: DistributedMessage<T> = {
      channel,
      payload,
      publisherId: this.nodeId,
      timestamp: Date.now(),
      messageId,
      deliveryMode,
      sequenceNumber: await this.incrementCounter(`pubsub:seq:${channel}`),
      requiresAck: deliveryMode !== DistributedMessageDelivery.AT_MOST_ONCE
    };
    
    if (deliveryMode === DistributedMessageDelivery.AT_MOST_ONCE) {
      // Fire and forget
      for (const [_, handler] of channelSubs) {
        Promise.resolve(handler(message)).catch(err => {
          console.warn('stable-infra: Subscription handler error:', err);
        });
      }
    } else {
      // Track message for redelivery
      if (!this.pendingMessages.has(channel)) {
        this.pendingMessages.set(channel, new Map());
      }
      
      const pending: PendingMessage = {
        message,
        acks: new Set(),
        subscribers: new Set(channelSubs.keys()),
        retryCount: 0,
        maxRetries: options?.maxRetries ?? 10
      };
      
      this.pendingMessages.get(channel)!.set(messageId, pending);
      
      // Deliver to subscribers
      for (const [subscriberId, handler] of channelSubs) {
        this.deliverMessage(handler, message, pending, subscriberId);
      }
      
      // Wait for acks if requested
      if (options?.waitForAck) {
        const timeout = options.ackTimeoutMs ?? 5000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
          if (pending.acks.size === pending.subscribers.size) {
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    }
  }

  private async deliverMessage(
    handler: (message: DistributedMessage) => void | Promise<void>,
    message: DistributedMessage,
    pending: PendingMessage,
    subscriberId: string
  ): Promise<void> {
    // For exactly-once, check if already processed
    if (message.deliveryMode === DistributedMessageDelivery.EXACTLY_ONCE) {
      const processed = this.processedMessageIds.get(subscriberId);
      if (processed?.has(message.messageId)) {
        pending.acks.add(subscriberId);
        return;
      }
    }
    
    try {
      await handler(message);
      // For at-least-once, don't auto-ack - subscriber must call acknowledge
      if (message.deliveryMode === DistributedMessageDelivery.EXACTLY_ONCE) {
        // Mark as processed to prevent redelivery
        if (!this.processedMessageIds.has(subscriberId)) {
          this.processedMessageIds.set(subscriberId, new Set());
        }
        this.processedMessageIds.get(subscriberId)!.add(message.messageId);
      }
    } catch (err) {
      console.warn('stable-infra: Subscription handler error:', err);
    }
  }

  private retryPendingMessages(): void {
    for (const [channel, messages] of this.pendingMessages) {
      const channelSubs = this.subscriptions.get(channel);
      if (!channelSubs) continue;
      
      for (const [messageId, pending] of messages) {
        // Find subscribers that haven't acked
        const unacked = Array.from(pending.subscribers).filter(s => !pending.acks.has(s));
        
        if (unacked.length === 0) {
          // All acked, remove from pending
          messages.delete(messageId);
          continue;
        }
        
        if (pending.retryCount >= pending.maxRetries) {
          // Max retries exceeded, remove from pending
          messages.delete(messageId);
          continue;
        }
        
        pending.retryCount++;
        
        // Redeliver to unacked subscribers
        for (const subscriberId of unacked) {
          const handler = channelSubs.get(subscriberId);
          if (handler) {
            this.deliverMessage(handler, pending.message, pending, subscriberId);
          }
        }
      }
    }
  }

  async subscribe<T = any>(
    channel: string, 
    handler: (message: DistributedMessage<T>) => void | Promise<void>,
    options?: { deliveryMode?: DistributedMessageDelivery }
  ): Promise<DistributedSubscription> {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Map());
    }
    
    const channelSubs = this.subscriptions.get(channel)!;
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    channelSubs.set(subscriptionId, handler as (message: DistributedMessage) => void | Promise<void>);
    
    return {
      subscriptionId,
      channel,
      unsubscribe: async () => {
        channelSubs.delete(subscriptionId);
        if (channelSubs.size === 0) {
          this.subscriptions.delete(channel);
        }
        // Remove any pending message tracking for this subscriber
        const pending = this.pendingMessages.get(channel);
        if (pending) {
          for (const msg of pending.values()) {
            msg.subscribers.delete(subscriptionId);
          }
        }
      },
      acknowledge: async (messageId: string) => {
        const pending = this.pendingMessages.get(channel);
        if (pending) {
          const msg = pending.get(messageId);
          if (msg) {
            msg.acks.add(subscriptionId);
          }
        }
      }
    };
  }

  async acknowledgeMessage(channel: string, messageId: string): Promise<void> {
    const pending = this.pendingMessages.get(channel);
    if (pending) {
      const msg = pending.get(messageId);
      if (msg) {
        // Mark all subscribers as acked (this is a simplified implementation)
        msg.acks = new Set(msg.subscribers);
      }
    }
  }

  async getUnacknowledgedMessages<T = any>(channel: string, subscriberId: string): Promise<DistributedMessage<T>[]> {
    const pending = this.pendingMessages.get(channel);
    if (!pending) return [];
    
    return Array.from(pending.values())
      .filter(p => p.subscribers.has(subscriberId) && !p.acks.has(subscriberId))
      .map(p => p.message as DistributedMessage<T>);
  }

  // ============================================================================
  // Distributed Transactions
  // ============================================================================

  async beginTransaction(options?: DistributedTransactionOptions): Promise<DistributedTransaction> {
    const transactionId = generateTransactionId();
    const transaction: DistributedTransaction & { 
      stagedOperations: Map<string, { value: any; version: number }>;
      lockedKeys: Set<string>;
    } = {
      transactionId,
      status: DistributedTransactionStatus.PENDING,
      operations: [],
      createdAt: Date.now(),
      timeoutMs: options?.timeoutMs ?? 30000,
      initiatorNodeId: this.nodeId,
      stagedOperations: new Map(),
      lockedKeys: new Set()
    };
    
    this.transactions.set(transactionId, transaction);
    return transaction;
  }

  async addTransactionOperation(transactionId: string, operation: DistributedTransactionOperation): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    if (transaction.status !== DistributedTransactionStatus.PENDING) {
      throw new Error(`Transaction ${transactionId} is not pending`);
    }
    
    transaction.operations.push(operation);
  }

  async prepareTransaction(transactionId: string): Promise<DistributedTransactionResult> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return { transactionId, status: DistributedTransactionStatus.FAILED, success: false, error: 'Transaction not found' };
    }
    
    if (transaction.status !== DistributedTransactionStatus.PENDING) {
      return { transactionId, status: transaction.status, success: false, error: 'Transaction is not pending' };
    }
    
    // Check timeout
    if (Date.now() - transaction.createdAt > transaction.timeoutMs) {
      transaction.status = DistributedTransactionStatus.TIMEOUT;
      return { transactionId, status: DistributedTransactionStatus.TIMEOUT, success: false, error: 'Transaction timed out' };
    }
    
    try {
      // Acquire locks on all keys involved
      for (const op of transaction.operations) {
        const lockResult = await this.acquireLock({ 
          resource: `txn:${op.key}`, 
          ttlMs: transaction.timeoutMs,
          waitTimeoutMs: 1000
        });
        
        if (lockResult.status !== DistributedLockStatus.ACQUIRED) {
          // Rollback any acquired locks
          for (const key of transaction.lockedKeys) {
            const handle = this.locks.get(`txn:${key}`);
            if (handle) {
              await this.releaseLock(handle);
            }
          }
          transaction.status = DistributedTransactionStatus.FAILED;
          return { transactionId, status: DistributedTransactionStatus.FAILED, success: false, error: `Failed to lock key: ${op.key}` };
        }
        
        transaction.lockedKeys.add(op.key);
      }
      
      // Stage all operations (validate they can be performed)
      for (const op of transaction.operations) {
        const current = this.state.get(op.key);
        const currentVersion = current?.version ?? 0;
        
        if (op.type === DistributedTransactionOperationType.COMPARE_AND_SWAP) {
          if (op.expectedVersion !== undefined && currentVersion !== op.expectedVersion) {
            throw new Error(`Version mismatch for key ${op.key}`);
          }
        }
        
        // Calculate the staged value
        let stagedValue: any;
        switch (op.type) {
          case DistributedTransactionOperationType.SET:
            stagedValue = op.value;
            break;
          case DistributedTransactionOperationType.DELETE:
            stagedValue = undefined;
            break;
          case DistributedTransactionOperationType.INCREMENT:
            stagedValue = (current?.value ?? 0) + (op.delta ?? 1);
            break;
          case DistributedTransactionOperationType.DECREMENT:
            stagedValue = (current?.value ?? 0) - (op.delta ?? 1);
            break;
          case DistributedTransactionOperationType.COMPARE_AND_SWAP:
            stagedValue = op.value;
            break;
        }
        
        transaction.stagedOperations.set(op.key, { value: stagedValue, version: currentVersion + 1 });
      }
      
      transaction.status = DistributedTransactionStatus.PREPARED;
      transaction.preparedAt = Date.now();
      
      return { transactionId, status: DistributedTransactionStatus.PREPARED, success: true };
    } catch (error) {
      // Release locks
      for (const key of transaction.lockedKeys) {
        const handle = this.locks.get(`txn:${key}`);
        if (handle) {
          await this.releaseLock(handle);
        }
      }
      transaction.status = DistributedTransactionStatus.FAILED;
      return { 
        transactionId, 
        status: DistributedTransactionStatus.FAILED, 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async commitTransaction(transactionId: string): Promise<DistributedTransactionResult> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return { transactionId, status: DistributedTransactionStatus.FAILED, success: false, error: 'Transaction not found' };
    }
    
    if (transaction.status !== DistributedTransactionStatus.PREPARED) {
      return { transactionId, status: transaction.status, success: false, error: 'Transaction is not prepared' };
    }
    
    const results: Array<{ key: string; success: boolean; value?: any; version?: number }> = [];
    
    try {
      // Apply all staged operations atomically
      for (const [key, staged] of transaction.stagedOperations) {
        if (staged.value === undefined) {
          this.state.delete(key);
          results.push({ key, success: true });
        } else {
          this.state.set(key, { value: staged.value, version: staged.version });
          results.push({ key, success: true, value: staged.value, version: staged.version });
        }
      }
      
      // Release locks
      for (const key of transaction.lockedKeys) {
        const handle = this.locks.get(`txn:${key}`);
        if (handle) {
          await this.releaseLock(handle);
        }
      }
      
      transaction.status = DistributedTransactionStatus.COMMITTED;
      transaction.completedAt = Date.now();
      
      return { transactionId, status: DistributedTransactionStatus.COMMITTED, success: true, results };
    } catch (error) {
      transaction.status = DistributedTransactionStatus.FAILED;
      return { 
        transactionId, 
        status: DistributedTransactionStatus.FAILED, 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async rollbackTransaction(transactionId: string): Promise<DistributedTransactionResult> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      return { transactionId, status: DistributedTransactionStatus.FAILED, success: false, error: 'Transaction not found' };
    }
    
    // Release all held locks
    for (const key of transaction.lockedKeys) {
      const handle = this.locks.get(`txn:${key}`);
      if (handle) {
        await this.releaseLock(handle);
      }
    }
    
    transaction.status = DistributedTransactionStatus.ROLLED_BACK;
    transaction.completedAt = Date.now();
    
    return { transactionId, status: DistributedTransactionStatus.ROLLED_BACK, success: true };
  }

  async executeTransaction(
    operations: DistributedTransactionOperation[],
    options?: DistributedTransactionOptions
  ): Promise<DistributedTransactionResult> {
    // Begin
    const transaction = await this.beginTransaction(options);
    
    // Add operations
    for (const op of operations) {
      await this.addTransactionOperation(transaction.transactionId, op);
    }
    
    // Prepare
    const prepareResult = await this.prepareTransaction(transaction.transactionId);
    if (prepareResult.status !== DistributedTransactionStatus.PREPARED) {
      return prepareResult;
    }
    
    // Commit
    return this.commitTransaction(transaction.transactionId);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private cleanup(): void {
    const now = Date.now();
    
    // Cleanup expired locks
    for (const [key, lock] of this.locks) {
      if (lock.expiresAt < now) {
        // Clear renewal timer if exists
        if (lock.renewalTimerId) {
          clearInterval(lock.renewalTimerId);
          this.renewalTimers.delete(lock.lockId);
        }
        this.locks.delete(key);
      }
    }
    
    // Cleanup expired state
    for (const [key, entry] of this.state) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.state.delete(key);
      }
    }
    
    // Cleanup expired leader leases
    for (const [key, leader] of this.leaders) {
      if (leader.expiresAt < now && leader.leaderId) {
        leader.leaderId = '';
        leader.votes.clear();
      }
    }
    
    // Cleanup old transactions
    for (const [id, txn] of this.transactions) {
      if (txn.completedAt && now - txn.completedAt > 60000) {
        this.transactions.delete(id);
      } else if (now - txn.createdAt > txn.timeoutMs * 2) {
        // Force cleanup timed out transactions
        for (const key of txn.lockedKeys) {
          const handle = this.locks.get(`txn:${key}`);
          if (handle) {
            this.locks.delete(`txn:${key}`);
          }
        }
        this.transactions.delete(id);
      }
    }
    
    // Cleanup old processed message IDs (keep last 1000 per subscriber)
    for (const [subscriberId, messageIds] of this.processedMessageIds) {
      if (messageIds.size > 1000) {
        const arr = Array.from(messageIds);
        this.processedMessageIds.set(subscriberId, new Set(arr.slice(-1000)));
      }
    }
  }
}

/**
 * Create an in-memory distributed adapter
 * Primarily for development and testing purposes
 */
export const createInMemoryAdapter = (nodeId?: string): InMemoryDistributedAdapter => {
  return new InMemoryDistributedAdapter(nodeId);
};
