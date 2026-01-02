# stable-request

**stable-request** is a TypeScript-first **HTTP workflow execution engine** for real-world distributed systems — where HTTP `200 OK` does **not** guarantee business success, and HTTP failures still deserve **structured, actionable responses**.

It ensures that **every request attempt**, whether it succeeds or fails, can be:

- Sent reliably
- Observed
- Analyzed
- Retried intelligently
- Suppressed when non-critical
- Escalated when business-critical

All without crashing your application or hiding context behind opaque errors.

**stable-request treats failures as data.**

> If you’ve ever logged `error.message` and thought  
> **“This tells me absolutely nothing”** — this library is for you.

In addition, it enables **reliability** **content-aware retries**, **hierarchical configuration**, **batch orchestration**, and **multi-phase workflows** with deep observability — all built on top of standard HTTP calls.

All in all, it provides you with the **entire ecosystem** to build **API-integrations based workflows** with **complete flexibility**.

---

## Choose your entry point

| Need | Use |
|-----|-----|
| Reliable single API call | `stableRequest` |
| Batch or fan-out requests | `stableApiGateway` |
| Multi-step orchestration | `stableWorkflow` |

Start small and scale

---

## 📚 Table of Contents
<!-- TOC START -->
- [Installation] (#installation)
- [Core Features] (#core-features)
- [Quick Start] (#quick-start)
- [API Reference] (#api-reference)
  - [stableRequest] (#stableRequest)
  - [stableApiGateway] (#stableApiGateway)
  - [stableWorkflow] (#stableWorkflow)
- [Advanced Features] (#advanced-features)
  - [Retry Strategies] (#retry-strategies)
  - [Circuit Breaker] (#circuit-breaker)
  - [Rate Limiting] (#rate-limiting)
  - [Caching] (#caching)
  - [Pre-Execution Hooks] (#pre-execution-hooks)
  - [Shared Buffer] (#shared-buffer)
  - [Request Grouping] (#request-grouping)
  - [Concurrency Control] (#concurrency-control)
  - [Response Analysis] (#response-analysis)
  - [Error Handling] (#error-handling)
- [Advanced Use Cases] (#advanced-use-cases)
- [Configuration Options] (#configuration-options)
- [License] (#license)
<!-- TOC END -->

---

## Installation

```bash
npm install @emmvish/stable-request
```

## Core Features

- ✅ **Configurable Retry Strategies**: Fixed, Linear, and Exponential backoff
- ✅ **Circuit Breaker**: Prevent cascading failures with automatic circuit breaking
- ✅ **Rate Limiting**: Control request throughput across single or multiple requests
- ✅ **Response Caching**: Built-in TTL-based caching with global cache manager
- ✅ **Batch Processing**: Execute multiple requests concurrently or sequentially via API Gateway
- ✅ **Multi-Phase Workflows**: Orchestrate complex request workflows with phase dependencies
- ✅ **Pre-Execution Hooks**: Transform requests before execution with dynamic configuration
- ✅ **Shared Buffer**: Share state across requests in workflows and gateways
- ✅ **Request Grouping**: Apply different configurations to request groups
- ✅ **Observability Hooks**: Track errors, successful attempts, and phase completions
- ✅ **Response Analysis**: Validate responses and trigger retries based on content
- ✅ **Trial Mode**: Test configurations without making real API calls
- ✅ **TypeScript Support**: Full type safety with generics for request/response data

## Quick Start

### Basic Request with Retry

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users/123',
    method: 'GET'
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});

console.log(data);
```

### Batch Requests via API Gateway

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests = [
  { id: 'user-1', requestOptions: { reqData: { path: '/users/1' }, resReq: true } },
  { id: 'user-2', requestOptions: { reqData: { path: '/users/2' }, resReq: true } },
  { id: 'user-3', requestOptions: { reqData: { path: '/users/3' }, resReq: true } }
];

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  concurrentExecution: true,
  maxConcurrentRequests: 10
});

results.forEach(result => {
  if (result.success) {
    console.log(`Request ${result.requestId}:`, result.data);
  } else {
    console.error(`Request ${result.requestId} failed:`, result.error);
  }
});
```

### Multi-Phase Workflow

```typescript
import { stableWorkflow, STABLE_WORKFLOW_PHASE } from '@emmvish/stable-request';

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'authentication',
    requests: [
      { id: 'login', requestOptions: { reqData: { path: '/auth/login' }, resReq: true } }
    ]
  },
  {
    id: 'data-fetching',
    concurrentExecution: true,
    requests: [
      { id: 'users', requestOptions: { reqData: { path: '/users' }, resReq: true } },
      { id: 'posts', requestOptions: { reqData: { path: '/posts' }, resReq: true } }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'data-pipeline',
  commonRequestData: { hostname: 'api.example.com' },
  stopOnFirstPhaseError: true,
  logPhaseResults: true
});

console.log(`Workflow completed: ${result.successfulRequests}/${result.totalRequests} successful`);
```

## API Reference

### stableRequest

Execute a single HTTP request with retry logic and observability.

**Signature:**
```typescript
async function stableRequest<RequestDataType, ResponseDataType>(
  options: STABLE_REQUEST<RequestDataType, ResponseDataType>
): Promise<ResponseDataType | boolean>
```

**Key Options:**
- `reqData`: Request configuration (hostname, path, method, headers, body, etc.)
- `resReq`: If `true`, returns response data; if `false`, returns boolean success status
- `attempts`: Number of retry attempts (default: 1)
- `wait`: Base wait time between retries in milliseconds (default: 1000)
- `retryStrategy`: `FIXED`, `LINEAR`, or `EXPONENTIAL` (default: FIXED)
- `responseAnalyzer`: Custom function to validate response content
- `finalErrorAnalyzer`: Handle final errors gracefully (return `true` to suppress error)
- `cache`: Enable response caching with TTL
- `circuitBreaker`: Circuit breaker configuration
- `preExecution`: Pre-execution hooks for dynamic request transformation
- `commonBuffer`: Shared state object across hooks

### stableApiGateway

Execute multiple requests concurrently or sequentially with shared configuration.

**Signature:**
```typescript
async function stableApiGateway<RequestDataType, ResponseDataType>(
  requests: API_GATEWAY_REQUEST<RequestDataType, ResponseDataType>[],
  options: API_GATEWAY_OPTIONS<RequestDataType, ResponseDataType>
): Promise<API_GATEWAY_RESPONSE<ResponseDataType>[]>
```

**Key Options:**
- `concurrentExecution`: Execute requests concurrently (default: true)
- `stopOnFirstError`: Stop processing on first error (sequential mode only)
- `maxConcurrentRequests`: Limit concurrent execution
- `rateLimit`: Rate limiting configuration
- `circuitBreaker`: Shared circuit breaker across requests
- `requestGroups`: Apply different configurations to request groups
- `sharedBuffer`: Shared state across all requests
- `common*`: Common configuration applied to all requests (e.g., `commonAttempts`, `commonCache`)

### stableWorkflow

Execute multi-phase workflows with sequential or concurrent phase execution.

**Signature:**
```typescript
async function stableWorkflow<RequestDataType, ResponseDataType>(
  phases: STABLE_WORKFLOW_PHASE<RequestDataType, ResponseDataType>[],
  options: STABLE_WORKFLOW_OPTIONS<RequestDataType, ResponseDataType>
): Promise<STABLE_WORKFLOW_RESULT<ResponseDataType>>
```

**Key Options:**
- `workflowId`: Unique workflow identifier
- `concurrentPhaseExecution`: Execute phases concurrently (default: false)
- `stopOnFirstPhaseError`: Stop workflow on first phase failure
- `enableMixedExecution`: Allow mixed concurrent/sequential phase execution
- `handlePhaseCompletion`: Hook called after each phase completes
- `handlePhaseError`: Hook called when phase fails
- `sharedBuffer`: Shared state across all phases and requests

**Phase Configuration:**
- `id`: Phase identifier
- `requests`: Array of requests in this phase
- `concurrentExecution`: Execute phase requests concurrently
- `stopOnFirstError`: Stop phase on first request error
- `markConcurrentPhase`: Mark phase for concurrent execution in mixed mode
- `commonConfig`: Phase-level configuration overrides

## Advanced Features

### Retry Strategies

Control the delay between retry attempts:

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

// Fixed delay: 1000ms between each retry
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.FIXED
});

// Linear backoff: 1000ms, 2000ms, 3000ms
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.LINEAR
});

// Exponential backoff: 1000ms, 2000ms, 4000ms
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  attempts: 3,
  wait: 1000,
  maxAllowedWait: 10000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

### Circuit Breaker

Prevent cascading failures by automatically blocking requests when error thresholds are exceeded:

```typescript
import { stableApiGateway, CircuitBreakerState } from '@emmvish/stable-request';

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  circuitBreaker: {
    failureThresholdPercentage: 50,  // Open circuit at 50% failure rate
    minimumRequests: 5,               // Need at least 5 requests to calculate
    recoveryTimeoutMs: 30000,         // Try recovery after 30 seconds
    trackIndividualAttempts: false    // Track per-request success/failure
  }
});

// Circuit breaker can be shared across workflows
const breaker = new CircuitBreaker({
  failureThresholdPercentage: 50,
  minimumRequests: 10,
  recoveryTimeoutMs: 60000
});

const result = await stableWorkflow(phases, {
  circuitBreaker: breaker,
  // ... other options
});

// Check circuit breaker state
const state = breaker.getState();
console.log(`Circuit breaker state: ${state.state}`); // CLOSED, OPEN, or HALF_OPEN
```

### Rate Limiting

Control request throughput to prevent overwhelming APIs:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  concurrentExecution: true,
  rateLimit: {
    maxRequests: 10,  // Maximum 10 requests
    windowMs: 1000    // Per 1 second window
  }
});

// Rate limiting in workflows
const result = await stableWorkflow(phases, {
  rateLimit: {
    maxRequests: 5,
    windowMs: 1000
  }
});
```

### Caching

Cache responses with TTL to reduce redundant API calls:

```typescript
import { stableRequest, getGlobalCacheManager } from '@emmvish/stable-request';

// Enable caching for a request
const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/users/123' },
  resReq: true,
  cache: {
    enabled: true,
    ttl: 60000  // Cache for 60 seconds
  }
});

// Use global cache manager across requests
const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  commonCache: { enabled: true, ttl: 300000 }  // 5 minutes
});

// Manage cache manually
const cacheManager = getGlobalCacheManager();
const stats = cacheManager.getStats();
console.log(`Cache size: ${stats.size}, Valid entries: ${stats.validEntries}`);
cacheManager.clear();  // Clear all cache
```

### Pre-Execution Hooks

Transform requests dynamically before execution:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const commonBuffer: Record<string, any> = {};

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  preExecution: {
    preExecutionHook: async ({ inputParams, commonBuffer }) => {
      // Fetch authentication token
      const token = await getAuthToken();
      
      // Store in shared buffer
      commonBuffer.token = token;
      commonBuffer.timestamp = Date.now();
      
      // Override request configuration
      return {
        reqData: {
          hostname: 'api.example.com',
          path: '/authenticated-data',
          headers: { Authorization: `Bearer ${token}` }
        }
      };
    },
    preExecutionHookParams: { userId: 'user123' },
    applyPreExecutionConfigOverride: true,  // Apply returned config
    continueOnPreExecutionHookFailure: false
  },
  commonBuffer
});

console.log('Token used:', commonBuffer.token);
```

### Shared Buffer

Share state across requests in gateways and workflows:

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const sharedBuffer: Record<string, any> = { requestCount: 0 };

const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'phase-1',
    requests: [
      {
        id: 'req-1',
        requestOptions: {
          reqData: { path: '/step1' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              commonBuffer.requestCount++;
              commonBuffer.phase1Data = 'initialized';
              return {};
            },
            preExecutionHookParams: {},
            applyPreExecutionConfigOverride: false,
            continueOnPreExecutionHookFailure: false
          }
        }
      }
    ]
  },
  {
    id: 'phase-2',
    requests: [
      {
        id: 'req-2',
        requestOptions: {
          reqData: { path: '/step2' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }) => {
              commonBuffer.requestCount++;
              // Access data from phase-1
              console.log('Phase 1 data:', commonBuffer.phase1Data);
              return {};
            },
            preExecutionHookParams: {},
            applyPreExecutionConfigOverride: false,
            continueOnPreExecutionHookFailure: false
          }
        }
      }
    ]
  }
];

const result = await stableWorkflow(phases, {
  workflowId: 'stateful-workflow',
  commonRequestData: { hostname: 'api.example.com' },
  sharedBuffer
});

console.log('Total requests processed:', sharedBuffer.requestCount);
```

### Request Grouping

Apply different configurations to request groups:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests = [
  {
    id: 'critical-1',
    groupId: 'critical',
    requestOptions: { reqData: { path: '/critical/1' }, resReq: true }
  },
  {
    id: 'critical-2',
    groupId: 'critical',
    requestOptions: { reqData: { path: '/critical/2' }, resReq: true }
  },
  {
    id: 'optional-1',
    groupId: 'optional',
    requestOptions: { reqData: { path: '/optional/1' }, resReq: true }
  }
];

const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 1,
  commonWait: 100,
  requestGroups: [
    {
      id: 'critical',
      commonConfig: {
        commonAttempts: 5,  // More retries for critical requests
        commonWait: 2000,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      }
    },
    {
      id: 'optional',
      commonConfig: {
        commonAttempts: 1,  // No retries for optional requests
        commonFinalErrorAnalyzer: async () => true  // Suppress errors
      }
    }
  ]
});
```

### Concurrency Control

Limit concurrent request execution:

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

// Limit to 5 concurrent requests
const results = await stableApiGateway(requests, {
  commonRequestData: { hostname: 'api.example.com' },
  concurrentExecution: true,
  maxConcurrentRequests: 5
});

// Phase-level concurrency control
const phases: STABLE_WORKFLOW_PHASE[] = [
  {
    id: 'limited-phase',
    concurrentExecution: true,
    maxConcurrentRequests: 3,
    requests: [/* ... */]
  }
];
```

### Response Analysis

Validate response content and trigger retries:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/job/status' },
  resReq: true,
  attempts: 10,
  wait: 2000,
  responseAnalyzer: async ({ data, reqData, params }) => {
    // Retry until job is completed
    if (data.status === 'processing') {
      console.log('Job still processing, will retry...');
      return false;  // Trigger retry
    }
    return data.status === 'completed';
  }
});

console.log('Job completed:', data);
```

### Error Handling

Comprehensive error handling with observability hooks:

```typescript
import { stableRequest } from '@emmvish/stable-request';

const data = await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 3,
  wait: 1000,
  logAllErrors: true,
  handleErrors: ({ reqData, errorLog, params }) => {
    // Custom error logging
    console.error('Request failed:', {
      url: reqData.url,
      attempt: errorLog.attempt,
      statusCode: errorLog.statusCode,
      error: errorLog.error,
      isRetryable: errorLog.isRetryable
    });
    
    // Send to monitoring service
    monitoringService.trackError(errorLog);
  },
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: ({ successfulAttemptData }) => {
    console.log('Request succeeded on attempt:', successfulAttemptData.attempt);
  },
  finalErrorAnalyzer: async ({ error, reqData }) => {
    // Gracefully handle specific errors
    if (error.response?.status === 404) {
      console.warn('Resource not found, continuing...');
      return true;  // Return false to suppress error
    }
    return false;  // Throw error
  }
});
```

## Advanced Use Cases

### Use Case 1: Multi-Tenant API with Dynamic Authentication

```typescript
import { stableWorkflow, RETRY_STRATEGIES } from '@emmvish/stable-request';

interface TenantConfig {
  tenantId: string;
  apiKey: string;
  baseUrl: string;
}

async function executeTenantWorkflow(tenantConfig: TenantConfig) {
  const sharedBuffer: Record<string, any> = {
    tenantId: tenantConfig.tenantId,
    authToken: null,
    processedItems: []
  };

  const phases: STABLE_WORKFLOW_PHASE[] = [
    {
      id: 'authentication',
      requests: [
        {
          id: 'get-token',
          requestOptions: {
            reqData: {
              path: '/auth/token',
              method: 'POST',
              headers: { 'X-API-Key': tenantConfig.apiKey }
            },
            resReq: true,
            attempts: 3,
            wait: 2000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
            responseAnalyzer: async ({ data, commonBuffer }) => {
              if (data?.token) {
                commonBuffer.authToken = data.token;
                commonBuffer.tokenExpiry = Date.now() + (data.expiresIn * 1000);
                return true;
              }
              return false;
            }
          }
        }
      ]
    },
    {
      id: 'data-fetching',
      concurrentExecution: true,
      maxConcurrentRequests: 5,
      requests: [
        {
          id: 'fetch-users',
          requestOptions: {
            reqData: { path: '/users' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => ({
                reqData: {
                  path: '/users',
                  headers: { Authorization: `Bearer ${commonBuffer.authToken}` }
                }
              }),
              applyPreExecutionConfigOverride: true
            }
          }
        },
        {
          id: 'fetch-settings',
          requestOptions: {
            reqData: { path: '/settings' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => ({
                reqData: {
                  path: '/settings',
                  headers: { Authorization: `Bearer ${commonBuffer.authToken}` }
                }
              }),
              applyPreExecutionConfigOverride: true
            }
          }
        }
      ]
    },
    {
      id: 'data-processing',
      concurrentExecution: true,
      requests: [
        {
          id: 'process-users',
          requestOptions: {
            reqData: { path: '/process/users', method: 'POST' },
            resReq: true,
            preExecution: {
              preExecutionHook: ({ commonBuffer }) => {
                const usersPhase = commonBuffer.phases?.find(p => p.phaseId === 'data-fetching');
                const usersData = usersPhase?.responses?.find(r => r.requestId === 'fetch-users')?.data;
                
                return {
                  reqData: {
                    path: '/process/users',
                    method: 'POST',
                    headers: { Authorization: `Bearer ${commonBuffer.authToken}` },
                    body: { users: usersData }
                  }
                };
              },
              applyPreExecutionConfigOverride: true
            },
            responseAnalyzer: async ({ data, commonBuffer }) => {
              if (data?.processed) {
                commonBuffer.processedItems.push(...data.processed);
                return true;
              }
              return false;
            }
          }
        }
      ]
    }
  ];

  const result = await stableWorkflow(phases, {
    workflowId: `tenant-${tenantConfig.tenantId}-workflow`,
    commonRequestData: {
      hostname: tenantConfig.baseUrl,
      headers: { 'X-Tenant-ID': tenantConfig.tenantId }
    },
    stopOnFirstPhaseError: true,
    logPhaseResults: true,
    sharedBuffer,
    circuitBreaker: {
      failureThresholdPercentage: 40,
      minimumRequests: 5,
      recoveryTimeoutMs: 30000
    },
    rateLimit: {
      maxRequests: 20,
      windowMs: 1000
    },
    commonCache: {
      enabled: true,
      ttl: 300000  // Cache for 5 minutes
    },
    handlePhaseCompletion: ({ workflowId, phaseResult }) => {
      console.log(`[${workflowId}] Phase ${phaseResult.phaseId} completed:`, {
        success: phaseResult.success,
        successfulRequests: phaseResult.successfulRequests,
        executionTime: `${phaseResult.executionTime}ms`
      });
    },
    handlePhaseError: ({ workflowId, error, phaseResult }) => {
      console.error(`[${workflowId}] Phase ${phaseResult.phaseId} failed:`, error);
      // Send to monitoring
      monitoringService.trackPhaseError(workflowId, phaseResult.phaseId, error);
    }
  });

  return {
    success: result.success,
    tenantId: tenantConfig.tenantId,
    processedItems: sharedBuffer.processedItems,
    executionTime: result.executionTime,
    phases: result.phases.map(p => ({
      id: p.phaseId,
      success: p.success,
      requestCount: p.totalRequests
    }))
  };
}

// Execute workflows for multiple tenants
const tenants: TenantConfig[] = [
  { tenantId: 'tenant-1', apiKey: 'key1', baseUrl: 'api.tenant1.com' },
  { tenantId: 'tenant-2', apiKey: 'key2', baseUrl: 'api.tenant2.com' }
];

const results = await Promise.all(tenants.map(executeTenantWorkflow));
results.forEach(result => {
  console.log(`Tenant ${result.tenantId}:`, result.success ? 'Success' : 'Failed');
});
```

### Use Case 2: Resilient Data Pipeline with Fallback Strategies

```typescript
import { stableApiGateway, RETRY_STRATEGIES, CircuitBreaker } from '@emmvish/stable-request';

interface DataSource {
  id: string;
  priority: number;
  endpoint: string;
  hostname: string;
}

async function fetchDataWithFallback(dataSources: DataSource[]) {
  // Sort by priority
  const sortedSources = [...dataSources].sort((a, b) => a.priority - b.priority);
  
  // Create circuit breakers for each source
  const circuitBreakers = new Map(
    sortedSources.map(source => [
      source.id,
      new CircuitBreaker({
        failureThresholdPercentage: 50,
        minimumRequests: 3,
        recoveryTimeoutMs: 60000
      })
    ])
  );

  // Try each data source in priority order
  for (const source of sortedSources) {
    const breaker = circuitBreakers.get(source.id)!;
    const breakerState = breaker.getState();
    
    // Skip if circuit is open
    if (breakerState.state === 'OPEN') {
      console.warn(`Circuit breaker open for ${source.id}, skipping...`);
      continue;
    }

    console.log(`Attempting to fetch from ${source.id}...`);

    try {
      const requests = [
        {
          id: 'users',
          requestOptions: {
            reqData: { path: `${source.endpoint}/users` },
            resReq: true,
            attempts: 3,
            wait: 1000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        },
        {
          id: 'products',
          requestOptions: {
            reqData: { path: `${source.endpoint}/products` },
            resReq: true,
            attempts: 3,
            wait: 1000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        },
        {
          id: 'orders',
          requestOptions: {
            reqData: { path: `${source.endpoint}/orders` },
            resReq: true,
            attempts: 3,
            wait: 1000,
            retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
          }
        }
      ];

      const results = await stableApiGateway(requests, {
        commonRequestData: {
          hostname: source.hostname,
          headers: { 'X-Source-ID': source.id }
        },
        concurrentExecution: true,
        maxConcurrentRequests: 10,
        circuitBreaker: breaker,
        rateLimit: {
          maxRequests: 50,
          windowMs: 1000
        },
        commonCache: {
          enabled: true,
          ttl: 60000
        },
        commonResponseAnalyzer: async ({ data }) => {
          // Validate data structure
          return data && typeof data === 'object' && !data.error;
        },
        commonHandleErrors: ({ errorLog }) => {
          console.error(`Error from ${source.id}:`, errorLog);
        }
      });

      // Check if all requests succeeded
      const allSuccessful = results.every(r => r.success);
      
      if (allSuccessful) {
        console.log(`Successfully fetched data from ${source.id}`);
        return {
          source: source.id,
          data: {
            users: results.find(r => r.requestId === 'users')?.data,
            products: results.find(r => r.requestId === 'products')?.data,
            orders: results.find(r => r.requestId === 'orders')?.data
          }
        };
      } else {
        console.warn(`Partial failure from ${source.id}, trying next source...`);
      }
    } catch (error) {
      console.error(`Failed to fetch from ${source.id}:`, error);
      // Continue to next source
    }
  }

  throw new Error('All data sources failed');
}

// Usage
const dataSources: DataSource[] = [
  {
    id: 'primary-db',
    priority: 1,
    endpoint: '/api/v1',
    hostname: 'primary.example.com'
  },
  {
    id: 'replica-db',
    priority: 2,
    endpoint: '/api/v1',
    hostname: 'replica.example.com'
  },
  {
    id: 'backup-cache',
    priority: 3,
    endpoint: '/cached',
    hostname: 'cache.example.com'
  }
];

const result = await fetchDataWithFallback(dataSources);
console.log('Data fetched from:', result.source);
console.log('Users:', result.data.users?.length);
console.log('Products:', result.data.products?.length);
console.log('Orders:', result.data.orders?.length);
```

## Configuration Options

### Request Data Configuration

```typescript
interface REQUEST_DATA<RequestDataType> {
  hostname: string;
  protocol?: 'http' | 'https';  // default: 'https'
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';  // default: 'GET'
  path?: `/${string}`;
  port?: number;  // default: 443
  headers?: Record<string, any>;
  body?: RequestDataType;
  query?: Record<string, any>;
  timeout?: number;  // default: 15000ms
  signal?: AbortSignal;
}
```

### Retry Configuration

```typescript
interface RetryConfig {
  attempts?: number;  // default: 1
  wait?: number;  // default: 1000ms
  maxAllowedWait?: number;  // default: 60000ms
  retryStrategy?: 'fixed' | 'linear' | 'exponential';  // default: 'fixed'
  performAllAttempts?: boolean;  // default: false
}
```

### Circuit Breaker Configuration

```typescript
interface CircuitBreakerConfig {
  failureThresholdPercentage: number;  // 0-100
  minimumRequests: number;
  recoveryTimeoutMs: number;
  trackIndividualAttempts?: boolean;  // default: false
}
```

### Rate Limit Configuration

```typescript
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}
```

### Cache Configuration

```typescript
interface CacheConfig {
  enabled: boolean;
  ttl?: number;  // milliseconds, default: 300000 (5 minutes)
}
```

### Pre-Execution Configuration

```typescript
interface RequestPreExecutionOptions {
  preExecutionHook: (options: PreExecutionHookOptions) => any | Promise<any>;
  preExecutionHookParams?: any;
  applyPreExecutionConfigOverride?: boolean;  // default: false
  continueOnPreExecutionHookFailure?: boolean;  // default: false
}
```

## License

MIT © Manish Varma

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**Made with ❤️ for developers integrating with unreliable APIs**
