import type {
  DistributedStableBufferOptions,
  StableBufferInstance,
  StableBufferTransactionOptions,
  DistributedBufferSyncEvent,
  DistributedMessage
} from '../types/index.js';
import { DistributedConflictResolution, DistributedBufferOperation, DistributedBufferKey } from '../enums/index.js';
import { DistributedCoordinator } from './distributed-coordinator.js';
import { StableBuffer } from '../core/stable-buffer.js';

export interface DistributedStableBuffer {
  buffer: StableBufferInstance;
  coordinator: DistributedCoordinator;
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const createDistributedStableBuffer = async (
  options: DistributedStableBufferOptions
): Promise<DistributedStableBuffer> => {
  const {
    distributed,
    stateKey = DistributedBufferKey.STATE,
    syncOnTransaction = true,
    conflictResolution = DistributedConflictResolution.LAST_WRITE_WINS,
    mergeStrategy,
    initialState = {},
    clone,
    metricsGuardrails,
    transactionTimeoutMs,
    logTransaction
  } = options;
  
  if (!distributed) {
    throw new Error('distributed configuration is required');
  }
  
  // Create the coordinator
  const coordinator = new DistributedCoordinator(distributed);
  await coordinator.connect();
  
  // Load initial state from distributed backend
  const remoteState = await coordinator.getState<Record<string, any>>(stateKey);
  const mergedInitialState = remoteState 
    ? mergeStates(initialState, remoteState, conflictResolution, mergeStrategy)
    : initialState;
  
  // Create the local buffer
  const localBuffer = new StableBuffer({
    initialState: mergedInitialState,
    clone,
    metricsGuardrails,
    transactionTimeoutMs,
    logTransaction
  });
  
  let isSyncing = false;
  
  const subscription = await coordinator.subscribe<DistributedBufferSyncEvent>(
    DistributedBufferKey.SYNC_CHANNEL,
    async (message: DistributedMessage<DistributedBufferSyncEvent>) => {
      if (message.payload.nodeId === coordinator.nodeId) {
        return;
      }
      
      if (message.payload.operation === DistributedBufferOperation.SET && message.payload.state) {
        isSyncing = true;
        try {
          const localState = localBuffer.getState();
          const mergedState = mergeStates(
            localState, 
            message.payload.state, 
            conflictResolution, 
            mergeStrategy
          );
          localBuffer.setState(mergedState);
        } finally {
          isSyncing = false;
        }
      }
    }
  );
  
  const wrappedBuffer: StableBufferInstance = {
    run: async <T>(
      fn: (state: Record<string, any>) => T | Promise<T>,
      transactionOptions?: StableBufferTransactionOptions
    ): Promise<T> => {
      const result = await localBuffer.run(fn, transactionOptions);
      
      if (syncOnTransaction && !isSyncing) {
        const currentState = localBuffer.getState();
        await coordinator.setState(stateKey, currentState);
        
        await coordinator.publish<DistributedBufferSyncEvent>(DistributedBufferKey.SYNC_CHANNEL, {
          nodeId: coordinator.nodeId,
          timestamp: Date.now(),
          operation: DistributedBufferOperation.SET,
          state: currentState
        });
      }
      
      return result;
    },
    
    read: () => localBuffer.read(),
    getState: () => localBuffer.getState(),
    setState: (state: Record<string, any>) => {
      localBuffer.setState(state);
    }
  };
  
  const sync = async (): Promise<void> => {
    const currentState = localBuffer.getState();
    await coordinator.setState(stateKey, currentState);
    
    await coordinator.publish<DistributedBufferSyncEvent>(DistributedBufferKey.SYNC_CHANNEL, {
      nodeId: coordinator.nodeId,
      timestamp: Date.now(),
      operation: DistributedBufferOperation.SET,
      state: currentState
    });
  };
  
  const refresh = async (): Promise<void> => {
    const remoteState = await coordinator.getState<Record<string, any>>(stateKey);
    if (remoteState) {
      isSyncing = true;
      try {
        const localState = localBuffer.getState();
        const mergedState = mergeStates(
          localState, 
          remoteState, 
          conflictResolution, 
          mergeStrategy
        );
        localBuffer.setState(mergedState);
      } finally {
        isSyncing = false;
      }
    }
  };
  
  const disconnect = async (): Promise<void> => {
    await subscription.unsubscribe();
    await coordinator.disconnect();
  };
  
  return {
    buffer: wrappedBuffer,
    coordinator,
    sync,
    refresh,
    disconnect
  };
};

const mergeStates = (
  local: Record<string, any>,
  remote: Record<string, any>,
  strategy: DistributedStableBufferOptions['conflictResolution'],
  customMerge?: DistributedStableBufferOptions['mergeStrategy']
): Record<string, any> => {
  switch (strategy) {
    case DistributedConflictResolution.LAST_WRITE_WINS:
      return { ...local, ...remote };
      
    case DistributedConflictResolution.MERGE:
      return deepMerge(local, remote);
      
    case DistributedConflictResolution.CUSTOM:
      if (!customMerge) {
        throw new Error('mergeStrategy is required when conflictResolution is "custom"');
      }
      return customMerge(local, remote);
      
    default:
      return { ...local, ...remote };
  }
};

const deepMerge = (
  target: Record<string, any>,
  source: Record<string, any>
): Record<string, any> => {
  const output = { ...target };
  
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    } else {
      output[key] = source[key];
    }
  }
  
  return output;
};

export const withDistributedBufferLock = async <T>(
  distributedBuffer: DistributedStableBuffer,
  fn: () => T | Promise<T>,
  options: { ttlMs?: number; waitTimeoutMs?: number } = {}
): Promise<T> => {
  return distributedBuffer.coordinator.withLock(DistributedBufferKey.LOCK, fn, options);
};

export const createDistributedSharedBuffer = async (
  options: Omit<DistributedStableBufferOptions, 'syncOnTransaction' | 'conflictResolution'>
): Promise<DistributedStableBuffer> => {
  return createDistributedStableBuffer({
    ...options,
    syncOnTransaction: true,
    conflictResolution: DistributedConflictResolution.LAST_WRITE_WINS,
    stateKey: options.stateKey ?? DistributedBufferKey.SHARED_BUFFER
  });
};
