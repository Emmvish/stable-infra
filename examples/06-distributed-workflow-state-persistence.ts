/**
 * Enterprise Example 6: Distributed Workflow State Persistence
 * 
 * This example demonstrates a production-grade distributed data processing workflow with:
 * - State persistence to Redis for distributed execution
 * - Workflow recovery and resumption after failures
 * - Multi-stage data pipeline with checkpoint management
 * - Distributed lock mechanisms for concurrent safety
 * - State versioning and audit trails
 * - Real-time progress tracking across instances
 * - Automatic cleanup of completed workflows
 * 
 * Use Case: Large-scale data migration pipeline that can be resumed from any checkpoint,
 * run across multiple server instances, and provide real-time progress visibility.
 */

import { 
  stableWorkflow, 
  PHASE_DECISION_ACTIONS,
  REQUEST_METHODS,
  VALID_REQUEST_PROTOCOLS,
  type STABLE_WORKFLOW_PHASE,
  type StatePersistenceOptions
} from '../src/index.js';

// ============================================================================
// STATE PERSISTENCE LAYER
// ============================================================================

/**
 * Simulated Redis-like storage for demonstration
 * In production, use actual Redis client (ioredis or node-redis)
 */
class StateStorage {
  private storage: Map<string, { value: string; expiresAt: number }> = new Map();

  async setex(key: string, ttl: number, value: string): Promise<void> {
    const expiresAt = Date.now() + (ttl * 1000);
    this.storage.set(key, { value, expiresAt });
    console.log(`    💾 Stored state: ${key} (TTL: ${ttl}s)`);
  }

  async get(key: string): Promise<string | null> {
    const entry = this.storage.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.storage.delete(key);
      return null;
    }
    console.log(`    📥 Loaded state: ${key}`);
    return entry.value;
  }

  async del(key: string): Promise<void> {
    this.storage.delete(key);
    console.log(`    🗑️  Deleted state: ${key}`);
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.storage.keys()).filter(key => regex.test(key));
  }

  getStats(): { totalKeys: number; totalSize: number } {
    let totalSize = 0;
    this.storage.forEach(entry => {
      totalSize += entry.value.length;
    });
    return {
      totalKeys: this.storage.size,
      totalSize
    };
  }
}

const stateStore = new StateStorage();

/**
 * Redis persistence function with distributed locking
 */
async function persistToRedis({ executionContext, params, buffer }: StatePersistenceOptions): Promise<Record<string, any>> {
  const { workflowId, phaseId, branchId } = executionContext;
  const { ttl = 86400, enableLocking = false, namespace = 'workflow' } = params || {};
  
  // Generate hierarchical key
  const stateKey = `${namespace}:${workflowId}:${branchId || 'main'}:${phaseId || 'global'}`;
  const lockKey = `lock:${stateKey}`;
  
  // Check if we're storing or loading
  const isStoring = buffer && Object.keys(buffer).length > 0;
  
  if (enableLocking) {
    // Simple distributed lock simulation
    const lockValue = `${Date.now()}-${Math.random()}`;
    await stateStore.setex(lockKey, 5, lockValue);
  }
  
  try {
    if (isStoring) {
      // STORE MODE: Save state with metadata
      const stateWithMeta = {
        ...buffer,
        _meta: {
          workflowId,
          phaseId,
          branchId,
          timestamp: new Date().toISOString(),
          version: (buffer._meta?.version || 0) + 1
        }
      };
      
      await stateStore.setex(stateKey, ttl, JSON.stringify(stateWithMeta));
      
      // Store in audit log
      const auditKey = `${namespace}:audit:${workflowId}:${Date.now()}`;
      await stateStore.setex(auditKey, ttl * 2, JSON.stringify({
        action: 'state_saved',
        phaseId,
        timestamp: new Date().toISOString(),
        stateSnapshot: stateWithMeta
      }));
      
    } else {
      // LOAD MODE: Retrieve state
      const data = await stateStore.get(stateKey);
      if (data) {
        const parsed = JSON.parse(data);
        console.log(`    📊 Loaded state version: ${parsed._meta?.version || 0}`);
        return parsed;
      }
      return {};
    }
  } finally {
    if (enableLocking) {
      await stateStore.del(lockKey);
    }
  }
  
  return {};
}

/**
 * Checkpoint-based persistence for phase completion tracking
 */
