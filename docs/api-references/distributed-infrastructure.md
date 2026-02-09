# Distributed Infrastructure API Reference

## Table of Contents

1. [Overview](#overview)
2. [Stability Features](#stability-features)
3. [Core Components](#core-components)
   - [DistributedCoordinator](#distributedcoordinator)
   - [DistributedAdapter](#distributedadapter)
   - [InMemoryDistributedAdapter](#inmemorydistributedadapter)
4. [Distributed Locking](#distributed-locking)
5. [Distributed State](#distributed-state)
6. [Leader Election](#leader-election)
7. [Pub/Sub Messaging](#pubsub-messaging)
8. [Distributed Transactions](#distributed-transactions)
9. [Distributed Buffer](#distributed-buffer)
10. [Distributed Scheduler](#distributed-scheduler)
11. [Distributed Infrastructure Bundle](#distributed-infrastructure-bundle)
12. [Enums](#enums)
13. [Complex Workflow Example](#complex-workflow-example)
14. [Best Practices](#best-practices)

---

## Overview

The **Distributed Infrastructure** module enables deploying stable-infra components across multiple nodes while maintaining consistency, coordination, and fault tolerance. It provides primitives for distributed locking, state management, leader election, pub/sub messaging, and distributed transactions.

### Key Capabilities

- ✅ **Distributed Locking** with fencing tokens to prevent stale lock holders
- ✅ **Strong Consistency** via compare-and-swap (CAS) operations
- ✅ **Leader Election** with quorum support and partition detection
- ✅ **Two-Phase Commit (2PC)** transactions for atomic multi-key operations
- ✅ **Pub/Sub** with configurable delivery guarantees (at-most-once, at-least-once, exactly-once)
- ✅ **Auto-renewal Locks** that refresh automatically until explicitly released
- ✅ **Distributed Buffers** for cross-node state synchronization
- ✅ **Distributed Schedulers** with leader-based execution

---

## Stability Features

### 1. Fencing Tokens

Prevents **stale lock holders** from corrupting data. Every lock acquisition returns a monotonically increasing fencing token. Storage systems can reject writes from old token holders.

```typescript
const lock = await coordinator.acquireLock({
  resource: 'order:123',
  ttlMs: 30000
});

// The fencing token ensures this write is only accepted if we still hold the lock
await storage.write({
  orderId: 123,
  status: 'COMPLETED',
  fencingToken: lock.fencingToken // Storage validates this token
});
```

### 2. Compare-and-Swap (CAS)

Enables **optimistic concurrency control** without locks. Operations succeed only if the current value matches expectations.

```typescript
const result = await coordinator.compareAndSwap({
  key: 'account:balance',
  expectedVersion: 5,
  newValue: { balance: 150 }
});

if (!result.swapped) {
  console.log('Conflict detected, current value:', result.currentValue);
}
```

### 3. Quorum-Based Leader Election

Ensures **split-brain prevention** through majority voting. A leader is only recognized when it has acknowledgment from a quorum of nodes.

```typescript
await coordinator.campaignForLeader({
  electionKey: 'scheduler-leader',
  quorumSize: 3, // Requires 3 nodes to form quorum
  onPartitionDetected: () => {
    console.log('Network partition detected - demoting to follower');
  }
});
```

### 4. Two-Phase Commit Transactions

Guarantees **atomic multi-key updates** across distributed state. Either all operations succeed, or none take effect.

```typescript
const result = await coordinator.executeTransaction([
  { type: DistributedTransactionOperationType.SET, key: 'account:A', value: { balance: 50 } },
  { type: DistributedTransactionOperationType.SET, key: 'account:B', value: { balance: 150 } },
  { type: DistributedTransactionOperationType.INCREMENT, key: 'transfers:count', delta: 1 }
], {
  isolationLevel: DistributedIsolationLevel.SERIALIZABLE
});
```

### 5. Message Delivery Guarantees

Supports **at-most-once**, **at-least-once**, and **exactly-once** delivery modes for pub/sub messaging.

```typescript
await coordinator.publishWithDelivery('events', payload, {
  deliveryMode: DistributedMessageDelivery.EXACTLY_ONCE,
  waitForAck: true,
  ackTimeoutMs: 5000
});
```

### 6. Auto-Renewal Locks

Locks can be configured to **automatically renew** until explicitly released, preventing accidental expiration during long operations.

```typescript
const lock = await coordinator.acquireLock({
  resource: 'long-running-job',
  ttlMs: 10000,
  renewalMode: DistributedLockRenewalMode.AUTO,
  onRenewalFailure: (handle, error) => {
    console.error('Lock renewal failed:', error);
  }
});
```

---

## Core Components

### DistributedCoordinator

High-level API wrapping a `DistributedAdapter` for distributed operations.

```typescript
import { DistributedCoordinator } from '@emmvish/stable-infra';

const coordinator = new DistributedCoordinator({
  adapter: redisAdapter,
  namespace: 'my-app',
  defaultLockTtlMs: 30000,
  enableLeaderElection: true,
  retryConfig: {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000
  }
});

await coordinator.connect();
```

#### Configuration: DistributedConfig

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `adapter` | `DistributedAdapter` | Required | Backend adapter implementation |
| `namespace` | `string` | `''` | Key prefix for isolation |
| `defaultLockTtlMs` | `number` | `30000` | Default lock TTL |
| `defaultStateTtlMs` | `number` | `0` | Default state TTL (0 = no expiry) |
| `enableLeaderElection` | `boolean` | `false` | Enable leader election |
| `leaderHeartbeatMs` | `number` | `5000` | Leader heartbeat interval |
| `syncOnEveryChange` | `boolean` | `true` | Sync state immediately on change |
| `syncIntervalMs` | `number` | `1000` | Batch sync interval |
| `retryConfig` | `object` | See below | Retry configuration |

### DistributedAdapter

Interface that must be implemented for specific backends (Redis, PostgreSQL, etc.).

```typescript
interface DistributedAdapter {
  readonly nodeId: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  
  // Locking
  acquireLock(options: DistributedLockOptions): Promise<DistributedLockResult>;
  releaseLock(handle: DistributedLockHandle): Promise<boolean>;
  extendLock(handle: DistributedLockHandle, additionalMs: number): Promise<DistributedLockResult>;
  
  // State
  getState<T>(key: string, options?): Promise<DistributedStateResult<T>>;
  setState<T>(key: string, value: T, options?): Promise<DistributedStateResult<T>>;
  updateState<T>(key: string, updater, options?): Promise<DistributedStateResult<T>>;
  deleteState(key: string): Promise<boolean>;
  
  // Counters
  getCounter(key: string): Promise<number>;
  incrementCounter(key: string, delta?: number): Promise<number>;
  decrementCounter(key: string, delta?: number): Promise<number>;
  
  // Leader Election
  campaignForLeader(options: DistributedLeaderOptions): Promise<DistributedLeaderState>;
  resignLeadership(electionKey: string): Promise<void>;
  
  // Pub/Sub
  publish<T>(channel: string, payload: T, options?): Promise<void>;
  subscribe<T>(channel: string, handler, options?): Promise<DistributedSubscription>;
  
  // Transactions
  beginTransaction(options?): Promise<DistributedTransaction>;
  prepareTransaction(transactionId: string): Promise<DistributedTransactionResult>;
  commitTransaction(transactionId: string): Promise<DistributedTransactionResult>;
  rollbackTransaction(transactionId: string): Promise<DistributedTransactionResult>;
}
```

### InMemoryDistributedAdapter

Built-in adapter for testing and single-instance deployments.

```typescript
import { InMemoryDistributedAdapter } from '@emmvish/stable-infra';

const adapter = new InMemoryDistributedAdapter();
// Optionally provide a custom node ID
const adapterWithId = new InMemoryDistributedAdapter('my-node-1');
```

#### Limitations

> ⚠️ **The InMemoryDistributedAdapter is NOT suitable for production multi-node deployments.**

| Limitation | Description |
|------------|-------------|
| **Single-Process Only** | All state is stored in memory within a single Node.js process. Multiple processes or containers cannot share state. |
| **No Persistence** | All locks, state, counters, and subscriptions are lost when the process restarts. No durability guarantees. |
| **No True Distribution** | Locking and leader election only work within the same process. Cross-process coordination is not possible. |
| **No Network Partitioning** | Cannot detect or handle network failures since everything runs in-memory. |
| **Memory Constraints** | State is limited by available process memory. Large datasets may cause OOM errors. |
| **No Replication** | No data redundancy. Single point of failure. |

#### When to Use InMemoryDistributedAdapter

✅ **Good for:**
- Unit and integration testing
- Local development
- Single-instance deployments
- Prototyping distributed workflows

❌ **Not for:**
- Production multi-node deployments
- High availability requirements
- Data persistence requirements
- Cross-process coordination

---

## Building Custom Adapters

For production deployments, implement the `DistributedAdapter` interface with your preferred backend (Redis, PostgreSQL, etcd, etc.).

### Adapter Interface Overview

```typescript
interface DistributedAdapter {
  readonly nodeId: string;
  
  // Connection lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isHealthy(): Promise<boolean>;
  
  // Distributed Locking
  acquireLock(options: DistributedLockOptions): Promise<DistributedLockResult>;
  releaseLock(handle: DistributedLockHandle): Promise<boolean>;
  extendLock(handle: DistributedLockHandle, additionalMs: number): Promise<DistributedLockResult>;
  validateFencingToken(resource: string, token: number): Promise<boolean>;
  getCurrentFencingToken(resource: string): Promise<number>;
  
  // Distributed State
  getState<T>(key: string, options?): Promise<DistributedStateResult<T>>;
  setState<T>(key: string, value: T, options?): Promise<DistributedStateResult<T>>;
  updateState<T>(key: string, updater, options?): Promise<DistributedStateResult<T>>;
  deleteState(key: string): Promise<boolean>;
  compareAndSwap<T>(options: DistributedCompareAndSwapOptions<T>): Promise<DistributedCompareAndSwapResult<T>>;
  
  // Distributed Counters
  getCounter(key: string): Promise<number>;
  incrementCounter(key: string, delta?: number): Promise<number>;
  decrementCounter(key: string, delta?: number): Promise<number>;
  resetCounter(key: string, value?: number): Promise<void>;
  
  // Leader Election
  campaignForLeader(options: DistributedLeaderOptions): Promise<DistributedLeaderState>;
  resignLeadership(electionKey: string): Promise<void>;
  getLeaderStatus(electionKey: string): Promise<DistributedLeaderState>;
  sendLeaderHeartbeat(electionKey: string): Promise<boolean>;
  registerNode(electionKey: string): Promise<void>;
  unregisterNode(electionKey: string): Promise<void>;
  getKnownNodes(electionKey: string): Promise<string[]>;
  
  // Pub/Sub
  publish<T>(channel: string, payload: T, options?): Promise<void>;
  subscribe<T>(channel: string, handler, options?): Promise<DistributedSubscription>;
  acknowledgeMessage(channel: string, messageId: string): Promise<void>;
  getUnacknowledgedMessages<T>(channel: string, subscriberId: string): Promise<DistributedMessage<T>[]>;
  
  // Distributed Transactions (2PC)
  beginTransaction(options?): Promise<DistributedTransaction>;
  addTransactionOperation(transactionId: string, operation: DistributedTransactionOperation): Promise<void>;
  prepareTransaction(transactionId: string): Promise<DistributedTransactionResult>;
  commitTransaction(transactionId: string): Promise<DistributedTransactionResult>;
  rollbackTransaction(transactionId: string): Promise<DistributedTransactionResult>;
  executeTransaction(operations, options?): Promise<DistributedTransactionResult>;
}
```

### Example: Redis Adapter Skeleton

```typescript
import { createClient, RedisClientType } from 'redis';
import type { 
  DistributedAdapter, 
  DistributedLockOptions, 
  DistributedLockResult,
  DistributedLockHandle,
  DistributedStateResult
} from '@emmvish/stable-infra';
import { DistributedLockStatus } from '@emmvish/stable-infra';

export class RedisDistributedAdapter implements DistributedAdapter {
  readonly nodeId: string;
  private client: RedisClientType;
  private pubClient: RedisClientType;
  private subClient: RedisClientType;
  
  constructor(private config: { url: string; nodeId?: string }) {
    this.nodeId = config.nodeId ?? `node-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.client = createClient({ url: config.url });
    this.pubClient = createClient({ url: config.url });
    this.subClient = createClient({ url: config.url });
  }
  
  async connect(): Promise<void> {
    await Promise.all([
      this.client.connect(),
      this.pubClient.connect(),
      this.subClient.connect()
    ]);
  }
  
  async disconnect(): Promise<void> {
    await Promise.all([
      this.client.quit(),
      this.pubClient.quit(),
      this.subClient.quit()
    ]);
  }
  
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }
  
  async acquireLock(options: DistributedLockOptions): Promise<DistributedLockResult> {
    const lockKey = `lock:${options.resource}`;
    const tokenKey = `fencing:${options.resource}`;
    
    // Increment fencing token atomically
    const fencingToken = await this.client.incr(tokenKey);
    
    // Try to acquire lock with NX (only if not exists)
    const acquired = await this.client.set(lockKey, this.nodeId, {
      NX: true,
      PX: options.ttlMs
    });
    
    if (acquired) {
      return {
        status: DistributedLockStatus.ACQUIRED,
        handle: {
          resource: options.resource,
          holder: this.nodeId,
          acquiredAt: Date.now(),
          expiresAt: Date.now() + options.ttlMs
        },
        fencingToken
      };
    }
    
    return {
      status: DistributedLockStatus.UNAVAILABLE,
      holder: await this.client.get(lockKey) || undefined
    };
  }
  
  async releaseLock(handle: DistributedLockHandle): Promise<boolean> {
    const lockKey = `lock:${handle.resource}`;
    
    // Use Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await this.client.eval(script, {
      keys: [lockKey],
      arguments: [this.nodeId]
    });
    
    return result === 1;
  }
  
  async extendLock(handle: DistributedLockHandle, additionalMs: number): Promise<DistributedLockResult> {
    const lockKey = `lock:${handle.resource}`;
    
    // Atomic extend if we still hold the lock
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        redis.call("pexpire", KEYS[1], ARGV[2])
        return 1
      else
        return 0
      end
    `;
    
    const result = await this.client.eval(script, {
      keys: [lockKey],
      arguments: [this.nodeId, additionalMs.toString()]
    });
    
    if (result === 1) {
      return {
        status: DistributedLockStatus.ACQUIRED,
        handle: {
          ...handle,
          expiresAt: Date.now() + additionalMs
        }
      };
    }
    
    return { status: DistributedLockStatus.LOST };
  }
  
  // ... implement remaining methods
  
  async getState<T>(key: string): Promise<DistributedStateResult<T>> {
    const data = await this.client.get(`state:${key}`);
    if (!data) {
      return { exists: false, version: 0 };
    }
    const parsed = JSON.parse(data);
    return {
      exists: true,
      value: parsed.value,
      version: parsed.version
    };
  }
  
  async setState<T>(key: string, value: T): Promise<DistributedStateResult<T>> {
    const stateKey = `state:${key}`;
    const versionKey = `version:${key}`;
    
    const version = await this.client.incr(versionKey);
    await this.client.set(stateKey, JSON.stringify({ value, version }));
    
    return { exists: true, value, version };
  }
  
  // Implement other methods following similar patterns...
}
```

### Implementation Guidelines

#### 1. Locking Requirements

- **Fencing Tokens**: Always increment and return monotonically increasing fencing tokens. This prevents stale lock holders from corrupting data.
- **Atomicity**: Lock acquisition must be atomic (Redis: `SET NX PX`, PostgreSQL: `INSERT ... ON CONFLICT DO NOTHING`).
- **TTL Enforcement**: Locks must automatically expire after TTL to prevent deadlocks from crashed processes.

```typescript
// BAD: Race condition between check and set
if (!(await this.exists(lockKey))) {
  await this.set(lockKey, nodeId);
}

// GOOD: Atomic check-and-set
await this.client.set(lockKey, nodeId, { NX: true, PX: ttlMs });
```

#### 2. State Management

- **Versioning**: Track versions for optimistic concurrency control and compare-and-swap operations.
- **Serialization**: Handle JSON serialization consistently. Consider supporting binary formats for large payloads.
- **TTL Support**: Implement optional expiration for state entries.

#### 3. Counter Atomicity

- Use backend-native atomic increment operations:
  - Redis: `INCR`, `INCRBY`
  - PostgreSQL: `UPDATE ... SET count = count + $1 RETURNING count`
  - etcd: Transactions with revision checks

#### 4. Leader Election

- Implement heartbeat-based lease renewal.
- Support quorum-based election for stronger consistency.
- Handle graceful leader resignation and failover.

#### 5. Pub/Sub Delivery Guarantees

| Mode | Implementation |
|------|----------------|
| `AT_MOST_ONCE` | Fire-and-forget publish |
| `AT_LEAST_ONCE` | Persist messages, require acknowledgment, retry on timeout |
| `EXACTLY_ONCE` | Deduplicate by message ID on subscriber side |

#### 6. Transactions (2PC)

Implement two-phase commit for cross-key atomicity:

1. **Begin**: Create transaction record with `PENDING` status
2. **Add Operations**: Stage operations without applying
3. **Prepare**: Acquire locks on all keys, validate preconditions
4. **Commit**: Apply operations atomically, release locks
5. **Rollback**: Discard staged operations, release locks

### Backend Recommendations

| Backend | Best For | Considerations |
|---------|----------|----------------|
| **Redis** | High-throughput, low-latency | Single-threaded, use Lua for atomicity, consider Redis Cluster for scale |
| **PostgreSQL** | Strong consistency, existing infrastructure | Higher latency, use advisory locks or `FOR UPDATE` |
| **etcd** | Kubernetes-native, leader election | Designed for coordination, limited throughput |
| **ZooKeeper** | Established distributed coordination | Complex operations, JVM dependency |
| **DynamoDB** | AWS-native, serverless | Conditional writes, TTL support, eventual consistency option |

---

## Distributed Locking

### Acquire Lock

```typescript
const result = await coordinator.acquireLock({
  resource: 'order:123',
  ttlMs: 30000,
  waitTimeoutMs: 5000,
  renewalMode: DistributedLockRenewalMode.AUTO
});

if (result.status === DistributedLockStatus.ACQUIRED) {
  console.log('Lock acquired with token:', result.fencingToken);
}
```

### With Lock (Auto-Release)

```typescript
const result = await coordinator.withLock('critical-section', async () => {
  // Protected code
  await processOrder();
  return 'completed';
}, { ttlMs: 10000 });
```

### Lock Options

| Field | Type | Description |
|-------|------|-------------|
| `resource` | `string` | Resource identifier |
| `ttlMs` | `number` | Lock time-to-live |
| `waitTimeoutMs` | `number` | Max wait time for acquisition |
| `retryIntervalMs` | `number` | Retry interval |
| `renewalMode` | `DistributedLockRenewalMode` | `MANUAL` or `AUTO` |
| `renewalIntervalMs` | `number` | Auto-renewal interval |
| `onRenewalFailure` | `function` | Callback on renewal failure |

---

## Distributed State

### Basic Operations

```typescript
// Set state
await coordinator.setState('user:123', { name: 'Alice', balance: 100 });

// Get state
const user = await coordinator.getState<User>('user:123');

// Update atomically
await coordinator.updateState<User>('user:123', (current) => ({
  ...current,
  balance: current.balance + 50
}));

// Delete
await coordinator.deleteState('user:123');
```

### Compare-and-Swap

```typescript
const result = await coordinator.compareAndSwap({
  key: 'config:version',
  expectedVersion: 5,
  newValue: { maxConnections: 100 }
});

if (result.swapped) {
  console.log('Updated to version:', result.version);
} else {
  console.log('Version conflict, current:', result.currentValue);
}
```

---

## Leader Election

### Campaign for Leadership

```typescript
const state = await coordinator.campaignForLeader({
  electionKey: 'worker-leader',
  ttlMs: 10000,
  heartbeatIntervalMs: 3000,
  quorumSize: 3,
  onBecomeLeader: async () => {
    console.log('This node is now the leader');
    await startProcessing();
  },
  onLoseLeadership: async () => {
    console.log('Lost leadership');
    await stopProcessing();
  },
  onPartitionDetected: () => {
    console.log('Network partition detected');
  }
});
```

### Check Leadership

```typescript
const isLeader = coordinator.isCurrentLeader;
const status = await coordinator.getLeaderStatus('worker-leader');
```

### Quorum Operations

```typescript
// Register for quorum-based election
await coordinator.registerForElection('cluster');

// Check quorum status
const hasQuorum = await coordinator.hasQuorum('cluster');

// Get participating nodes
const nodes = await coordinator.getElectionNodes('cluster');
```

---

## Pub/Sub Messaging

### Publish

```typescript
await coordinator.publish('orders', {
  orderId: 123,
  status: 'CREATED'
});
```

### Subscribe

```typescript
const subscription = await coordinator.subscribe<OrderEvent>(
  'orders',
  async (message) => {
    console.log('Received:', message.payload);
    console.log('From node:', message.publisherId);
  }
);

// Later: unsubscribe
await subscription.unsubscribe();
```

### Delivery Guarantees

```typescript
// Exactly-once delivery
await coordinator.publishWithDelivery('critical-events', payload, {
  deliveryMode: DistributedMessageDelivery.EXACTLY_ONCE,
  waitForAck: true,
  ackTimeoutMs: 5000,
  maxRetries: 3
});

// Acknowledge receipt
await coordinator.acknowledgeMessage('critical-events', messageId);
```

---

## Distributed Transactions

### Execute Transaction

```typescript
import { DistributedTransactionOperationType, DistributedIsolationLevel } from '@emmvish/stable-infra';

const result = await coordinator.executeTransaction([
  { 
    type: DistributedTransactionOperationType.SET, 
    key: 'account:alice', 
    value: { balance: 50 } 
  },
  { 
    type: DistributedTransactionOperationType.SET, 
    key: 'account:bob', 
    value: { balance: 150 } 
  },
  { 
    type: DistributedTransactionOperationType.INCREMENT, 
    key: 'stats:transfers', 
    delta: 1 
  },
  {
    type: DistributedTransactionOperationType.COMPARE_AND_SWAP,
    key: 'transfer:123',
    expectedVersion: 0,
    value: { status: 'COMPLETED' }
  }
], {
  isolationLevel: DistributedIsolationLevel.SERIALIZABLE,
  timeoutMs: 10000
});
```

### Manual 2PC

```typescript
// Phase 1: Begin and prepare
const tx = await coordinator.beginTransaction({ timeoutMs: 30000 });
await coordinator.addTransactionOperation(tx.transactionId, {
  type: DistributedTransactionOperationType.SET,
  key: 'order:123',
  value: { status: 'PROCESSING' }
});

const prepareResult = await coordinator.prepareTransaction(tx.transactionId);

if (prepareResult.status === DistributedTransactionStatus.PREPARED) {
  // Phase 2: Commit
  await coordinator.commitTransaction(tx.transactionId);
} else {
  // Rollback on failure
  await coordinator.rollbackTransaction(tx.transactionId);
}
```

---

## Distributed Buffer

Synchronizes `StableBuffer` state across nodes.

### Create Distributed Buffer

```typescript
import { createDistributedStableBuffer, DistributedConflictResolution } from '@emmvish/stable-infra';

const { buffer, coordinator, sync, refresh, disconnect } = await createDistributedStableBuffer({
  distributed: { adapter, namespace: 'my-app' },
  initialState: { counter: 0, items: [] },
  conflictResolution: DistributedConflictResolution.LAST_WRITE_WINS,
  syncOnTransaction: true
});

// Use like a regular StableBuffer
await buffer.run(state => {
  state.counter += 1;
  state.items.push({ id: Date.now() });
});

// Force sync to other nodes
await sync();

// Force refresh from remote state
await refresh();

// Cleanup
await disconnect();
```

### With Distributed Lock

```typescript
import { withDistributedBufferLock } from '@emmvish/stable-infra';

await withDistributedBufferLock(distributedBuffer, async () => {
  await distributedBuffer.buffer.run(state => {
    // Critical section with exclusive access
    state.balance = state.balance - 100;
  });
}, { ttlMs: 10000 });
```

### Conflict Resolution Strategies

| Strategy | Behavior |
|----------|----------|
| `LAST_WRITE_WINS` | Remote values override local for conflicting keys |
| `MERGE` | Deep merge of local and remote objects |
| `CUSTOM` | User-provided merge function |

```typescript
const { buffer } = await createDistributedStableBuffer({
  distributed: { adapter, namespace: 'app' },
  conflictResolution: DistributedConflictResolution.CUSTOM,
  mergeStrategy: (local, remote) => ({
    ...local,
    ...remote,
    mergedAt: Date.now(),
    counter: Math.max(local.counter || 0, remote.counter || 0)
  })
});
```

---

## Distributed Scheduler

Runs schedulers across multiple nodes with leader election.

### Create Distributed Scheduler Config

```typescript
import { createDistributedSchedulerConfig, StableScheduler } from '@emmvish/stable-infra';

const setup = await createDistributedSchedulerConfig({
  distributed: { adapter, namespace: 'workers' },
  scheduler: {
    maxParallel: 5,
    tickIntervalMs: 500
  },
  enableLeaderElection: true,
  circuitBreaker: {
    failureThresholdPercentage: 50,
    minimumRequests: 10,
    recoveryTimeoutMs: 30000
  },
  rateLimiter: {
    maxRequests: 100,
    windowMs: 60000
  },
  onBecomeLeader: () => console.log('Now processing jobs'),
  onLoseLeadership: () => console.log('Stopped processing')
});

// Create scheduler with distributed config
const scheduler = new StableScheduler(setup.config, async (job, context) => {
  await processJob(job);
});

// Wait for leadership before starting
const isLeader = await setup.waitForLeadership(30000);
if (isLeader) {
  scheduler.start();
}

// Cleanup
await setup.disconnect();
```

### Run As Distributed Scheduler

Convenience wrapper for automatic leader-based execution:

```typescript
import { runAsDistributedScheduler, StableScheduler } from '@emmvish/stable-infra';

const runner = await runAsDistributedScheduler({
  distributed: { adapter, namespace: 'tasks' },
  scheduler: { maxParallel: 3 },
  createScheduler: (config) => new StableScheduler(config, async (job) => {
    await handleJob(job);
  })
});

// Start competing for leadership
await runner.start();

// Check leadership status
console.log('Is leader:', runner.isLeader());

// Graceful shutdown
await runner.stop();
```

---

## Distributed Infrastructure Bundle

Create a complete set of distributed infrastructure components sharing one coordinator:

```typescript
import { createDistributedInfrastructureBundle } from '@emmvish/stable-infra';

const infra = await createDistributedInfrastructureBundle({
  distributed: { adapter, namespace: 'my-service' },
  circuitBreaker: {
    failureThresholdPercentage: 50,
    minimumRequests: 10,
    recoveryTimeoutMs: 30000
  },
  rateLimiter: {
    maxRequests: 1000,
    windowMs: 60000
  },
  concurrencyLimiter: {
    limit: 50
  },
  cacheManager: {
    enabled: true,
    ttl: 300000,
    maxSize: 10000
  },
  functionCacheManager: {
    enabled: true,
    ttl: 60000,
    maxSize: 5000
  }
});

// Use with StableScheduler
const scheduler = new StableScheduler({
  maxParallel: 10,
  sharedInfrastructure: {
    circuitBreaker: infra.circuitBreaker,
    rateLimiter: infra.rateLimiter,
    concurrencyLimiter: infra.concurrencyLimiter,
    cacheManager: infra.cacheManager
  }
}, handler);

// Use functionCacheManager for expensive computations
const result = infra.functionCacheManager?.get(expensiveFn, [arg1, arg2]);
if (!result) {
  const computed = await expensiveFn(arg1, arg2);
  infra.functionCacheManager?.set(expensiveFn, [arg1, arg2], computed);
}

// Cleanup
await infra.disconnect();
```

### Standalone Factory Functions

You can also create each component individually:

```typescript
import {
  createDistributedCircuitBreaker,
  createDistributedRateLimiter,
  createDistributedConcurrencyLimiter,
  createDistributedCacheManager,
  createDistributedFunctionCacheManager
} from '@emmvish/stable-infra';

// Create a distributed function cache manager
const functionCache = await createDistributedFunctionCacheManager({
  distributed: { adapter, namespace: 'my-service' },
  enabled: true,
  ttl: 60000,
  maxSize: 1000
});

// Cache expensive function results across nodes
const cachedResult = functionCache.get(expensiveComputation, [input]);
if (!cachedResult) {
  const result = await expensiveComputation(input);
  functionCache.set(expensiveComputation, [input], result);
}
```

---

## Enums

### DistributedLockStatus

```typescript
enum DistributedLockStatus {
  ACQUIRED = 'acquired',
  RELEASED = 'released',
  EXPIRED = 'expired',
  FAILED = 'failed',
  FENCED = 'fenced'
}
```

### DistributedLeaderStatus

```typescript
enum DistributedLeaderStatus {
  LEADER = 'leader',
  FOLLOWER = 'follower',
  CANDIDATE = 'candidate',
  PARTITIONED = 'partitioned'
}
```

### DistributedTransactionStatus

```typescript
enum DistributedTransactionStatus {
  PENDING = 'pending',
  PREPARED = 'prepared',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled-back',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}
```

### DistributedTransactionOperationType

```typescript
enum DistributedTransactionOperationType {
  SET = 'set',
  DELETE = 'delete',
  INCREMENT = 'increment',
  DECREMENT = 'decrement',
  COMPARE_AND_SWAP = 'compare-and-swap'
}
```

### DistributedConflictResolution

```typescript
enum DistributedConflictResolution {
  LAST_WRITE_WINS = 'last-write-wins',
  MERGE = 'merge',
  CUSTOM = 'custom'
}
```

### Key Enums

```typescript
enum DistributedBufferKey {
  STATE = 'buffer:state',
  SYNC_CHANNEL = 'buffer:sync',
  LOCK = 'buffer:lock',
  SHARED_BUFFER = 'scheduler:shared-buffer'
}

enum DistributedSchedulerKey {
  STATE = 'scheduler:state',
  LEADER = 'scheduler:leader',
  CIRCUIT_BREAKER = 'scheduler:circuit-breaker',
  RATE_LIMITER = 'scheduler:rate-limiter',
  CONCURRENCY_LIMITER = 'scheduler:concurrency-limiter',
  CACHE_MANAGER = 'scheduler:cache-manager'
}

enum DistributedInfrastructureKey {
  CIRCUIT_BREAKER = 'circuit-breaker',
  RATE_LIMITER = 'rate-limiter',
  CONCURRENCY_LIMITER = 'concurrency-limiter',
  CACHE_MANAGER = 'cache-manager',
  FUNCTION_CACHE_MANAGER = 'function-cache-manager'
}
```

---

## Complex Workflow Example

This example demonstrates a **distributed order processing system** with multiple nodes, shared state, transactions, and leader-based job execution.

```typescript
import {
  stableWorkflow,
  StableScheduler,
  DistributedCoordinator,
  InMemoryDistributedAdapter,
  createDistributedStableBuffer,
  createDistributedSchedulerConfig,
  withDistributedBufferLock,
  DistributedTransactionOperationType,
  DistributedConflictResolution,
  DistributedLockRenewalMode,
  ScheduleTypes,
  REQUEST_METHODS,
  RequestOrFunction,
  DistributedLockStatus
} from '@emmvish/stable-infra';

import type {
  STABLE_WORKFLOW_PHASE,
  STABLE_WORKFLOW_RESULT,
  SchedulerRunContext,
  SchedulerSchedule,
  HandlePhaseCompletionHookOptions,
  HandlePhaseErrorHookOptions,
  DistributedStableBuffer
} from '@emmvish/stable-infra';

// =============================================================================
// 1. Initialize Distributed Infrastructure
// =============================================================================

const adapter = new InMemoryDistributedAdapter(); // Use RedisAdapter in production

const coordinator = new DistributedCoordinator({
  adapter,
  namespace: 'order-processing',
  enableLeaderElection: true
});

await coordinator.connect();

// =============================================================================
// 2. Create Distributed Shared Buffer for Cross-Node State
// =============================================================================

const distributedBuffer: DistributedStableBuffer = await createDistributedStableBuffer({
  distributed: { adapter, namespace: 'order-processing' },
  initialState: {
    orderCount: 0,
    totalRevenue: 0,
    failedOrders: [] as { orderId: string; error: string }[],
    processingNodes: [] as string[]
  },
  conflictResolution: DistributedConflictResolution.CUSTOM,
  mergeStrategy: (local, remote) => ({
    orderCount: Math.max(local.orderCount, remote.orderCount),
    totalRevenue: Math.max(local.totalRevenue, remote.totalRevenue),
    failedOrders: [...new Set([...local.failedOrders, ...remote.failedOrders])],
    processingNodes: [...new Set([...local.processingNodes, ...remote.processingNodes])]
  }),
  syncOnTransaction: true
});

const { buffer: sharedBuffer, sync } = distributedBuffer;

// =============================================================================
// 3. Create Distributed Scheduler with Leader Election
// =============================================================================

const schedulerSetup = await createDistributedSchedulerConfig({
  distributed: { adapter, namespace: 'order-processing' },
  scheduler: {
    maxParallel: 10,
    tickIntervalMs: 100
  },
  enableLeaderElection: true,
  circuitBreaker: {
    failureThresholdPercentage: 40,
    minimumRequests: 5,
    recoveryTimeoutMs: 30000
  },
  rateLimiter: {
    maxRequests: 100,
    windowMs: 60000
  },
  onBecomeLeader: async () => {
    console.log(`[${coordinator.nodeId}] Became leader - starting order processing`);
    await sharedBuffer.run(state => {
      state.processingNodes.push(coordinator.nodeId);
    });
  },
  onLoseLeadership: async () => {
    console.log(`[${coordinator.nodeId}] Lost leadership - stopping`);
  }
});

// =============================================================================
// 4. Define Order Processing Workflow
// =============================================================================

// stableWorkflow is a function, not a class. It accepts (phases, options) and
// returns Promise<STABLE_WORKFLOW_RESULT>. Phases use API_GATEWAY_REQUEST
// objects with { id, requestOptions: { reqData: { hostname, method, path, body } } }.

const executeOrderWorkflow = async (orderId: string, orderData: any): Promise<STABLE_WORKFLOW_RESULT> => {
  const phases: STABLE_WORKFLOW_PHASE[] = [
    // Phase 1: Validate Order
    {
      id: 'validate',
      requests: [
        {
          id: 'validate-inventory',
          requestOptions: {
            reqData: {
              hostname: 'api.example.com',
              protocol: 'https',
              method: REQUEST_METHODS.POST,
              path: '/inventory/check',
              body: { items: orderData.items }
            }
          }
        }
      ]
    },
    // Phase 2: Process Payment
    {
      id: 'payment',
      requests: [
        {
          id: 'process-payment',
          requestOptions: {
            reqData: {
              hostname: 'api.example.com',
              protocol: 'https',
              method: REQUEST_METHODS.POST,
              path: '/payments/charge',
              body: {
                amount: orderData.total,
                customerId: orderData.customerId
              }
            }
          }
        }
      ]
    },
    // Phase 3: Fulfill Order
    {
      id: 'fulfill',
      requests: [
        {
          id: 'create-shipment',
          requestOptions: {
            reqData: {
              hostname: 'api.example.com',
              protocol: 'https',
              method: REQUEST_METHODS.POST,
              path: '/shipping/create',
              body: {
                orderId,
                address: orderData.shippingAddress
              }
            }
          }
        }
      ]
    }
  ];

  const result = await stableWorkflow(phases, {
    workflowId: `order-${orderId}`,
    sharedBuffer,
    stopOnFirstPhaseError: true,
    logPhaseResults: true,

    // handlePhaseCompletion receives HandlePhaseCompletionHookOptions
    handlePhaseCompletion: async (options: HandlePhaseCompletionHookOptions) => {
      console.log(`Order ${orderId}: Phase ${options.phaseResult.phaseId} completed`);
    },

    // handlePhaseError receives HandlePhaseErrorHookOptions (extends HandlePhaseCompletionHookOptions + error)
    handlePhaseError: async (options: HandlePhaseErrorHookOptions) => {
      console.error(`Order ${orderId}: Phase ${options.phaseResult.phaseId} failed:`, options.error);
    }
  });

  // Post-workflow processing based on result
  if (result.success) {
    // Update shared buffer atomically with distributed lock
    await withDistributedBufferLock(distributedBuffer, async () => {
      await sharedBuffer.run(state => {
        state.orderCount += 1;
        state.totalRevenue += orderData.total;
      });
    });

    // Publish completion event
    await coordinator.publish('order-events', {
      type: 'ORDER_COMPLETED',
      orderId,
      total: orderData.total,
      timestamp: Date.now()
    });
  } else {
    // Use distributed transaction for consistent error handling
    await coordinator.executeTransaction([
      {
        type: DistributedTransactionOperationType.SET,
        key: `order:${orderId}:status`,
        value: { status: 'FAILED', error: result.error || 'Unknown error' }
      },
      {
        type: DistributedTransactionOperationType.INCREMENT,
        key: 'metrics:failed-orders',
        delta: 1
      }
    ]);

    await sharedBuffer.run(state => {
      state.failedOrders.push({ orderId, error: result.error || 'Unknown error' });
    });
  }

  return result;
};

// =============================================================================
// 5. Create Job Handler
// =============================================================================

// TJob must extend { id?: string; schedule?: SchedulerSchedule }
interface OrderJob {
  id: string;
  orderId: string;
  orderData: any;
  schedule?: SchedulerSchedule;
}

const orderHandler = async (job: OrderJob, context: SchedulerRunContext) => {
  const { orderId, orderData } = job;

  // Acquire a lock on the specific order to prevent duplicate processing
  const lockResult = await coordinator.acquireLock({
    resource: `order:${orderId}:processing`,
    ttlMs: 60000,
    renewalMode: DistributedLockRenewalMode.AUTO
  });

  if (lockResult.status !== DistributedLockStatus.ACQUIRED) {
    console.log(`Order ${orderId} is being processed by another node`);
    return { skipped: true };
  }

  try {
    // Execute workflow with fencing token validation
    const result = await coordinator.withFencedAccess(
      `order:${orderId}:processing`,
      lockResult.fencingToken!,
      async () => {
        const workflowResult = await executeOrderWorkflow(orderId, orderData);

        // Store result with CAS for safety
        await coordinator.compareAndSwap({
          key: `order:${orderId}:result`,
          expectedVersion: 0,
          newValue: {
            success: workflowResult.success,
            completedAt: Date.now(),
            processedBy: coordinator.nodeId
          }
        });

        return workflowResult;
      }
    );

    return result;
  } finally {
    await coordinator.releaseLock(lockResult.handle!);
  }
};

// =============================================================================
// 6. Create Scheduler and Start Processing
// =============================================================================

const scheduler = new StableScheduler<OrderJob>(
  {
    ...schedulerSetup.config,
    sharedBuffer // Use distributed buffer for scheduler state
  },
  orderHandler
);

// Subscribe to order events from other services
await coordinator.subscribe<{ orderId: string; orderData: any }>('incoming-orders', async (message) => {
  const { orderId, orderData } = message.payload;

  // addJob is the scheduler method for adding jobs (not schedule)
  scheduler.addJob({
    id: `process-order-${orderId}`,
    orderId,
    orderData,
    schedule: { type: ScheduleTypes.TIMESTAMP, at: Date.now() }
  });
});

// Wait for leadership and start
const isLeader = await schedulerSetup.waitForLeadership(30000);
if (isLeader) {
  scheduler.start();
  console.log('Order processing scheduler started');
}

// =============================================================================
// 7. Monitoring and Metrics
// =============================================================================

// Periodic metrics reporting
setInterval(async () => {
  const metrics = coordinator.getMetrics();
  const state = sharedBuffer.read();

  console.log('Distributed System Metrics:', {
    nodeId: metrics.nodeId,
    isLeader: metrics.isLeader,
    lockAcquisitions: metrics.lockAcquisitions,
    stateOperations: metrics.stateOperations,
    orderCount: state.orderCount,
    totalRevenue: state.totalRevenue,
    failedOrders: state.failedOrders.length
  });
}, 60000);

// =============================================================================
// 8. Graceful Shutdown
// =============================================================================

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');

  scheduler.stop();
  await schedulerSetup.disconnect();
  await coordinator.disconnect();

  console.log('Shutdown complete');
  process.exit(0);
});
```

### Key Stability Features Demonstrated

1. **Distributed Locking with Auto-Renewal**: Prevents duplicate order processing across nodes
2. **Fencing Tokens**: Ensures only valid lock holders can write order state
3. **Leader Election**: Only one node processes scheduled orders at a time
4. **Distributed Transactions**: Atomic updates to order status and metrics
5. **Compare-and-Swap**: Safe concurrent writes to order results
6. **Pub/Sub**: Real-time event propagation between services
7. **Custom Conflict Resolution**: Smart merging of statistics from multiple nodes
8. **Circuit Breaker**: Protects against cascading failures in downstream services

---

## Best Practices

### 1. Always Use Namespaces

```typescript
const coordinator = new DistributedCoordinator({
  adapter,
  namespace: 'service-name:environment' // e.g., 'orders:production'
});
```

### 2. Handle Lock Failures Gracefully

```typescript
const lock = await coordinator.acquireLock({ resource: 'key', waitTimeoutMs: 5000 });
if (lock.status !== DistributedLockStatus.ACQUIRED) {
  // Don't throw - handle gracefully
  return { status: 'SKIPPED', reason: 'Could not acquire lock' };
}
```

### 3. Use Fencing Tokens for Critical Writes

```typescript
const lock = await coordinator.acquireLock({ resource: 'account:123' });
await database.update({
  accountId: 123,
  balance: newBalance,
  fencingToken: lock.fencingToken // Database validates this
});
```

### 4. Prefer Transactions for Multi-Key Updates

```typescript
// Instead of multiple setState calls:
await coordinator.executeTransaction([
  { type: 'set', key: 'key1', value: val1 },
  { type: 'set', key: 'key2', value: val2 }
]);
```

### 5. Configure Appropriate Timeouts

```typescript
const coordinator = new DistributedCoordinator({
  adapter,
  defaultLockTtlMs: 30000, // 30 seconds
  retryConfig: {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000
  }
});
```

### 6. Monitor Metrics

```typescript
const metrics = coordinator.getMetrics();
// Track: lockConflicts, stateOperations, averageSyncLatencyMs
```

### 7. Implement Proper Cleanup

```typescript
process.on('SIGTERM', async () => {
  await scheduler.stop();
  await coordinator.disconnect(); // Releases locks, resigns leadership
});
```
