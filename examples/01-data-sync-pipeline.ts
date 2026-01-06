/**
 * Enterprise Example 1: Multi-Source Data Synchronization Pipeline
 * 
 * This example demonstrates a production-grade data synchronization workflow that:
 * - Fetches data from multiple API endpoints concurrently
 * - Validates and transforms the data
 * - Implements circuit breaker pattern to prevent cascade failures
 * - Uses response caching to optimize performance
 * - Includes comprehensive error handling and observability
 * - Implements non-linear workflow with conditional retry logic
 * 
 * Use Case: Synchronizing user data, posts, and comments from an external API
 * to an internal system with data enrichment and validation.
 */

import { 
  stableWorkflow, 
  RETRY_STRATEGIES, 
  PHASE_DECISION_ACTIONS,
  CircuitBreaker,
  type STABLE_WORKFLOW_PHASE
} from '../src/index.js';

// Simulated internal system endpoints (using JSONPlaceholder for demo)
const SOURCE_API = 'jsonplaceholder.typicode.com';
const DESTINATION_API = 'jsonplaceholder.typicode.com'; // In real scenario, this would be your internal API

// Shared state for workflow
interface SyncState {
  syncId: string;
  startTime: number;
  users: any[];
  posts: any[];
  comments: any[];
  enrichedData: any[];
  validationErrors: string[];
  uploadedRecords: number;
  failedRecords: number;
  retryCount: number;
}

const syncState: SyncState = {
  syncId: `sync-${Date.now()}`,
  startTime: Date.now(),
  users: [],
  posts: [],
  comments: [],
  enrichedData: [],
  validationErrors: [],
  uploadedRecords: 0,
  failedRecords: 0,
  retryCount: 0
};

// Shared circuit breaker for all API calls
const sourceApiBreaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 3,
  recoveryTimeoutMs: 30000,
  successThresholdPercentage: 60,
  halfOpenMaxRequests: 2,
  trackIndividualAttempts: false
});

console.log('🚀 Starting Enterprise Data Synchronization Pipeline...\n');
console.log(`Sync ID: ${syncState.syncId}`);
console.log(`Source API: ${SOURCE_API}`);
console.log(`Destination API: ${DESTINATION_API}\n`);

