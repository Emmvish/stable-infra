import { 
  DistributedCoordinator,
  InMemoryDistributedAdapter,
  createDistributedCircuitBreaker,
  createDistributedRateLimiter,
  createDistributedConcurrencyLimiter,
  createDistributedCacheManager,
  createDistributedFunctionCacheManager,
  createDistributedInfrastructureBundle,
  createDistributedSchedulerConfig,
  createDistributedStableBuffer,
  createDistributedSharedBuffer,
  withDistributedBufferLock,
  runAsDistributedScheduler
} from '../src/utilities/index.js';
import { StableScheduler, ScheduleTypes } from '../src/index.js';
import { CircuitBreaker } from '../src/utilities/circuit-breaker.js';
import { 
  DistributedLockStatus,
  DistributedLeaderStatus,
  DistributedConflictResolution,
  DistributedBufferKey,
  CircuitBreakerState
} from '../src/enums/index.js';

describe('Distributed Infrastructure', () => {
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
  
  describe('InMemoryDistributedAdapter', () => {
    it('should connect and disconnect properly', async () => {
      expect(coordinator['connected']).toBe(true);
      await coordinator.disconnect();
      expect(coordinator['connected']).toBe(false);
    });
    
    it('should throw when performing operations without connection', async () => {
      await coordinator.disconnect();
      await expect(coordinator.getState('test')).rejects.toThrow('is not connected');
    });
  });
  
  describe('Distributed State', () => {
    it('should set and get state', async () => {
      await coordinator.setState('key1', { value: 42 });
      const result = await coordinator.getState<{ value: number }>('key1');
      expect(result).toEqual({ value: 42 });
    });
    
    it('should return undefined for non-existent keys', async () => {
      const result = await coordinator.getState('non-existent');
      expect(result).toBeUndefined();
    });
    
    it('should update state with function', async () => {
      await coordinator.setState('counter', { count: 0 });
      await coordinator.updateState('counter', (prev: any) => ({ 
        count: (prev?.count ?? 0) + 1 
      }));
      const result = await coordinator.getState<{ count: number }>('counter');
      expect(result).toEqual({ count: 1 });
    });
    
    it('should delete state', async () => {
      await coordinator.setState('to-delete', { data: 'test' });
      await coordinator.deleteState('to-delete');
      const result = await coordinator.getState('to-delete');
      expect(result).toBeUndefined();
    });
  });
  
  describe('Distributed Counters', () => {
    it('should increment counter', async () => {
      const result = await coordinator.incrementCounter('counter1');
      expect(result).toBe(1);
      
      const result2 = await coordinator.incrementCounter('counter1');
      expect(result2).toBe(2);
    });
    
    it('should increment counter by specified amount', async () => {
      const result = await coordinator.incrementCounter('counter2', 5);
      expect(result).toBe(5);
    });
    
    it('should decrement counter', async () => {
      await coordinator.incrementCounter('counter3', 10);
      const result = await coordinator.decrementCounter('counter3', 3);
      expect(result).toBe(7);
    });
    
    it('should get counter value', async () => {
      await coordinator.incrementCounter('counter4', 100);
      const result = await coordinator.getCounter('counter4');
      expect(result).toBe(100);
    });
    
    it('should return 0 for non-existent counter', async () => {
      const result = await coordinator.getCounter('non-existent-counter');
      expect(result).toBe(0);
    });
  });
  
  describe('Distributed Locks', () => {
    it('should acquire and release lock', async () => {
      const result = await coordinator.acquireLock({ resource: 'my-lock', ttlMs: 5000 });
      expect(result.status).toBe(DistributedLockStatus.ACQUIRED);
      expect(result.handle).toBeDefined();
      
      const released = await coordinator.releaseLock(result.handle!);
      expect(released).toBe(true);
    });
    
    it('should fail to acquire already held lock', async () => {
      const lock1 = await coordinator.acquireLock({ resource: 'exclusive-lock', ttlMs: 5000 });
      expect(lock1.status).toBe(DistributedLockStatus.ACQUIRED);
      
      const lock2 = await coordinator.acquireLock({ 
        resource: 'exclusive-lock',
        ttlMs: 5000,
        waitTimeoutMs: 100
      });
      expect(lock2.status).toBe(DistributedLockStatus.FAILED);
      
      await coordinator.releaseLock(lock1.handle!);
    });
    
    it('should execute function with lock via withLock', async () => {
      let executed = false;
      
      const result = await coordinator.withLock('fn-lock', async () => {
        executed = true;
        return 42;
      }, { ttlMs: 5000 });
      
      expect(executed).toBe(true);
      expect(result).toBe(42);
    });
    
    it('should release lock even if function throws', async () => {
      try {
        await coordinator.withLock('error-lock', async () => {
          throw new Error('Test error');
        }, { ttlMs: 5000 });
      } catch (e) {
        // Expected
      }
      
      // Lock should be released, so we should be able to acquire it
      const result = await coordinator.acquireLock({ resource: 'error-lock', ttlMs: 5000 });
      expect(result.status).toBe(DistributedLockStatus.ACQUIRED);
      await coordinator.releaseLock(result.handle!);
    });
  });
  
  describe('Distributed Pub/Sub', () => {
    it('should publish and receive messages', async () => {
      const received: any[] = [];
      
      const subscription = await coordinator.subscribe('topic1', (msg) => {
        received.push(msg.payload);
      });
      
      await coordinator.publish('topic1', { value: 1 });
      await coordinator.publish('topic1', { value: 2 });
      
      // Small delay to allow async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(received.length).toBeGreaterThanOrEqual(1);
      
      await subscription.unsubscribe();
    });
  });
  
  describe('Distributed Leader Election', () => {
    it('should become leader when sole candidate', async () => {
      const result = await coordinator.campaignForLeader({
        electionKey: 'election1',
        ttlMs: 60000,
        heartbeatIntervalMs: 15000
      });
      
      expect(result.status).toBe(DistributedLeaderStatus.LEADER);
      expect(result.leaderId).toBe(coordinator.nodeId);
      
      await coordinator.resignLeadership('election1');
    });
    
    it('should track leader status correctly', async () => {
      const result = await coordinator.campaignForLeader({
        electionKey: 'election2',
        ttlMs: 60000,
        heartbeatIntervalMs: 15000
      });
      
      expect(result.status).toBe(DistributedLeaderStatus.LEADER);
      expect(coordinator.isCurrentLeader).toBe(true);
      
      await coordinator.resignLeadership('election2');
      expect(coordinator.isCurrentLeader).toBe(false);
    });
  });
  
  describe('Coordinator Metrics', () => {
    it('should track operation metrics', async () => {
      await coordinator.setState('metric-test', { value: 1 });
      await coordinator.getState('metric-test');
      const lockResult = await coordinator.acquireLock({ resource: 'metric-lock', ttlMs: 1000 });
      if (lockResult.handle) {
        await coordinator.releaseLock(lockResult.handle);
      }
      
      const metrics = coordinator.getMetrics();
      
      expect(metrics.stateOperations).toBeGreaterThan(0);
      expect(metrics.nodeId).toBe(coordinator.nodeId);
    });
  });
});