async function createCheckpoint({ executionContext, params, buffer }: StatePersistenceOptions): Promise<Record<string, any>> {
  const { workflowId, phaseId } = executionContext;
  const { ttl = 86400 } = params || {};
  
  // Ensure we have a valid workflowId
  const validWorkflowId = workflowId || WORKFLOW_ID;
  const checkpointKey = `checkpoint:${validWorkflowId}`;
  
  if (buffer && Object.keys(buffer).length > 0) {
    // Store checkpoint
    const existingData = await stateStore.get(checkpointKey);
    const existing = existingData ? JSON.parse(existingData) : {};
    
    const checkpointData = {
      ...existing,
      completedPhases: [...new Set([...(existing.completedPhases || []), ...(buffer.completedPhases || [])])],
      lastPhase: phaseId || existing.lastPhase,
      lastUpdated: new Date().toISOString(),
      progress: buffer.progress || existing.progress || 0,
      processedRecords: buffer.recordsProcessed || existing.processedRecords || 0
    };
    
    await stateStore.setex(checkpointKey, ttl, JSON.stringify(checkpointData));
    console.log(`    ✅ Checkpoint saved: ${phaseId || 'global'} (Progress: ${checkpointData.progress}%)`);
  } else {
    // Load checkpoint
    const data = await stateStore.get(checkpointKey);
    return data ? JSON.parse(data) : { completedPhases: [], processedRecords: 0 };
  }
  
  return {};
}

// ============================================================================
// WORKFLOW STATE DEFINITION
// ============================================================================

interface WorkflowState {
  // Data tracking
  sourceRecords: any[];
  transformedRecords: any[];
  validatedRecords: any[];
  migratedRecords: any[];
  failedRecords: any[];
  
  // Progress tracking
  completedPhases: string[];
  currentPhase: string;
  progress: number;
  recordsProcessed: number;
  totalRecords: number;
  
  // Execution metadata
  startTime: number;
  lastUpdateTime: number;
  attemptCount: number;
  errors: string[];
  
  // Recovery metadata
  canResume: boolean;
  resumeFromPhase: string | null;
}

const workflowState: WorkflowState = {
  sourceRecords: [],
  transformedRecords: [],
  validatedRecords: [],
  migratedRecords: [],
  failedRecords: [],
  completedPhases: [],
  currentPhase: '',
  progress: 0,
  recordsProcessed: 0,
  totalRecords: 0,
  startTime: Date.now(),
  lastUpdateTime: Date.now(),
  attemptCount: 0,
  errors: [],
  canResume: true,
  resumeFromPhase: null
};

// ============================================================================
// WORKFLOW DEFINITION
// ============================================================================

const WORKFLOW_ID = `migration-${Date.now()}`;
const SOURCE_API = 'jsonplaceholder.typicode.com';

console.log('🚀 Starting Distributed Workflow with State Persistence');
console.log('━'.repeat(80));
console.log(`Workflow ID: ${WORKFLOW_ID}`);
console.log(`Persistence: Redis-like storage with TTL`);
console.log(`Features: Recovery, Resumption, Distributed Locking, Audit Trails`);
console.log('━'.repeat(80));
console.log();