// Define the multi-phase workflow
const syncPhases: STABLE_WORKFLOW_PHASE[] = [
  // Phase 1: Fetch data from multiple sources concurrently
  {
    id: 'fetch-source-data',
    concurrentExecution: true,
    requests: [
      {
        id: 'fetch-users',
        requestOptions: {
          reqData: { 
            path: '/users?_limit=5',
            method: 'GET'
          },
          resReq: true,
          handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
            const buffer = commonBuffer as SyncState;
            buffer.users = successfulAttemptData.data;
            console.log(`  ✅ Fetched ${buffer.users.length} users (${successfulAttemptData.executionTime}ms)`);
          }
        }
      },
      {
        id: 'fetch-posts',
        requestOptions: {
          reqData: { 
            path: '/posts?_limit=10',
            method: 'GET'
          },
          resReq: true,
          handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
            const buffer = commonBuffer as SyncState;
            buffer.posts = successfulAttemptData.data;
            console.log(`  ✅ Fetched ${buffer.posts.length} posts (${successfulAttemptData.executionTime}ms)`);
          }
        }
      },
      {
        id: 'fetch-comments',
        requestOptions: {
          reqData: { 
            path: '/comments?_limit=20',
            method: 'GET'
          },
          resReq: true,
          handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
            const buffer = commonBuffer as SyncState;
            buffer.comments = successfulAttemptData.data;
            console.log(`  ✅ Fetched ${buffer.comments.length} comments (${successfulAttemptData.executionTime}ms)`);
          }
        }
      }
    ]
  },

  // Phase 2: Data enrichment and transformation
  {
    id: 'enrich-data',
    concurrentExecution: false,
    requests: [
      {
        id: 'enrich-posts-with-users',
        requestOptions: {
          reqData: { 
            path: '/posts/1', // Dummy endpoint for demo
            method: 'GET'
          },
          resReq: false,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              console.log('  🔄 Enriching posts with user data...');
              
              // Enrich posts with user information
              const buffer = commonBuffer as SyncState;
              buffer.enrichedData = buffer.posts.map(post => {
                const user = buffer.users.find(u => u.id === post.userId);
                const postComments = buffer.comments.filter(c => c.postId === post.id);
                
                return {
                  postId: post.id,
                  title: post.title,
                  body: post.body,
                  author: user ? {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    company: user.company?.name
                  } : null,
                  commentCount: postComments.length,
                  enrichedAt: new Date().toISOString(),
                  syncId: buffer.syncId
                };
              });
              
              console.log(`  ✅ Enriched ${buffer.enrichedData.length} posts with user and comment data`);
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ]
  },

  // Phase 3: Data validation with conditional retry
  {
    id: 'validate-data',
    allowReplay: true,
    maxReplayCount: 2,
    requests: [
      {
        id: 'validate-enriched-data',
        requestOptions: {
          reqData: { 
            path: '/posts/1', // Dummy endpoint
            method: 'GET'
          },
          resReq: false,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              console.log('  🔍 Validating enriched data...');
              
              const buffer = commonBuffer as SyncState;
              buffer.validationErrors = [];
              
              // Validate enriched data
              buffer.enrichedData.forEach((item, index) => {
                if (!item.author) {
                  buffer.validationErrors.push(`Record ${index}: Missing author information`);
                }
                if (!item.title || item.title.length < 3) {
                  buffer.validationErrors.push(`Record ${index}: Invalid title`);
                }
              });
              
              if (buffer.validationErrors.length > 0) {
                console.log(`  ⚠️  Found ${buffer.validationErrors.length} validation errors`);
                buffer.validationErrors.slice(0, 3).forEach(err => {
                  console.log(`     - ${err}`);
                });
              } else {
                console.log(`  ✅ All ${buffer.enrichedData.length} records validated successfully`);
              }
              
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ],
    phaseDecisionHook: async ({ phaseResult, executionHistory, sharedBuffer }) => {
      const buffer = sharedBuffer as SyncState;
      const validationAttempts = executionHistory.filter(h => h.phaseId === 'validate-data').length;
      
      // If validation errors exist and we haven't retried too many times, replay
      if (buffer.validationErrors.length > 0 && validationAttempts < 2) {
        console.log(`\n  🔄 Validation failed, attempting data cleanup (Attempt ${validationAttempts + 1}/2)...\n`);
        
        // Clean up data (remove invalid records)
        buffer.enrichedData = buffer.enrichedData.filter(item => 
          item.author && item.title && item.title.length >= 3
        );
        buffer.retryCount++;
        
        return { 
          action: PHASE_DECISION_ACTIONS.REPLAY,
          metadata: { reason: 'Data validation failed, retrying after cleanup' }
        };
      }
      
      // If still have errors after retries, log warning but continue
      if (buffer.validationErrors.length > 0) {
        console.log(`  ⚠️  Proceeding with ${buffer.enrichedData.length} valid records (${buffer.validationErrors.length} invalid records excluded)\n`);
      }
      
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },

  // Phase 4: Upload to destination with batching
  {
    id: 'upload-to-destination',
    concurrentExecution: true,
    requests: [
      {
        id: 'upload-batch-1',
        requestOptions: {
          reqData: { 
            path: '/posts',
            method: 'POST'
          },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              const buffer = commonBuffer as SyncState;
              const batch = buffer.enrichedData.slice(0, Math.ceil(buffer.enrichedData.length / 2));
              
              console.log(`  📤 Uploading batch 1 (${batch.length} records)...`);
              
              return {
                reqData: {
                  body: { records: batch }
                }
              };
            },
            applyPreExecutionConfigOverride: true
          },
          handleSuccessfulAttemptData: async ({ commonBuffer, successfulAttemptData }) => {
            const buffer = commonBuffer as SyncState;
            const batchSize = Math.ceil(buffer.enrichedData.length / 2);
            buffer.uploadedRecords += batchSize;
            console.log(`  ✅ Batch 1 uploaded successfully (${batchSize} records) - ${successfulAttemptData.executionTime}ms`);
          },
          finalErrorAnalyzer: async ({ commonBuffer }) => {
            const buffer = commonBuffer as SyncState;
            const batchSize = Math.ceil(buffer.enrichedData.length / 2);
            buffer.failedRecords += batchSize;
            console.log(`  ❌ Batch 1 upload failed (${batchSize} records)`);
            return true; // Suppress error to continue workflow
          }
        }
      },
      {
        id: 'upload-batch-2',
        requestOptions: {
          reqData: { 
            path: '/posts',
            method: 'POST'
          },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              const buffer = commonBuffer as SyncState;
              const batch = buffer.enrichedData.slice(Math.ceil(buffer.enrichedData.length / 2));
              
              console.log(`  📤 Uploading batch 2 (${batch.length} records)...`);
              
              return {
                reqData: {
                  path: '/posts',
                  body: { records: batch }
                }
              };
            },
            applyPreExecutionConfigOverride: true
          },
          handleSuccessfulAttemptData: async ({ commonBuffer, successfulAttemptData }) => {
            const buffer = commonBuffer as SyncState;
            const batchSize = buffer.enrichedData.length - Math.ceil(buffer.enrichedData.length / 2);
            buffer.uploadedRecords += batchSize;
            console.log(`  ✅ Batch 2 uploaded successfully (${batchSize} records) - ${successfulAttemptData.executionTime}ms`);
          },
          finalErrorAnalyzer: async ({ commonBuffer }) => {
            const buffer = commonBuffer as SyncState;
            const batchSize = buffer.enrichedData.length - Math.ceil(buffer.enrichedData.length / 2);
            buffer.failedRecords += batchSize;
            console.log(`  ❌ Batch 2 upload failed (${batchSize} records)`);
            return true; // Suppress error to continue workflow
          }
        }
      }
    ]
  },

  // Phase 5: Verification and cleanup
  {
    id: 'verify-sync',
    requests: [
      {
        id: 'verify-upload',
        requestOptions: {
          reqData: { 
            path: '/posts?_limit=1',
            method: 'GET'
          },
          resReq: false,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              console.log('  🔍 Verifying synchronization...');
              
              const buffer = commonBuffer as SyncState;
              const duration = Date.now() - buffer.startTime;
              
              console.log('\n' + '='.repeat(60));
              console.log('📊 SYNCHRONIZATION SUMMARY');
              console.log('='.repeat(60));
              console.log(`Sync ID:           ${buffer.syncId}`);
              console.log(`Total Duration:    ${duration}ms`);
              console.log(`Records Processed: ${buffer.enrichedData.length}`);
              console.log(`Successfully Uploaded: ${buffer.uploadedRecords}`);
              console.log(`Failed Uploads:    ${buffer.failedRecords}`);
              console.log(`Validation Retries: ${buffer.retryCount}`);
              console.log(`Circuit Breaker State: ${sourceApiBreaker.getState().state}`);
              console.log('='.repeat(60) + '\n');
              
              return {};
            },
            applyPreExecutionConfigOverride: false
          }
        }
      }
    ]
  }
];