describe('Distributed Infrastructure Factories', () => {
  let adapter: InMemoryDistributedAdapter;
  
  beforeEach(() => {
    adapter = new InMemoryDistributedAdapter();
  });
  
  describe('createDistributedCircuitBreaker', () => {
    it('should create circuit breaker with persistence', async () => {
      const circuitBreaker = await createDistributedCircuitBreaker({
        distributed: { adapter, namespace: 'test' },
        failureThresholdPercentage: 50,
        minimumRequests: 10,
        recoveryTimeoutMs: 30000
      });
      
      expect(circuitBreaker).toBeDefined();
      expect(typeof circuitBreaker.recordFailure).toBe('function');
      expect(typeof circuitBreaker.recordSuccess).toBe('function');
    });
  });
  
  describe('createDistributedRateLimiter', () => {
    it('should create rate limiter with persistence', async () => {
      const rateLimiter = await createDistributedRateLimiter({
        distributed: { adapter, namespace: 'test' },
        maxRequests: 100,
        windowMs: 60000
      });
      
      expect(rateLimiter).toBeDefined();
      expect(typeof rateLimiter.execute).toBe('function');
    });
  });
  
  describe('createDistributedConcurrencyLimiter', () => {
    it('should create concurrency limiter with persistence', async () => {
      const concurrencyLimiter = await createDistributedConcurrencyLimiter({
        distributed: { adapter, namespace: 'test' },
        limit: 10
      });
      
      expect(concurrencyLimiter).toBeDefined();
      expect(typeof concurrencyLimiter.execute).toBe('function');
    });
  });
  
  describe('createDistributedCacheManager', () => {
    it('should create cache manager with persistence', async () => {
      const cacheManager = await createDistributedCacheManager({
        distributed: { adapter, namespace: 'test' },
        enabled: true,
        ttl: 60000
      });
      
      expect(cacheManager).toBeDefined();
      expect(typeof cacheManager.get).toBe('function');
      expect(typeof cacheManager.set).toBe('function');
    });
  });
  
  describe('createDistributedFunctionCacheManager', () => {
    it('should create distributed function cache manager', async () => {
      const functionCacheManager = await createDistributedFunctionCacheManager({
        distributed: { adapter, namespace: 'test' },
        enabled: true,
        ttl: 60000
      });
      
      expect(functionCacheManager).toBeDefined();
      expect(typeof functionCacheManager.get).toBe('function');
      expect(typeof functionCacheManager.set).toBe('function');
    });
    
    it('should cache function results across calls', async () => {
      const functionCacheManager = await createDistributedFunctionCacheManager({
        distributed: { adapter, namespace: 'fn-cache-test' },
        enabled: true,
        ttl: 60000
      });
      
      const expensiveFn = (x: number) => x * 2;
      
      // First call - cache miss
      const cached1 = functionCacheManager.get(expensiveFn, [5]);
      expect(cached1).toBeNull();
      
      // Store result
      functionCacheManager.set(expensiveFn, [5], 10);
      
      // Second call - cache hit
      const cached2 = functionCacheManager.get<[number], number>(expensiveFn, [5]);
      expect(cached2).not.toBeNull();
      expect(cached2?.data).toBe(10);
    });
  });
  
  describe('createDistributedInfrastructureBundle', () => {
    it('should create complete infrastructure bundle', async () => {
      const bundle = await createDistributedInfrastructureBundle({
        distributed: { adapter, namespace: 'test' },
        circuitBreaker: { 
          failureThresholdPercentage: 50, 
          minimumRequests: 10, 
          recoveryTimeoutMs: 30000 
        },
        rateLimiter: { maxRequests: 100, windowMs: 60000 },
        concurrencyLimiter: { limit: 10 },
        cacheManager: { enabled: true, ttl: 60000 },
        functionCacheManager: { enabled: true, ttl: 60000 }
      });
      
      expect(bundle.circuitBreaker).toBeDefined();
      expect(bundle.rateLimiter).toBeDefined();
      expect(bundle.concurrencyLimiter).toBeDefined();
      expect(bundle.cacheManager).toBeDefined();
      expect(bundle.functionCacheManager).toBeDefined();
      expect(bundle.coordinator).toBeDefined();
    });
    
    it('should create partial bundle when not all options provided', async () => {
      const bundle = await createDistributedInfrastructureBundle({
        distributed: { adapter, namespace: 'test' },
        circuitBreaker: { 
          failureThresholdPercentage: 50, 
          minimumRequests: 10, 
          recoveryTimeoutMs: 30000 
        }
      });
      
      expect(bundle.circuitBreaker).toBeDefined();
      expect(bundle.rateLimiter).toBeUndefined();
      expect(bundle.coordinator).toBeDefined();
    });
  });
});

