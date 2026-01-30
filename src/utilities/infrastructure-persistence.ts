import { StableBuffer } from '../core/stable-buffer.js';
import { isStableBuffer } from './buffer-utils.js';
import type {
  BufferLike,
  InfrastructurePersistence,
  InfrastructurePersistenceOperation,
  InfrastructurePersistenceOperationType,
  InfrastructurePersistenceTransactionResult,
  StableBufferInstance
} from '../types/index.js';

type PersistenceBufferMeta = {
  processedOperations: Record<string, number>;
};

const PERSISTENCE_META_KEY = '__infra_persistence__';

const ensureStableBuffer = (buffer?: BufferLike): StableBufferInstance => {
  if (isStableBuffer(buffer)) {
    return buffer;
  }

  if (buffer) {
    return new StableBuffer({ initialState: buffer });
  }

  return new StableBuffer();
};

const getPersistenceMeta = (state: Record<string, any>): PersistenceBufferMeta => {
  if (!state[PERSISTENCE_META_KEY]) {
    state[PERSISTENCE_META_KEY] = { processedOperations: {} } as PersistenceBufferMeta;
  }
  return state[PERSISTENCE_META_KEY] as PersistenceBufferMeta;
};

const normalizeLoadResult = <TState>(
  result: InfrastructurePersistenceTransactionResult<TState>
): TState | null | undefined => {
  if (result && typeof result === 'object' && 'skipped' in result) {
    return (result as { state?: TState | null }).state ?? null;
  }

  return result as TState | null | undefined;
};

export class InfrastructurePersistenceCoordinator<TState> {
  private readonly buffer: StableBufferInstance;
  private operationCounter = 0;

  constructor(
    private readonly persistence?: InfrastructurePersistence<TState>,
    private readonly label: string = 'infra'
  ) {
    this.buffer = ensureStableBuffer(persistence?.buffer);
  }

  async load(): Promise<TState | null | undefined> {
    if (!this.persistence) {
      return undefined;
    }

    const operationId = this.nextOperationId('load');
    const result = await this.runTransaction({
      operationId,
      type: 'load',
      timestamp: Date.now()
    });

    return normalizeLoadResult(result);
  }

  async store(state: TState): Promise<void> {
    if (!this.persistence) {
      return;
    }

    const operationId = this.nextOperationId('store');
    await this.runTransaction({
      operationId,
      type: 'store',
      timestamp: Date.now(),
      state
    });
  }

  private nextOperationId(type: InfrastructurePersistenceOperationType): string {
    this.operationCounter += 1;
    return `${this.label}-${type}-${Date.now()}-${this.operationCounter}`;
  }

  private async runTransaction(
    operation: InfrastructurePersistenceOperation<TState>
  ): Promise<InfrastructurePersistenceTransactionResult<TState>> {
    return this.buffer.run(async (state) => {
      const meta = getPersistenceMeta(state);
      if (meta.processedOperations[operation.operationId]) {
        return { skipped: true } as InfrastructurePersistenceTransactionResult<TState>;
      }

      const result = await this.executeOperation(operation);
      meta.processedOperations[operation.operationId] = Date.now();
      return result as InfrastructurePersistenceTransactionResult<TState>;
    });
  }

  private async executeOperation(
    operation: InfrastructurePersistenceOperation<TState>
  ): Promise<InfrastructurePersistenceTransactionResult<TState> | void> {
    if (this.persistence?.transaction) {
      return this.persistence.transaction(operation);
    }

    if (operation.type === 'load') {
      return this.persistence?.load?.();
    }

    if (operation.type === 'store' && this.persistence?.store) {
      return this.persistence.store(operation.state as TState);
    }

    return undefined;
  }
}