// Execute the workflow
(async () => {
  try {
    const result = await stableWorkflow(syncPhases, {
      workflowId: syncState.syncId,
      commonRequestData: {
        hostname: SOURCE_API,
        protocol: 'https',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'StableRequest-DataSyncPipeline/1.0'
        }
      },
      
      // Resilience configuration
      commonAttempts: 3,
      commonWait: 1000,
      commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      commonMaxAllowedWait: 10000,
      commonLogAllSuccessfulAttempts: true,
      
      // Circuit breaker for source API
      circuitBreaker: sourceApiBreaker,
      
      // Response caching for GET requests
      commonCache: {
        enabled: true,
        ttl: 60000, // 1 minute
        respectCacheControl: true
      },
      
      // Rate limiting
      rateLimit: {
        maxRequests: 50,
        windowMs: 10000 // 50 requests per 10 seconds
      },
      
      // Concurrency control
      maxConcurrentRequests: 3,
      
      // Workflow configuration
      enableNonLinearExecution: true,
      stopOnFirstPhaseError: false,
      sharedBuffer: syncState,
      
      // Observability hooks
      handlePhaseCompletion: async ({ phaseResult }) => {
        console.log(`\n✅ Phase "${phaseResult.phaseId}" completed in ${phaseResult.executionTime}ms`);
        console.log(`   Requests: ${phaseResult.successfulRequests}/${phaseResult.totalRequests} successful\n`);
      },
      
      handlePhaseError: async ({ phaseResult, error }) => {
        console.error(`\n❌ Phase "${phaseResult.phaseId}" failed:`, error.message);
      },
      
      handlePhaseDecision: async (decision, phaseResult) => {
        if (decision.action !== PHASE_DECISION_ACTIONS.CONTINUE) {
          console.log(`\n🔀 Phase Decision: ${decision.action}`, decision.metadata || '');
        }
      }
    });
    
    // Final results
    console.log('\n' + '='.repeat(60));
    console.log('🎉 WORKFLOW COMPLETED');
    console.log('='.repeat(60));
    console.log(`Success:           ${result.success ? '✅ Yes' : '❌ No'}`);
    console.log(`Total Phases:      ${result.totalPhases}`);
    console.log(`Completed Phases:  ${result.completedPhases}`);
    console.log(`Total Requests:    ${result.totalRequests}`);
    console.log(`Successful:        ${result.successfulRequests}`);
    console.log(`Failed:            ${result.failedRequests}`);
    console.log(`Execution Time:    ${result.executionTime}ms`);
    console.log(`Phase Replays:     ${result.executionHistory.filter(h => h.decision?.action === PHASE_DECISION_ACTIONS.REPLAY).length}`);
    console.log('='.repeat(60));
    
    // Circuit breaker final state
    const breakerState = sourceApiBreaker.getState();
    console.log('\n📡 Circuit Breaker Final State:');
    console.log(`   State: ${breakerState.state}`);
    console.log(`   Total Requests: ${breakerState.totalRequests}`);
    console.log(`   Failed: ${breakerState.failedRequests}`);
    console.log(`   Success Rate: ${((breakerState.successfulRequests / breakerState.totalRequests) * 100).toFixed(2)}%`);
    
  } catch (error: any) {
    console.error('\n❌ WORKFLOW FAILED:', error.message);
    console.error('\nError Details:', error);
    process.exit(1);
  }
})();