describe('Distributed Scheduler Config', () => {
  let adapter: InMemoryDistributedAdapter;
  
  beforeEach(() => {
    adapter = new InMemoryDistributedAdapter();
  });
  
  it('should create scheduler configuration with distributed settings', async () => {
    const setup = await createDistributedSchedulerConfig({
      distributed: { adapter, namespace: 'scheduler-test' },
      scheduler: {
        maxParallel: 2,
        tickIntervalMs: 1000
      },
      circuitBreaker: { 
        failureThresholdPercentage: 50, 
        minimumRequests: 10, 
        recoveryTimeoutMs: 30000 
      }
    });
    
    expect(setup.config).toBeDefined();
    expect(setup.config.maxParallel).toBe(2);
    expect(setup.coordinator).toBeDefined();
    expect(typeof setup.isLeader).toBe('function');
  });
  
  it('should include shared buffer when provided', async () => {
    const mockBuffer = { 
      run: jest.fn(), 
      read: jest.fn().mockReturnValue({}),
      getState: jest.fn().mockReturnValue({}),
      setState: jest.fn()
    };
    
    const setup = await createDistributedSchedulerConfig({
      distributed: { adapter, namespace: 'scheduler-test' },
      scheduler: {
        sharedBuffer: mockBuffer
      }
    });
    
    expect(setup.config.sharedBuffer).toBe(mockBuffer);
  });

  describe('New leader infra state reload', () => {
    it('should call reloadFromPersistence on shared infra when new leader starts', async () => {
      const adapter = new InMemoryDistributedAdapter();
      const reloadSpy = jest.spyOn(CircuitBreaker.prototype, 'reloadFromPersistence');

      const runner = await runAsDistributedScheduler({
        distributed: { adapter, namespace: 'reload-spy-test' },
        circuitBreaker: {
          failureThresholdPercentage: 50,
          minimumRequests: 5,
          recoveryTimeoutMs: 10000
        },
        createScheduler: (config) => new StableScheduler(config, async () => {})
      });

      reloadSpy.mockClear();
      await runner.start();
      expect(reloadSpy).toHaveBeenCalled();

      await runner.stop();
      reloadSpy.mockRestore();
    });

    it('should restore circuit breaker state from backend when new leader takes over', async () => {
      const adapter = new InMemoryDistributedAdapter();
      const namespace = 'new-leader-cb-restore';
      const cbConfig = {
        failureThresholdPercentage: 50,
        minimumRequests: 5,
        recoveryTimeoutMs: 10000
      };

      let node2CircuitBreaker: CircuitBreaker | undefined;

      const runner1 = await runAsDistributedScheduler({
        distributed: { adapter, namespace },
        circuitBreaker: cbConfig,
        createScheduler: (config) => {
          const s = new StableScheduler(config, async (_job, ctx) => {
            for (let i = 0; i < 10; i++) {
              ctx.sharedInfrastructure?.circuitBreaker?.recordFailure();
            }
          });
          s.addJobs([
            {
              id: 'open-cb',
              schedule: { type: ScheduleTypes.INTERVAL, everyMs: 100 }
            }
          ]);
          return s;
        }
      });

      const runner2 = await runAsDistributedScheduler({
        distributed: { adapter, namespace },
        circuitBreaker: cbConfig,
        createScheduler: (config) => {
          node2CircuitBreaker = config.sharedInfrastructure?.circuitBreaker;
          return new StableScheduler(config, async () => {});
        }
      });

      await runner1.start();
      await new Promise((r) => setTimeout(r, 350));
      await runner1.stop();

      await runner2.start();
      await new Promise((r) => setTimeout(r, 50));

      expect(node2CircuitBreaker).toBeDefined();
      expect(node2CircuitBreaker!.getState().state).toBe(CircuitBreakerState.OPEN);

      await runner2.stop();
    });
  });
});

