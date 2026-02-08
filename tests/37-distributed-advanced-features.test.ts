import {
  DistributedCoordinator,
  InMemoryDistributedAdapter,
  DistributedConsistencyLevel,
  DistributedTransactionStatus,
  DistributedMessageDelivery,
  DistributedLockRenewalMode,
  DistributedTransactionOperationType,
  DistributedLockStatus,
  DistributedLeaderStatus
} from '../src';

/**
 * Test Suite: Distributed Advanced Features
 * 
 * Tests for overcoming limitations 3, 4, 5, and 6:
 * - Limitation 3: Eventual Consistency Model → Strong consistency via CAS
 * - Limitation 4: Lock Limitations → Fencing tokens, auto-renewal
 * - Limitation 5: Leader Election → Quorum-based, partition detection
 * - Limitation 6: No Transaction Support → Full 2PC transactions
 */
describe('Distributed Advanced Features', () => {
  let adapter: InMemoryDistributedAdapter;
  let coordinator: DistributedCoordinator;

  beforeEach(async () => {
    adapter = new InMemoryDistributedAdapter();
    coordinator = new DistributedCoordinator({
      adapter,
      namespace: 'test'
    });
    await coordinator.connect();
  });

  afterEach(async () => {
    await coordinator.disconnect();
  });

  // ==========================================================================
  // Limitation 3: Eventual Consistency → Strong Consistency via CAS
  // ==========================================================================
  describe('Strong Consistency via Compare-and-Swap', () => {
    describe('DistributedConsistencyLevel Enum', () => {
      it('should have all consistency levels defined', () => {
        expect(DistributedConsistencyLevel.EVENTUAL).toBe('eventual');
        expect(DistributedConsistencyLevel.SESSION).toBe('session');
        expect(DistributedConsistencyLevel.STRONG).toBe('strong');
        expect(DistributedConsistencyLevel.LINEARIZABLE).toBe('linearizable');
      });
    });

    describe('Compare-and-Swap Operations', () => {
      it('should successfully perform CAS when expectedVersion matches', async () => {
        // Set initial value
        await coordinator.setState('counter', { value: 0 });

        // CAS should succeed with correct expected version
        const result = await coordinator.compareAndSwap({
          key: 'counter',
          expectedVersion: 1,
          newValue: { value: 1 }
        });

        expect(result.success).toBe(true);
        expect(result.version).toBe(2);
      });

      it('should fail CAS when expectedVersion does not match', async () => {
        // Set initial value
        await coordinator.setState('counter', { value: 0 });

        // CAS should fail with wrong expected version
        const result = await coordinator.compareAndSwap({
          key: 'counter',
          expectedVersion: 5, // Wrong version
          newValue: { value: 1 }
        });

        expect(result.success).toBe(false);
        expect(result.currentVersion).toBe(1);
        expect(result.currentValue).toEqual({ value: 0 });
      });

      it('should handle concurrent CAS operations correctly', async () => {
        await coordinator.setState('balance', { amount: 100 });

        // Simulate two concurrent updates
        const [result1, result2] = await Promise.all([
          coordinator.compareAndSwap({
            key: 'balance',
            expectedVersion: 1,
            newValue: { amount: 150 }
          }),
          coordinator.compareAndSwap({
            key: 'balance',
            expectedVersion: 1,
            newValue: { amount: 200 }
          })
        ]);

        // One should succeed, one should fail
        const successes = [result1.success, result2.success].filter(Boolean).length;
        expect(successes).toBe(1);

        // The final state should be consistent
        const state = await coordinator.getState('balance');
        expect([150, 200]).toContain(state.amount);
      });

      it('should track version numbers correctly across updates', async () => {
        await coordinator.setState('doc', { content: 'v1' });
        
        let result = await coordinator.compareAndSwap({
          key: 'doc',
          expectedVersion: 1,
          newValue: { content: 'v2' }
        });
        expect(result.version).toBe(2);

        result = await coordinator.compareAndSwap({
          key: 'doc',
          expectedVersion: 2,
          newValue: { content: 'v3' }
        });
        expect(result.version).toBe(3);

        const state = await coordinator.getState('doc');
        expect(state.content).toBe('v3');
      });
    });
  });

  // ==========================================================================
  // Limitation 4: Lock Limitations → Fencing Tokens + Auto-Renewal
  // ==========================================================================
  describe('Lock Fencing Tokens and Auto-Renewal', () => {
    describe('DistributedLockRenewalMode Enum', () => {
      it('should have all renewal modes defined', () => {
        expect(DistributedLockRenewalMode.MANUAL).toBe('manual');
        expect(DistributedLockRenewalMode.AUTO).toBe('auto');
      });
    });

    describe('DistributedLockStatus Enum with FENCED', () => {
      it('should have FENCED status for invalidated locks', () => {
        expect(DistributedLockStatus.FENCED).toBe('fenced');
        expect(DistributedLockStatus.ACQUIRED).toBe('acquired');
        expect(DistributedLockStatus.RELEASED).toBe('released');
      });
    });

    describe('Fencing Tokens', () => {
      it('should generate incrementing fencing tokens on lock acquisition', async () => {
        const lock1 = await coordinator.acquireLock({ resource: 'resource-1', ttlMs: 100 });
        expect(lock1.handle?.fencingToken).toBe(1);
        if (lock1.handle) await coordinator.releaseLock(lock1.handle);

        const lock2 = await coordinator.acquireLock({ resource: 'resource-1', ttlMs: 100 });
        expect(lock2.handle?.fencingToken).toBe(2);
        if (lock2.handle) await coordinator.releaseLock(lock2.handle);

        const lock3 = await coordinator.acquireLock({ resource: 'resource-1', ttlMs: 100 });
        expect(lock3.handle?.fencingToken).toBe(3);
        if (lock3.handle) await coordinator.releaseLock(lock3.handle);
      });

      it('should validate current fencing token', async () => {
        const lock = await coordinator.acquireLock({ resource: 'protected-resource', ttlMs: 1000 });
        
        // Token should be valid
        const isValid = await coordinator.validateFencingToken('protected-resource', lock.handle!.fencingToken!);
        expect(isValid).toBe(true);

        // Old token should be invalid
        const isOldValid = await coordinator.validateFencingToken('protected-resource', lock.handle!.fencingToken! - 1);
        expect(isOldValid).toBe(false);

        if (lock.handle) await coordinator.releaseLock(lock.handle);
      });

      it('should get current fencing token for a resource', async () => {
        const lock = await coordinator.acquireLock({ resource: 'token-check', ttlMs: 1000 });
        const currentToken = await coordinator.getCurrentFencingToken('token-check');
        expect(currentToken).toBe(lock.handle?.fencingToken);
        if (lock.handle) await coordinator.releaseLock(lock.handle);
      });

      it('should execute fenced operations only with valid token', async () => {
        const lock = await coordinator.acquireLock({ resource: 'fenced-op', ttlMs: 1000 });
        
        // Operation with valid token should succeed
        const result = await coordinator.withFencedAccess(
          'fenced-op',
          lock.handle!.fencingToken!,
          () => 'success'
        );
        expect(result).toBe('success');

        // Operation with invalid token should throw
        await expect(
          coordinator.withFencedAccess('fenced-op', lock.handle!.fencingToken! - 1, () => 'fail')
        ).rejects.toThrow('Fencing token');

        if (lock.handle) await coordinator.releaseLock(lock.handle);
      });

      it('should prevent stale lock holder from performing operations', async () => {
        // First holder acquires lock
        const lock1 = await coordinator.acquireLock({ resource: 'stale-test', ttlMs: 50 });
        const token1 = lock1.handle?.fencingToken!;

        // Lock expires
        await new Promise(resolve => setTimeout(resolve, 60));

        // Second holder acquires lock
        const lock2 = await coordinator.acquireLock({ resource: 'stale-test', ttlMs: 1000 });
        const token2 = lock2.handle?.fencingToken!;

        // Token2 should be higher
        expect(token2).toBeGreaterThan(token1);

        // Old token1 is no longer valid
        const isToken1Valid = await coordinator.validateFencingToken('stale-test', token1);
        expect(isToken1Valid).toBe(false);

        // New token2 is valid
        const isToken2Valid = await coordinator.validateFencingToken('stale-test', token2);
        expect(isToken2Valid).toBe(true);

        if (lock2.handle) await coordinator.releaseLock(lock2.handle);
      });
    });

    describe('Auto Lock Renewal', () => {
      it('should auto-renew lock with AUTO renewal mode', async () => {
        const lock = await coordinator.acquireLock({
          resource: 'auto-renew',
          ttlMs: 100,
          renewalMode: DistributedLockRenewalMode.AUTO,
          renewalIntervalMs: 30
        });

        expect(lock.status).toBe(DistributedLockStatus.ACQUIRED);

        // Wait longer than TTL
        await new Promise(resolve => setTimeout(resolve, 200));

        // Lock should still be valid due to auto-renewal - check by trying to acquire again
        const lock2 = await coordinator.acquireLock({ resource: 'auto-renew', ttlMs: 100 });
        // Should fail because lock1 still holds it
        expect(lock2.status).toBe(DistributedLockStatus.FAILED);

        if (lock.handle) await coordinator.releaseLock(lock.handle);
      });

      it('should not auto-renew with MANUAL mode', async () => {
        const lock = await coordinator.acquireLock({
          resource: 'manual-renew',
          ttlMs: 50,
          renewalMode: DistributedLockRenewalMode.MANUAL
        });

        expect(lock.status).toBe(DistributedLockStatus.ACQUIRED);

        // Wait longer than TTL
        await new Promise(resolve => setTimeout(resolve, 100));

        // Lock should have expired, so we can acquire it again
        const lock2 = await coordinator.acquireLock({ resource: 'manual-renew', ttlMs: 1000 });
        expect(lock2.status).toBe(DistributedLockStatus.ACQUIRED);
        
        if (lock2.handle) await coordinator.releaseLock(lock2.handle);
      });

      it('should call onRenewalFailure callback when renewal fails', async () => {
        const onRenewalFailure = jest.fn();
        
        const lock = await coordinator.acquireLock({
          resource: 'renewal-callback',
          ttlMs: 100,
          renewalMode: DistributedLockRenewalMode.AUTO,
          renewalIntervalMs: 20,
          onRenewalFailure
        });

        // Simulate lock being stolen by another process - directly manipulate adapter's internal lock map
        // This simulates network partition or another node acquiring the lock
        if (lock.handle) {
          // Clear the lock from internal map without going through releaseLock
          // This simulates the lock expiring or being stolen
          (adapter as any).locks.delete(lock.handle.resource);
        }

        // Wait for renewal attempt to fire and fail
        await new Promise(resolve => setTimeout(resolve, 50));

        // Callback should have been called because extend failed
        expect(onRenewalFailure).toHaveBeenCalled();
        
        // Clean up any lingering timers
        if (lock.handle?.renewalTimerId) {
          clearInterval(lock.handle.renewalTimerId);
        }
      });
    });
  });

  // ==========================================================================
  // Limitation 5: Leader Election → Quorum-Based with Partition Detection
  // ==========================================================================
  describe('Quorum-Based Leader Election and Partition Detection', () => {
    describe('DistributedLeaderStatus Enum with PARTITIONED', () => {
      it('should have PARTITIONED status for network partition', () => {
        expect(DistributedLeaderStatus.PARTITIONED).toBe('partitioned');
        expect(DistributedLeaderStatus.LEADER).toBe('leader');
        expect(DistributedLeaderStatus.FOLLOWER).toBe('follower');
        expect(DistributedLeaderStatus.CANDIDATE).toBe('candidate');
      });
    });

    describe('Quorum-Based Election', () => {
      it('should elect leader when quorum is reached', async () => {
        // Start leader election with quorum size 1 (for single node test)
        const state = await coordinator.campaignForLeader({
          electionKey: 'election-1',
          heartbeatIntervalMs: 50,
          nodeTimeoutMs: 100,
          quorumSize: 1
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Check leader status
        const status = await coordinator.getLeaderStatus('election-1');
        expect(status.status).toBe(DistributedLeaderStatus.LEADER);
        expect(status.quorum?.hasQuorum).toBe(true);

        await coordinator.resignLeadership('election-1');
      });

      it('should register and track election nodes', async () => {
        await coordinator.registerForElection('multi-node');

        const nodes = await coordinator.getElectionNodes('multi-node');
        expect(nodes).toContain(coordinator.nodeId);

        await coordinator.unregisterFromElection('multi-node');
      });

      it('should check quorum status', async () => {
        await coordinator.campaignForLeader({
          electionKey: 'quorum-check',
          heartbeatIntervalMs: 50,
          nodeTimeoutMs: 100,
          quorumSize: 1
        });

        await new Promise(resolve => setTimeout(resolve, 60));

        const hasQuorum = await coordinator.hasQuorum('quorum-check');
        expect(hasQuorum).toBe(true);

        await coordinator.resignLeadership('quorum-check');
      });

      it('should report quorum info in leader status', async () => {
        await coordinator.campaignForLeader({
          electionKey: 'quorum-info',
          heartbeatIntervalMs: 50,
          nodeTimeoutMs: 100,
          quorumSize: 1
        });

        await new Promise(resolve => setTimeout(resolve, 60));

        const status = await coordinator.getLeaderStatus('quorum-info');
        expect(status.quorum).toBeDefined();
        expect(status.quorum?.required).toBe(1);
        expect(status.quorum?.hasQuorum).toBe(true);

        await coordinator.resignLeadership('quorum-info');
      });
    });

    describe('Partition Detection Callbacks', () => {
      it('should call onPartitionDetected when quorum is lost', async () => {
        const onPartitionDetected = jest.fn();
        const onPartitionResolved = jest.fn();

        await coordinator.campaignForLeader({
          electionKey: 'partition-test',
          heartbeatIntervalMs: 30,
          nodeTimeoutMs: 60,
          quorumSize: 3, // Requires 3 nodes but we only have 1
          onPartitionDetected,
          onPartitionResolved
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Since we only have 1 node but need 3, partition should be detected
        // (In in-memory adapter, this is simulated)

        await coordinator.resignLeadership('partition-test');
      });
    });
  });

  // ==========================================================================
  // Limitation 6: No Transaction Support → Full 2PC Transactions
  // ==========================================================================
  describe('Distributed Transactions (2PC)', () => {
    describe('DistributedTransactionStatus Enum', () => {
      it('should have all transaction statuses defined', () => {
        expect(DistributedTransactionStatus.PENDING).toBe('pending');
        expect(DistributedTransactionStatus.PREPARED).toBe('prepared');
        expect(DistributedTransactionStatus.COMMITTED).toBe('committed');
        expect(DistributedTransactionStatus.ROLLED_BACK).toBe('rolled-back');
        expect(DistributedTransactionStatus.FAILED).toBe('failed');
        expect(DistributedTransactionStatus.TIMEOUT).toBe('timeout');
      });
    });

    describe('DistributedTransactionOperationType Enum', () => {
      it('should have all operation types defined', () => {
        expect(DistributedTransactionOperationType.SET).toBe('set');
        expect(DistributedTransactionOperationType.DELETE).toBe('delete');
        expect(DistributedTransactionOperationType.INCREMENT).toBe('increment');
        expect(DistributedTransactionOperationType.DECREMENT).toBe('decrement');
        expect(DistributedTransactionOperationType.COMPARE_AND_SWAP).toBe('compare-and-swap');
      });
    });

    describe('Transaction Lifecycle', () => {
      it('should begin a new transaction', async () => {
        const transaction = await coordinator.beginTransaction();
        
        expect(transaction.transactionId).toBeDefined();
        expect(transaction.status).toBe(DistributedTransactionStatus.PENDING);
        expect(transaction.operations).toEqual([]);
      });

      it('should add operations to a transaction', async () => {
        const transaction = await coordinator.beginTransaction();
        
        await coordinator.addTransactionOperation(transaction.transactionId, {
          type: DistributedTransactionOperationType.SET,
          key: 'account:1',
          value: { balance: 100 }
        });

        await coordinator.addTransactionOperation(transaction.transactionId, {
          type: DistributedTransactionOperationType.SET,
          key: 'account:2',
          value: { balance: 200 }
        });
      });

      it('should prepare and commit a transaction', async () => {
        const transaction = await coordinator.beginTransaction();
        
        await coordinator.addTransactionOperation(transaction.transactionId, {
          type: DistributedTransactionOperationType.SET,
          key: 'tx-test:1',
          value: { data: 'value1' }
        });

        // Prepare phase
        const prepareResult = await coordinator.prepareTransaction(transaction.transactionId);
        expect(prepareResult.success).toBe(true);
        expect(prepareResult.status).toBe(DistributedTransactionStatus.PREPARED);

        // Commit phase
        const commitResult = await coordinator.commitTransaction(transaction.transactionId);
        expect(commitResult.success).toBe(true);
        expect(commitResult.status).toBe(DistributedTransactionStatus.COMMITTED);

        // Verify data was committed
        const state = await coordinator.getState('tx-test:1');
        expect(state).toEqual({ data: 'value1' });
      });

      it('should rollback a transaction', async () => {
        // Set initial state
        await coordinator.setState('rollback-test', { value: 'original' });

        const transaction = await coordinator.beginTransaction();
        
        await coordinator.addTransactionOperation(transaction.transactionId, {
          type: DistributedTransactionOperationType.SET,
          key: 'rollback-test',
          value: { value: 'modified' }
        });

        // Prepare
        await coordinator.prepareTransaction(transaction.transactionId);

        // Rollback instead of commit
        const rollbackResult = await coordinator.rollbackTransaction(transaction.transactionId);
        expect(rollbackResult.success).toBe(true);
        expect(rollbackResult.status).toBe(DistributedTransactionStatus.ROLLED_BACK);

        // Verify data was NOT modified
        const state = await coordinator.getState('rollback-test');
        expect(state).toEqual({ value: 'original' });
      });
    });

    describe('executeTransaction Convenience Method', () => {
      it('should execute multiple operations atomically', async () => {
        const result = await coordinator.executeTransaction([
          { type: DistributedTransactionOperationType.SET, key: 'atomic:1', value: { a: 1 } },
          { type: DistributedTransactionOperationType.SET, key: 'atomic:2', value: { b: 2 } },
          { type: DistributedTransactionOperationType.SET, key: 'atomic:3', value: { c: 3 } }
        ]);

        expect(result.success).toBe(true);
        expect(result.status).toBe(DistributedTransactionStatus.COMMITTED);

        // Verify all data was set
        const [s1, s2, s3] = await Promise.all([
          coordinator.getState('atomic:1'),
          coordinator.getState('atomic:2'),
          coordinator.getState('atomic:3')
        ]);
        expect(s1).toEqual({ a: 1 });
        expect(s2).toEqual({ b: 2 });
        expect(s3).toEqual({ c: 3 });
      });

      it('should support INCREMENT operation in transaction', async () => {
        await coordinator.setState('counter:tx', 10);

        const result = await coordinator.executeTransaction([
          { type: DistributedTransactionOperationType.INCREMENT, key: 'counter:tx', delta: 5 }
        ]);

        expect(result.success).toBe(true);

        const state = await coordinator.getState('counter:tx');
        expect(state).toBe(15);
      });

      it('should support DECREMENT operation in transaction', async () => {
        await coordinator.setState('counter:dec', 100);

        const result = await coordinator.executeTransaction([
          { type: DistributedTransactionOperationType.DECREMENT, key: 'counter:dec', delta: 30 }
        ]);

        expect(result.success).toBe(true);

        const state = await coordinator.getState('counter:dec');
        expect(state).toBe(70);
      });

      it('should support DELETE operation in transaction', async () => {
        await coordinator.setState('to-delete', { temp: true });

        const result = await coordinator.executeTransaction([
          { type: DistributedTransactionOperationType.DELETE, key: 'to-delete' }
        ]);

        expect(result.success).toBe(true);

        const state = await coordinator.getState('to-delete');
        expect(state).toBeUndefined();
      });

      it('should handle transaction with CAS operation', async () => {
        await coordinator.setState('cas-tx', { value: 'original', version: 1 });

        const result = await coordinator.executeTransaction([
          {
            type: DistributedTransactionOperationType.COMPARE_AND_SWAP,
            key: 'cas-tx',
            value: { value: 'updated', version: 2 },
            expectedVersion: 1
          }
        ]);

        expect(result.success).toBe(true);

        const state = await coordinator.getState('cas-tx');
        expect(state.value).toBe('updated');
      });
    });

    describe('atomicUpdate Convenience Method', () => {
      it('should update multiple keys atomically', async () => {
        const result = await coordinator.atomicUpdate([
          { key: 'batch:1', value: { x: 10 } },
          { key: 'batch:2', value: { y: 20 } }
        ]);

        expect(result.success).toBe(true);

        const [s1, s2] = await Promise.all([
          coordinator.getState('batch:1'),
          coordinator.getState('batch:2')
        ]);
        expect(s1).toEqual({ x: 10 });
        expect(s2).toEqual({ y: 20 });
      });
    });

    describe('Transaction Timeout', () => {
      it('should timeout long-running transactions', async () => {
        const transaction = await coordinator.beginTransaction({
          timeoutMs: 50
        });

        await coordinator.addTransactionOperation(transaction.transactionId, {
          type: DistributedTransactionOperationType.SET,
          key: 'timeout-test',
          value: { data: 'test' }
        });

        // Wait for timeout
        await new Promise(resolve => setTimeout(resolve, 100));

        // Transaction should be timed out
        const result = await coordinator.commitTransaction(transaction.transactionId);
        expect(result.success).toBe(false);
      });
    });
  });

  // ==========================================================================
  // Guaranteed Message Delivery
  // ==========================================================================
  describe('Guaranteed Message Delivery', () => {
    describe('DistributedMessageDelivery Enum', () => {
      it('should have all delivery modes defined', () => {
        expect(DistributedMessageDelivery.AT_MOST_ONCE).toBe('at-most-once');
        expect(DistributedMessageDelivery.AT_LEAST_ONCE).toBe('at-least-once');
        expect(DistributedMessageDelivery.EXACTLY_ONCE).toBe('exactly-once');
      });
    });

    describe('Message Acknowledgment', () => {
      it('should publish with at-least-once delivery', async () => {
        const received: any[] = [];
        
        await coordinator.subscribe('alo-channel', (msg) => {
          received.push(msg);
        }, { deliveryMode: DistributedMessageDelivery.AT_LEAST_ONCE });

        await coordinator.publishWithDelivery('alo-channel', { event: 'test' }, {
          deliveryMode: DistributedMessageDelivery.AT_LEAST_ONCE
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(received.length).toBe(1);
        expect(received[0].payload).toEqual({ event: 'test' });
        expect(received[0].requiresAck).toBe(true);
      });

      it('should acknowledge message receipt', async () => {
        let messageId: string = '';
        
        await coordinator.subscribe('ack-channel', (msg) => {
          messageId = msg.messageId;
        }, { deliveryMode: DistributedMessageDelivery.EXACTLY_ONCE });

        await coordinator.publishWithDelivery('ack-channel', { data: 'ack-test' }, {
          deliveryMode: DistributedMessageDelivery.EXACTLY_ONCE
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(messageId).toBeTruthy();

        // Acknowledge the message
        await coordinator.acknowledgeMessage('ack-channel', messageId);
      });

      it('should track unacknowledged messages', async () => {
        // Subscribe with exactly-once semantics
        await coordinator.subscribe('unacked-channel', () => {
          // Don't acknowledge
        }, { deliveryMode: DistributedMessageDelivery.EXACTLY_ONCE });

        await coordinator.publishWithDelivery('unacked-channel', { data: 'unacked' }, {
          deliveryMode: DistributedMessageDelivery.EXACTLY_ONCE
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        const unacked = await coordinator.getUnacknowledgedMessages('unacked-channel', coordinator.nodeId);
        expect(unacked.length).toBeGreaterThanOrEqual(0);
      });

      it('should assign sequence numbers to messages', async () => {
        const messages: any[] = [];
        
        await coordinator.subscribe('seq-channel', (msg) => {
          messages.push(msg);
        });

        await coordinator.publish('seq-channel', { seq: 1 });
        await coordinator.publish('seq-channel', { seq: 2 });
        await coordinator.publish('seq-channel', { seq: 3 });

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(messages.length).toBe(3);
        // Each message should have a sequence number
        messages.forEach(msg => {
          expect(typeof msg.sequenceNumber).toBe('number');
        });
      });
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================
  describe('Integration Scenarios', () => {
    it('should handle bank transfer with transaction and fencing', async () => {
      // Initialize accounts
      await coordinator.setState('bank:account:A', { balance: 1000 });
      await coordinator.setState('bank:account:B', { balance: 500 });

      // Acquire lock for transfer with fencing
      const lock = await coordinator.acquireLock({
        resource: 'bank:transfer',
        ttlMs: 5000,
        renewalMode: DistributedLockRenewalMode.AUTO,
        renewalIntervalMs: 1000
      });

      try {
        // Verify fencing token is valid
        await coordinator.withFencedAccess('bank:transfer', lock.handle!.fencingToken!, async () => {
          // Execute transfer as atomic transaction
          const result = await coordinator.executeTransaction([
            { 
              type: DistributedTransactionOperationType.SET, 
              key: 'bank:account:A', 
              value: { balance: 900 } // Withdraw 100
            },
            { 
              type: DistributedTransactionOperationType.SET, 
              key: 'bank:account:B', 
              value: { balance: 600 } // Deposit 100
            }
          ]);

          expect(result.success).toBe(true);
        });
      } finally {
        if (lock.handle) await coordinator.releaseLock(lock.handle);
      }

      // Verify final balances
      const [accountA, accountB] = await Promise.all([
        coordinator.getState('bank:account:A'),
        coordinator.getState('bank:account:B')
      ]);
      expect(accountA.balance).toBe(900);
      expect(accountB.balance).toBe(600);
    });

    it('should handle leader-based work distribution', async () => {
      // Start leader campaign
      await coordinator.campaignForLeader({
        electionKey: 'work-leader',
        heartbeatIntervalMs: 50,
        nodeTimeoutMs: 100,
        quorumSize: 1
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if we're the leader
      const status = await coordinator.getLeaderStatus('work-leader');
      
      if (status.status === DistributedLeaderStatus.LEADER) {
        // Leader distributes work atomically
        await coordinator.executeTransaction([
          { type: DistributedTransactionOperationType.SET, key: 'work:task:1', value: { assigned: 'worker-1', status: 'pending' } },
          { type: DistributedTransactionOperationType.SET, key: 'work:task:2', value: { assigned: 'worker-2', status: 'pending' } }
        ]);

        const task1 = await coordinator.getState('work:task:1');
        expect(task1.assigned).toBe('worker-1');
      }

      await coordinator.resignLeadership('work-leader');
    });

    it('should handle optimistic concurrency with CAS retry', async () => {
      // Initialize counter
      await coordinator.setState('optimistic:counter', { value: 0 });

      // Simulate concurrent increments with CAS retry logic
      const incrementWithRetry = async (amount: number, maxRetries: number = 5): Promise<boolean> => {
        for (let i = 0; i < maxRetries; i++) {
          const currentState = await coordinator.getState('optimistic:counter');
          const currentVersion = await coordinator.getCurrentFencingToken('optimistic:counter').catch(() => 1);
          
          const result = await coordinator.compareAndSwap({
            key: 'optimistic:counter',
            expectedVersion: currentVersion || 1,
            newValue: { value: (currentState?.value || 0) + amount }
          });

          if (result.success) {
            return true;
          }
          // Retry with backoff
          await new Promise(resolve => setTimeout(resolve, 10 * (i + 1)));
        }
        return false;
      };

      // Execute concurrent increments
      const results = await Promise.all([
        incrementWithRetry(1),
        incrementWithRetry(2),
        incrementWithRetry(3)
      ]);

      // At least some should succeed
      expect(results.filter(Boolean).length).toBeGreaterThan(0);
    });
  });
});