// Define the multi-stage data pipeline
const migrationPhases: STABLE_WORKFLOW_PHASE[] = [
  // ========================================================================
  // PHASE 1: Data Extraction
  // ========================================================================
  {
    id: 'extract-source-data',
    concurrentExecution: false,
    requests: [
      {
        id: 'extract-users',
        requestOptions: {
          reqData: { 
            hostname: SOURCE_API,
            path: '/posts/1', // Dummy request
            method: REQUEST_METHODS.GET
          },
          resReq: false, // Don't actually make the request
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              console.log('\n📥 Phase 1: Extracting source data...');
              const buffer = commonBuffer as WorkflowState;
              
              // Generate mock data for demonstration
              buffer.sourceRecords = Array.from({ length: 100 }, (_, i) => ({
                id: i + 1,
                name: `User ${i + 1}`,
                email: `user${i + 1}@example.com`,
                username: `user${i + 1}`,
                company: { name: `Company ${i % 10}` },
                address: {
                  geo: {
                    lat: `${(Math.random() * 180 - 90).toFixed(6)}`,
                    lng: `${(Math.random() * 360 - 180).toFixed(6)}`
                  }
                }
              }));
              
              buffer.totalRecords = buffer.sourceRecords.length;
              buffer.progress = 20;
              buffer.recordsProcessed = buffer.sourceRecords.length;
              buffer.lastUpdateTime = Date.now();
              console.log(`  ✅ Extracted ${buffer.sourceRecords.length} records from source`);
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const buffer = sharedBuffer as WorkflowState;
      
      // Check if phase already completed (resumption scenario)
      if (buffer.completedPhases.includes('extract-source-data')) {
        console.log(`  ⏩ Phase already completed, skipping...`);
        return { action: PHASE_DECISION_ACTIONS.SKIP, skipToPhaseId: 'transform-data' };
      }
      
      if (phaseResult.success && buffer.sourceRecords.length > 0) {
        buffer.completedPhases.push('extract-source-data');
        buffer.currentPhase = 'extract-source-data';
        buffer.recordsProcessed = buffer.sourceRecords.length;
        console.log(`  📊 Phase complete: ${buffer.sourceRecords.length} records extracted`);
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      
      buffer.errors.push('Data extraction failed - no records found');
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    },
    statePersistence: {
      persistenceFunction: persistToRedis,
      persistenceParams: { 
        ttl: 3600,
        enableLocking: true,
        namespace: 'migration'
      },
      loadBeforeHooks: true,
      storeAfterHooks: true
    }
  },

  // ========================================================================
  // PHASE 2: Data Transformation
  // ========================================================================
  {
    id: 'transform-data',
    requests: [
      {
        id: 'transform-records',
        requestOptions: {
          reqData: { 
            hostname: SOURCE_API,
            path: '/posts/1', // Dummy endpoint
            method: REQUEST_METHODS.GET
          },
          resReq: false,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              const buffer = commonBuffer as WorkflowState;
              
              if (!buffer.sourceRecords || buffer.sourceRecords.length === 0) {
                console.log('  ⚠️  No source records to transform');
                return {};
              }
              
              console.log(`  🔄 Transforming ${buffer.sourceRecords.length} records...`);
              
              buffer.transformedRecords = buffer.sourceRecords.map((record, index) => ({
                id: record.id,
                externalId: record.id,
                name: record.name,
                email: record.email?.toLowerCase(),
                username: record.username,
                company: record.company?.name,
                location: {
                  lat: parseFloat(record.address?.geo?.lat || '0'),
                  lng: parseFloat(record.address?.geo?.lng || '0')
                },
                metadata: {
                  importedAt: new Date().toISOString(),
                  source: 'jsonplaceholder',
                  workflowId: WORKFLOW_ID,
                  transformationVersion: '1.0'
                }
              }));
              
              buffer.progress = 30;
              buffer.lastUpdateTime = Date.now();
              
              console.log(`  ✅ Transformed ${buffer.transformedRecords.length} records`);
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const buffer = sharedBuffer as WorkflowState;
      
      if (buffer.completedPhases.includes('transform-data')) {
        console.log(`  ⏩ Phase already completed, skipping...`);
        return { action: PHASE_DECISION_ACTIONS.SKIP, skipToPhaseId: 'validate-data' };
      }
      
      if (phaseResult.success && buffer.transformedRecords && buffer.transformedRecords.length > 0) {
        buffer.completedPhases.push('transform-data');
        buffer.currentPhase = 'transform-data';
        console.log(`  📊 Phase complete: ${buffer.transformedRecords.length} records transformed`);
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      
      if (buffer.attemptCount < 2 && buffer.sourceRecords && buffer.sourceRecords.length > 0) {
        buffer.attemptCount++;
        console.log(`  🔄 Transformation incomplete, retrying (attempt ${buffer.attemptCount})...`);
        return { action: PHASE_DECISION_ACTIONS.REPLAY };
      }
      
      buffer.errors.push('Data transformation failed - no valid transformations');
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    },
    allowReplay: true,
    maxReplayCount: 2,
    statePersistence: {
      persistenceFunction: persistToRedis,
      persistenceParams: { 
        ttl: 3600,
        enableLocking: true,
        namespace: 'migration'
      },
      loadBeforeHooks: true,
      storeAfterHooks: true
    }
  },

  // ========================================================================
  // PHASE 3: Data Validation
  // ========================================================================
  {
    id: 'validate-data',
    requests: [
      {
        id: 'validate-records',
        requestOptions: {
          reqData: { 
            hostname: SOURCE_API,
            path: '/posts/1',
            method: REQUEST_METHODS.GET
          },
          resReq: false,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              console.log('  🔍 Validating records...');
              
              const buffer = commonBuffer as WorkflowState;
              buffer.validatedRecords = [];
              buffer.failedRecords = [];
              
              buffer.transformedRecords.forEach((record, index) => {
                const errors: string[] = [];
                
                // Validation rules
                if (!record.email || !record.email.includes('@')) {
                  errors.push('Invalid email');
                }
                if (!record.name || record.name.length < 3) {
                  errors.push('Invalid name');
                }
                if (!record.externalId) {
                  errors.push('Missing external ID');
                }
                
                if (errors.length === 0) {
                  buffer.validatedRecords.push(record);
                } else {
                  buffer.failedRecords.push({
                    record,
                    errors,
                    index
                  });
                }
              });
              
              buffer.progress = 60;
              buffer.lastUpdateTime = Date.now();
              
              console.log(`  ✅ Validated: ${buffer.validatedRecords.length} passed, ${buffer.failedRecords.length} failed`);
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const buffer = sharedBuffer as WorkflowState;
      
      if (buffer.completedPhases.includes('validate-data')) {
        console.log(`  ⏩ Phase already completed, skipping...`);
        return { action: PHASE_DECISION_ACTIONS.SKIP, skipToPhaseId: 'migrate-data' };
      }
      
      if (phaseResult.success) {
        buffer.completedPhases.push('validate-data');
        buffer.currentPhase = 'validate-data';
        
        // Determine if we can proceed with migrations
        if (buffer.validatedRecords.length === 0) {
          buffer.errors.push('No valid records to migrate');
          return { action: PHASE_DECISION_ACTIONS.TERMINATE };
        }
        
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    },
    statePersistence: {
      persistenceFunction: persistToRedis,
      persistenceParams: { 
        ttl: 3600,
        enableLocking: true,
        namespace: 'migration'
      },
      loadBeforeHooks: true,
      storeAfterHooks: true
    }
  },

  // ========================================================================
  // PHASE 4: Data Migration (Concurrent Batch Upload)
  // ========================================================================
  {
    id: 'migrate-data',
    concurrentExecution: true,
    requests: [{
      id: 'prepare-migration',
      requestOptions: {
        reqData: {
          hostname: SOURCE_API,
          path: '/posts/1',
          method: REQUEST_METHODS.GET
        },
        resReq: false,
        preExecution: {
          preExecutionHook: ({ commonBuffer }) => {
            const buffer = commonBuffer as WorkflowState;
            console.log(`  📤 Preparing ${buffer.validatedRecords.length} records for migration...`);
            
            // Simulate migration by marking records as migrated
            buffer.migratedRecords = buffer.validatedRecords.map(record => ({
              ...record,
              migratedAt: new Date().toISOString()
            }));
            
            buffer.progress = 90;
            buffer.lastUpdateTime = Date.now();
            console.log(`  ✅ Migration completed: ${buffer.migratedRecords.length} records`);
            
            return {};
          },
          applyPreExecutionConfigOverride: false
        }
      }
    }],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const buffer = sharedBuffer as WorkflowState;
      
      if (buffer.completedPhases.includes('migrate-data')) {
        console.log(`  ⏩ Phase already completed, skipping...`);
        return { action: PHASE_DECISION_ACTIONS.SKIP, skipToPhaseId: 'verify-migration' };
      }
      
      if (phaseResult.success) {
        buffer.completedPhases.push('migrate-data');
        buffer.currentPhase = 'migrate-data';
        buffer.progress = 90;
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      
      buffer.errors.push('Data migration failed');
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    },
    statePersistence: {
      persistenceFunction: persistToRedis,
      persistenceParams: { 
        ttl: 3600,
        enableLocking: true,
        namespace: 'migration'
      },
      loadBeforeHooks: true,
      storeAfterHooks: true
    }
  },

  // ========================================================================
  // PHASE 5: Verification
  // ========================================================================
  {
    id: 'verify-migration',
    requests: [
      {
        id: 'verify-completion',
        requestOptions: {
          reqData: { 
            hostname: SOURCE_API,
            path: '/posts/1',
            method: REQUEST_METHODS.GET
          },
          resReq: false,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              console.log('  🔍 Verifying migration completion...');
              
              const buffer = commonBuffer as WorkflowState;
              const expectedCount = buffer.validatedRecords.length;
              const actualCount = buffer.migratedRecords.length;
              
              console.log(`  📊 Expected: ${expectedCount}, Migrated: ${actualCount}, Failed: ${buffer.failedRecords.length}`);
              
              buffer.progress = 100;
              buffer.lastUpdateTime = Date.now();
              
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, sharedBuffer }) => {
      const buffer = sharedBuffer as WorkflowState;
      
      if (phaseResult.success) {
        buffer.completedPhases.push('verify-migration');
        buffer.currentPhase = 'verify-migration';
        buffer.canResume = false; // Migration complete, no need to resume
        return { action: PHASE_DECISION_ACTIONS.CONTINUE };
      }
      
      return { action: PHASE_DECISION_ACTIONS.TERMINATE };
    },
    statePersistence: {
      persistenceFunction: persistToRedis,
      persistenceParams: { 
        ttl: 3600,
        enableLocking: true,
        namespace: 'migration'
      },
      loadBeforeHooks: true,
      storeAfterHooks: true
    }
  }
];

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

async function executeWorkflow() {
  try {
    const result = await stableWorkflow(migrationPhases, {
      workflowId: WORKFLOW_ID,
      commonRequestData: { 
        hostname: SOURCE_API,
        protocol: VALID_REQUEST_PROTOCOLS.HTTPS
      },
      enableNonLinearExecution: true,
      stopOnFirstPhaseError: false,
      logPhaseResults: false,
      maxWorkflowIterations: 100,
      sharedBuffer: workflowState,
      commonStatePersistence: {
        persistenceFunction: createCheckpoint,
        persistenceParams: { ttl: 7200 },
        loadBeforeHooks: true,
        storeAfterHooks: true
      },
      handlePhaseCompletion: async ({ phaseResult, sharedBuffer }) => {
        const buffer = sharedBuffer as WorkflowState;
        console.log();
        console.log(`✅ Phase "${phaseResult.phaseId}" completed`);
        console.log(`   Duration: ${phaseResult.executionTime}ms`);
        console.log(`   Success: ${phaseResult.successfulRequests}/${phaseResult.totalRequests}`);
        console.log(`   Progress: ${buffer.progress}%`);
        console.log();
      },
      handlePhaseError: async ({ phaseResult, error, sharedBuffer }) => {
        const buffer = sharedBuffer as WorkflowState;
        console.error(`❌ Phase "${phaseResult.phaseId}" failed: ${error.message}`);
        buffer.errors.push(`Phase ${phaseResult.phaseId}: ${error.message}`);
      }
    });

    // ========================================================================
    // RESULTS AND ANALYTICS
    // ========================================================================
    console.log();
    console.log('━'.repeat(80));
    console.log('📊 WORKFLOW EXECUTION SUMMARY');
    console.log('━'.repeat(80));
    console.log();
    console.log(`Workflow ID: ${WORKFLOW_ID}`);
    console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Total Phases: ${result.totalPhases}`);
    console.log(`Completed Phases: ${workflowState.completedPhases.length}`);
    console.log(`Total Requests: ${result.totalRequests}`);
    console.log(`Successful: ${result.successfulRequests}`);
    console.log(`Failed: ${result.failedRequests}`);
    console.log(`Total Duration: ${result.executionTime}ms`);
    console.log();
    
    console.log('📈 MIGRATION STATISTICS:');
    console.log(`   Source Records: ${workflowState.sourceRecords.length}`);
    console.log(`   Transformed: ${workflowState.transformedRecords.length}`);
    console.log(`   Validated: ${workflowState.validatedRecords.length}`);
    console.log(`   Migrated: ${workflowState.migratedRecords.length}`);
    console.log(`   Failed Validation: ${workflowState.failedRecords.length}`);
    console.log(`   Final Progress: ${workflowState.progress}%`);
    console.log();

    // Storage statistics
    const storageStats = stateStore.getStats();
    console.log('💾 PERSISTENCE STATISTICS:');
    console.log(`   Total State Keys: ${storageStats.totalKeys}`);
    console.log(`   Storage Size: ${(storageStats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`   Completed Phases: ${workflowState.completedPhases.join(' → ')}`);
    console.log();

    if (workflowState.errors.length > 0) {
      console.log('⚠️  ERRORS:');
      workflowState.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
      console.log();
    }

    console.log('━'.repeat(80));
    console.log();

    // Demonstrate state recovery capability
    if (result.success) {
      console.log('🔄 RECOVERY DEMONSTRATION:');
      console.log('   This workflow can be resumed from any checkpoint.');
      console.log('   State is persisted in Redis with the following keys:');
      const keys = await stateStore.keys('migration:*');
      keys.forEach(key => {
        console.log(`   • ${key}`);
      });
      console.log();
      console.log('   To resume: Simply re-run with the same workflowId.');
      console.log('   Completed phases will be automatically skipped.');
      console.log();
    }

  } catch (error: any) {
    console.error();
    console.error('━'.repeat(80));
    console.error('❌ WORKFLOW FATAL ERROR');
    console.error('━'.repeat(80));
    console.error(error.message);
    console.error();
    
    // Even on error, state is preserved for recovery
    console.log('💾 State preserved for recovery. Last checkpoint:');
    console.log(`   Completed Phases: ${workflowState.completedPhases.join(', ')}`);
    console.log(`   Progress: ${workflowState.progress}%`);
    console.log(`   Can Resume: ${workflowState.canResume}`);
    console.log();
  }
}

// Execute the workflow
executeWorkflow().catch(console.error);