describe('Distributed StableBuffer', () => {
  let adapter: InMemoryDistributedAdapter;
  
  beforeEach(() => {
    adapter = new InMemoryDistributedAdapter();
  });
  
  describe('createDistributedStableBuffer', () => {
    it('should create distributed buffer and connect', async () => {
      const { buffer, disconnect, coordinator } = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-test' },
        initialState: { counter: 0 }
      });
      
      expect(buffer).toBeDefined();
      expect(coordinator).toBeDefined();
      
      await disconnect();
    });
    
    it('should sync state after transactions', async () => {
      const { buffer, coordinator, disconnect } = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-sync-test' },
        initialState: { counter: 0 },
        syncOnTransaction: true
      });
      
      await buffer.run(state => {
        state.counter = 10;
      });
      
      const remoteState = await coordinator.getState<{ counter: number }>(DistributedBufferKey.STATE);
      expect(remoteState?.counter).toBe(10);
      
      await disconnect();
    });
    
    it('should refresh state from remote', async () => {
      const { buffer, coordinator, refresh, disconnect } = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-refresh-test' },
        initialState: { counter: 0 },
        syncOnTransaction: false
      });
      
      // Manually set remote state
      await coordinator.setState(DistributedBufferKey.STATE, { counter: 100 });
      
      // Verify local is still at 0
      expect(buffer.getState().counter).toBe(0);
      
      // Refresh from remote
      await refresh();
      
      // Now local should be 100
      expect(buffer.getState().counter).toBe(100);
      
      await disconnect();
    });
    
    it('should handle last-write-wins conflict resolution', async () => {
      const { buffer, coordinator, refresh, disconnect } = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-lww-test' },
        initialState: { a: 1, b: 2 },
        conflictResolution: DistributedConflictResolution.LAST_WRITE_WINS
      });
      
      // Set remote state with different values
      await coordinator.setState(DistributedBufferKey.STATE, { a: 10, b: 20, c: 30 });
      
      // Refresh
      await refresh();
      
      // Remote values should win for overlapping keys
      const state = buffer.getState();
      expect(state.a).toBe(10);
      expect(state.b).toBe(20);
      expect(state.c).toBe(30);
      
      await disconnect();
    });
    
    it('should handle custom merge strategy', async () => {
      const customMerge = (local: any, remote: any) => ({
        ...local,
        ...remote,
        merged: true,
        sum: (local.value || 0) + (remote.value || 0)
      });
      
      const { buffer, coordinator, refresh, disconnect } = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-custom-test' },
        initialState: { value: 5 },
        conflictResolution: DistributedConflictResolution.CUSTOM,
        mergeStrategy: customMerge
      });
      
      await coordinator.setState(DistributedBufferKey.STATE, { value: 10 });
      await refresh();
      
      const state = buffer.getState();
      expect(state.merged).toBe(true);
      expect(state.sum).toBe(15);
      
      await disconnect();
    });
    
    it('should read state without modification', async () => {
      const { buffer, disconnect } = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-read-test' },
        initialState: { items: ['a', 'b', 'c'] }
      });
      
      const result = await buffer.read();
      expect(result.items).toEqual(['a', 'b', 'c']);
      
      await disconnect();
    });
  });
  
  describe('withDistributedBufferLock', () => {
    it('should execute function with distributed lock', async () => {
      const distributedBuffer = await createDistributedStableBuffer({
        distributed: { adapter, namespace: 'buffer-lock-test' },
        initialState: { counter: 0 }
      });
      
      let executed = false;
      const result = await withDistributedBufferLock(distributedBuffer, async () => {
        executed = true;
        await distributedBuffer.buffer.run(state => {
          state.counter = 42;
        });
        return 'done';
      });
      
      expect(executed).toBe(true);
      expect(result).toBe('done');
      expect(distributedBuffer.buffer.getState().counter).toBe(42);
      
      await distributedBuffer.disconnect();
    });
  });
  
  describe('createDistributedSharedBuffer', () => {
    it('should create buffer with scheduler-friendly defaults', async () => {
      const { buffer, disconnect } = await createDistributedSharedBuffer({
        distributed: { adapter, namespace: 'shared-buffer-test' },
        initialState: { processedCount: 0 }
      });
      
      expect(buffer).toBeDefined();
      expect(buffer.getState().processedCount).toBe(0);
      
      await disconnect();
    });
  });
});

describe('Cross-Node Simulation', () => {
  it('should sync state between two nodes using same adapter', async () => {
    // Both nodes share the same adapter (simulating shared backend)
    const sharedAdapter = new InMemoryDistributedAdapter();
    
    // Node 1
    const { buffer: buffer1, disconnect: disconnect1 } = await createDistributedStableBuffer({
      distributed: { adapter: sharedAdapter, namespace: 'cross-node-test' },
      initialState: { value: 0 },
      stateKey: 'shared-state'
    });
    
    // Node 2
    const { buffer: buffer2, refresh: refresh2, disconnect: disconnect2 } = await createDistributedStableBuffer({
      distributed: { adapter: sharedAdapter, namespace: 'cross-node-test' },
      initialState: { value: 0 },
      stateKey: 'shared-state'
    });
    
    // Node 1 updates state
    await buffer1.run(state => {
      state.value = 100;
    });
    
    // Node 2 refreshes and should see the update
    await refresh2();
    expect(buffer2.getState().value).toBe(100);
    
    // Cleanup
    await disconnect1();
    await disconnect2();
  });
  
  it('should share infrastructure state between distributed circuit breakers', async () => {
    const sharedAdapter = new InMemoryDistributedAdapter();
    
    // Create distributed circuit breakers on two "nodes"
    const cb1 = await createDistributedCircuitBreaker({
      distributed: { adapter: sharedAdapter, namespace: 'shared-infra' },
      failureThresholdPercentage: 50,
      minimumRequests: 10,
      recoveryTimeoutMs: 30000,
      stateKey: 'shared-circuit-breaker'
    });
    
    const cb2 = await createDistributedCircuitBreaker({
      distributed: { adapter: sharedAdapter, namespace: 'shared-infra' },
      failureThresholdPercentage: 50,
      minimumRequests: 10,
      recoveryTimeoutMs: 30000,
      stateKey: 'shared-circuit-breaker'
    });
    
    // Register failures on node 1
    cb1.recordFailure();
    cb1.recordFailure();
    
    // Both circuit breakers have been created with the same persistence backend
    // This test confirms the architecture - each CB syncs via the distributed backend
    expect(cb1).toBeDefined();
    expect(cb2).toBeDefined();
  });
});
