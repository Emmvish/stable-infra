## stable-request

`stable-request` is a TypeScript-first HTTP reliability toolkit for workflow-driven API integrations, that goes beyond status-code retries by validating response content, handling eventual consistency, coordinating batch workflows with intelligent grouping, and providing deep observability into every request attempt. 

It is designed for real-world distributed systems where HTTP success (200) does not guarantee business success.

## Why stable-request?

Most HTTP client libraries only retry on network failures or specific HTTP status codes. **stable-request** goes further by providing:

- ✅ **Content-aware Retries** - Validate response content and retry even on successful HTTP responses
- 🔄 **Multi-Phase Workflows** - Orchestrate complex workflows with sequential phases and mixed phase execution modes (concurrent & sequential)
- 🚀 **Batch Processing** - Execute multiple requests with hierarchical configuration (global → group → request)
- 🎯 **Request Groups** - Organize related requests with shared settings and logical boundaries
- 🧪 **Trial Mode** - Simulate failures to test your retry logic without depending on real network instability
- 📊 **Granular Observability** - Monitor every attempt with detailed hooks
- ⚡ **Multiple Retry Strategies** - Fixed, linear, or exponential backoff
- 🔧 **Flexible Error Handling** - Custom error analysis and graceful degradation

## Installation

```bash
npm install @emmvish/stable-request
```

## Quick Start

### 1. Basic Request (No Retries)

```typescript
import { stableRequest } from '@emmvish/stable-request';

interface RequestBodyParams {
  page: number,
  offset: number
}

interface ResponseParams {
  id: number,
  name: string
}

const getStableResponse = async () => {
  const data = await stableRequest<RequestBodyParams, ResponseParams>({
    reqData: {
      hostname: 'api.example.com',
      path: '/users/123',
      headers: { Authorization: `Bearer ${token}` }
      body: { page: 10, offset: 5 }
    },
    resReq: true  // Return the response data
  });
  
  console.log(data); // { id: 123, name: 'John' }
}

getStableResponse();
```

### 2. Add Simple Retries

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

const getStableResponse = async () => {
  const data = await stableRequest({
    reqData: {
      hostname: 'api.example.com',
      path: '/users/123'
    },
    resReq: true,
    attempts: 3,              // Retry up to 3 times
    wait: 1000,               // Wait 1 second between retries
    maxAllowedWait: 8000,   // Maximum permissible wait time between retries
    retryStrategy: RETRY_STRATEGIES.EXPONENTIAL  // 1s, 2s, 4s, 8s...
  });

  console.log(data);
}

getStableResponse();
```

**Retry Strategies:**
- `RETRY_STRATEGIES.FIXED` - Same delay every time (1s, 1s, 1s...)
- `RETRY_STRATEGIES.LINEAR` - Increasing delay (1s, 2s, 3s...)
- `RETRY_STRATEGIES.EXPONENTIAL` - Exponential backoff (1s, 2s, 4s, 8s...)

### 3. Validate Response Content (Content-Aware Retries)

Sometimes an API returns HTTP 200 but the data isn't ready yet. Use `responseAnalyzer`:

```typescript
const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/jobs/456/status'
  },
  resReq: true,
  attempts: 10,
  wait: 2000,
  
  // This hook validates the response content
  responseAnalyzer: async ({ reqData, data, trialMode, params }) => {
    // Return true if response is valid, false to retry
    if (data.status === 'completed') {
      return true;  // Success! Don't retry
    }
    
    console.log(`Job still processing... (${data.percentComplete}%)`);
    return false;  // Retry this request
  }
});

console.log('Job completed:', data);
```

**Hook Signature:**
```typescript
responseAnalyzer?: (options: {
  reqData: AxiosRequestConfig;     // Request configuration
  data: ResponseDataType;           // Response data from API
  trialMode?: TRIAL_MODE_OPTIONS;   // Trial mode settings (if enabled)
  params?: any;                     // Custom parameters (via hookParams)
}) => boolean | Promise<boolean>;
```

### 4. Monitor Errors (Observability)

Track every failed attempt with `handleErrors`:

```typescript
const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  resReq: true,
  attempts: 5,
  logAllErrors: true,  // Enable error logging
  
  // This hook is called on every failed attempt
  handleErrors: async ({ reqData, errorLog, maxSerializableChars }) => {
    // Log to your monitoring service
    await monitoring.logError({
      url: reqData.url,
      attempt: errorLog.attempt,        // e.g., "3/5"
      error: errorLog.error,            // Error message
      isRetryable: errorLog.isRetryable,  // Can we retry?
      type: errorLog.type,              // 'HTTP_ERROR' or 'INVALID_CONTENT'
      statusCode: errorLog.statusCode,  // HTTP status code
      timestamp: errorLog.timestamp,    // ISO timestamp
      executionTime: errorLog.executionTime  // ms
    });
  }
});
```

**Hook Signature:**
```typescript
handleErrors?: (options: {
  reqData: AxiosRequestConfig;       // Request configuration
  errorLog: ERROR_LOG;               // Detailed error information
  maxSerializableChars?: number;     // Max chars for stringification
}) => any | Promise<any>;
```

**ERROR_LOG Structure:**
```typescript
interface ERROR_LOG {
  timestamp: string;        // ISO timestamp
  executionTime: number;    // Request duration in ms
  statusCode: number;       // HTTP status code (0 if network error)
  attempt: string;          // e.g., "3/5"
  error: string;            // Error message
  type: 'HTTP_ERROR' | 'INVALID_CONTENT';
  isRetryable: boolean;     // Can this error be retried?
}
```

### 5. Monitor Successful Attempts

Track successful requests with `handleSuccessfulAttemptData`:

```typescript
const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  resReq: true,
  attempts: 3,
  logAllSuccessfulAttempts: true,  // Enable success logging
  
  // This hook is called on every successful attempt
  handleSuccessfulAttemptData: async ({ reqData, successfulAttemptData, maxSerializableChars }) => {
    // Track metrics
    await analytics.track('api_success', {
      url: reqData.url,
      attempt: successfulAttemptData.attempt,  // e.g., "2/3"
      duration: successfulAttemptData.executionTime,  // ms
      statusCode: successfulAttemptData.statusCode,   // 200, 201, etc.
      timestamp: successfulAttemptData.timestamp
    });
  }
});
```

**Hook Signature:**
```typescript
handleSuccessfulAttemptData?: (options: {
  reqData: AxiosRequestConfig;              // Request configuration
  successfulAttemptData: SUCCESSFUL_ATTEMPT_DATA;  // Success details
  maxSerializableChars?: number;            // Max chars for stringification
}) => any | Promise<any>;
```

**SUCCESSFUL_ATTEMPT_DATA Structure:**
```typescript
interface SUCCESSFUL_ATTEMPT_DATA<ResponseDataType> {
  attempt: string;          // e.g., "2/3"
  timestamp: string;        // ISO timestamp
  executionTime: number;    // Request duration in ms
  data: ResponseDataType;   // Response data
  statusCode: number;       // HTTP status code
}
```

### 6. Handle Final Errors Gracefully

Decide what to do when all retries fail using `finalErrorAnalyzer`:

```typescript
const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/optional-feature'
  },
  resReq: true,
  attempts: 3,
  
  // This hook is called when all retries are exhausted
  finalErrorAnalyzer: async ({ reqData, error, trialMode, params }) => {
    // Check if this is a non-critical error
    if (error.message.includes('404')) {
      console.log('Feature not available, continuing without it');
      return true;  // Suppress error, return false instead of throwing
    }
    
    // For critical errors
    await alerting.sendAlert('Critical API failure', error);
    return false;  // Throw the error
  }
});

if (data === false) {
  console.log('Optional feature unavailable, using default');
}
```

**Hook Signature:**
```typescript
finalErrorAnalyzer?: (options: {
  reqData: AxiosRequestConfig;     // Request configuration
  error: any;                      // The final error object
  trialMode?: TRIAL_MODE_OPTIONS;  // Trial mode settings (if enabled)
  params?: any;                    // Custom parameters (via hookParams)
}) => boolean | Promise<boolean>;
```

**Return value:**
- `true` - Suppress the error, function returns `false` instead of throwing
- `false` - Throw the error

### 7. Pass Custom Parameters to Hooks

You can pass custom data to `responseAnalyzer` and `finalErrorAnalyzer`:

```typescript
const expectedVersion = 42;

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  resReq: true,
  attempts: 5,
  
  // Pass custom parameters
  hookParams: {
    responseAnalyzerParams: { expectedVersion, minItems: 10 },
    finalErrorAnalyzerParams: { alertTeam: true }
  },
  
  responseAnalyzer: async ({ data, params }) => {
    // Access custom parameters
    return data.version >= params.expectedVersion && 
           data.items.length >= params.minItems;
  },
  
  finalErrorAnalyzer: async ({ error, params }) => {
    if (params.alertTeam) {
      await pagerDuty.alert('API failure', error);
    }
    return false;
  }
});
```

## Intermediate Concepts

### Making POST/PUT/PATCH Requests

```typescript
import { stableRequest, REQUEST_METHODS } from '@emmvish/stable-request';

const newUser = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your-token'
    },
    body: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  },
  resReq: true,
  attempts: 3
});
```

### Query Parameters

```typescript
const users = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    query: {
      page: 1,
      limit: 10,
      sort: 'createdAt'
    }
  },
  resReq: true
});
// Requests: https://api.example.com:443/users?page=1&limit=10&sort=createdAt
```

### Custom Timeout and Port

```typescript
const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/slow-endpoint',
    port: 8080,
    protocol: 'http',
    timeout: 30000  // 30 seconds
  },
  resReq: true,
  attempts: 2
});
```

### Request Cancellation

```typescript
const controller = new AbortController();

// Cancel after 5 seconds
setTimeout(() => controller.abort(), 5000);

try {
  await stableRequest({
    reqData: {
      hostname: 'api.example.com',
      path: '/data',
      signal: controller.signal
    },
    resReq: true
  });
} catch (error) {
  if (error.message.includes('cancelled')) {
    console.log('Request was cancelled');
  }
}
```

### Trial Mode (Testing Your Retry Logic)

Simulate failures without depending on actual API issues:

```typescript
await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  resReq: true,
  attempts: 5,
  logAllErrors: true,
  
  trialMode: {
    enabled: true,
    reqFailureProbability: 0.3,    // 30% chance each request fails
    retryFailureProbability: 0.2   // 20% chance error is non-retryable
  }
});
```

**Use cases:**
- Test your error handling logic
- Verify monitoring alerts work
- Chaos engineering experiments
- Integration testing

## Batch Processing - Multiple Requests

### Basic Batch Request

```typescript
import { stableApiGateway } from '@emmvish/stable-request';

const requests = [
  {
    id: 'user-1',
    requestOptions: {
      reqData: { path: '/users/1' },
      resReq: true
    }
  },
  {
    id: 'user-2',
    requestOptions: {
      reqData: { path: '/users/2' },
      resReq: true
    }
  },
  {
    id: 'user-3',
    requestOptions: {
      reqData: { path: '/users/3' },
      resReq: true
    }
  }
];

const results = await stableApiGateway(requests, {
  // Common options applied to ALL requests
  commonRequestData: {
    hostname: 'api.example.com'
  },
  commonAttempts: 3,
  commonWait: 1000,
  concurrentExecution: true  // Run all requests in parallel
});

// Process results
results.forEach(result => {
  if (result.success) {
    console.log(`${result.requestId} succeeded:`, result.data);
  } else {
    console.error(`${result.requestId} failed:`, result.error);
  }
});
```

**Response Format:**
```typescript
interface API_GATEWAY_RESPONSE<ResponseDataType> {
  requestId: string;     // The ID you provided
  groupId?: string;      // Group ID (if request was grouped)
  success: boolean;      // Did the request succeed?
  data?: ResponseDataType;  // Response data (if success)
  error?: string;        // Error message (if failed)
}
```

### Sequential Execution (With Dependencies)

```typescript
const steps = [
  {
    id: 'step-1-create',
    requestOptions: {
      reqData: { 
        path: '/orders',
        method: REQUEST_METHODS.POST,
        body: { item: 'Widget' }
      },
      resReq: true
    }
  },
  {
    id: 'step-2-process',
    requestOptions: {
      reqData: { 
        path: '/orders/123/process',
        method: REQUEST_METHODS.POST
      },
      resReq: true
    }
  },
  {
    id: 'step-3-ship',
    requestOptions: {
      reqData: { path: '/orders/123/ship' },
      resReq: true
    }
  }
];

const results = await stableApiGateway(steps, {
  concurrentExecution: false,  // Run one at a time
  stopOnFirstError: true,      // Stop if any step fails
  commonRequestData: {
    hostname: 'api.example.com'
  },
  commonAttempts: 3
});

if (results.every(r => r.success)) {
  console.log('Workflow completed successfully');
} else {
  const failedStep = results.findIndex(r => !r.success);
  console.error(`Workflow failed at step ${failedStep + 1}`);
}
```

### Shared Configuration (Common Options)

Instead of repeating configuration for each request:

```typescript
const results = await stableApiGateway(
  [
    { id: 'req-1', requestOptions: { reqData: { path: '/users/1' } } },
    { id: 'req-2', requestOptions: { reqData: { path: '/users/2' } } },
    { id: 'req-3', requestOptions: { reqData: { path: '/users/3' } } }
  ],
  {
    // Applied to ALL requests
    commonRequestData: {
      hostname: 'api.example.com',
      headers: { 'Authorization': `Bearer ${token}` }
    },
    commonResReq: true,
    commonAttempts: 5,
    commonWait: 2000,
    commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
    commonLogAllErrors: true,
    
    // Shared hooks
    commonHandleErrors: async ({ reqData, errorLog }) => {
      console.log(`Request to ${reqData.url} failed (${errorLog.attempt})`);
    },
    
    commonResponseAnalyzer: async ({ data }) => {
      return data?.success === true;
    }
  }
);
```

## Advanced: Request Grouping

Group related requests with different configurations. Configuration priority:

**Individual Request** > **Group Config** > **Global Common Config**

### Example: Service Tiers

```typescript
const results = await stableApiGateway(
  [
    // Critical services - need high reliability
    {
      id: 'auth-check',
      groupId: 'critical',
      requestOptions: {
        reqData: { path: '/auth/verify' },
        resReq: true
      }
    },
    {
      id: 'payment-process',
      groupId: 'critical',
      requestOptions: {
        reqData: { path: '/payments/charge' },
        resReq: true,
        // Individual override: even MORE attempts for payments
        attempts: 15
      }
    },
    
    // Analytics - failures are acceptable
    {
      id: 'track-event',
      groupId: 'analytics',
      requestOptions: {
        reqData: { path: '/analytics/track' },
        resReq: true
      }
    }
  ],
  {
    // Global defaults (lowest priority)
    commonRequestData: {
      hostname: 'api.example.com'
    },
    commonAttempts: 2,
    commonWait: 500,
    
    // Define groups with their own configs
    requestGroups: [
      {
        id: 'critical',
        commonConfig: {
          // Critical services: aggressive retries
          commonAttempts: 10,
          commonWait: 2000,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          
          commonHandleErrors: async ({ errorLog }) => {
            // Alert on critical failures
            await pagerDuty.alert('Critical service failure', errorLog);
          },
          
          commonResponseAnalyzer: async ({ data }) => {
            // Strict validation
            return data?.status === 'success' && !data?.errors;
          }
        }
      },
      {
        id: 'analytics',
        commonConfig: {
          // Analytics: minimal retries, don't throw on failure
          commonAttempts: 1,
          
          commonFinalErrorAnalyzer: async () => {
            return true;  // Suppress errors
          }
        }
      }
    ]
  }
);

// Analyze by group
const criticalOk = results
  .filter(r => r.groupId === 'critical')
  .every(r => r.success);

const analyticsCount = results
  .filter(r => r.groupId === 'analytics' && r.success)
  .length;

console.log('Critical services:', criticalOk ? 'HEALTHY' : 'DEGRADED');
console.log('Analytics events tracked:', analyticsCount);
```

### Example: Multi-Region Configuration

```typescript
const results = await stableApiGateway(
  [
    { id: 'us-data', groupId: 'us-east', requestOptions: { reqData: { path: '/data' }, resReq: true } },
    { id: 'eu-data', groupId: 'eu-west', requestOptions: { reqData: { path: '/data' }, resReq: true } },
    { id: 'ap-data', groupId: 'ap-southeast', requestOptions: { reqData: { path: '/data' }, resReq: true } }
  ],
  {
    commonAttempts: 3,
    
    requestGroups: [
      {
        id: 'us-east',
        commonConfig: {
          commonRequestData: {
            hostname: 'api-us.example.com',
            timeout: 5000,  // Low latency expected
            headers: { 'X-Region': 'us-east-1' }
          },
          commonAttempts: 3
        }
      },
      {
        id: 'eu-west',
        commonConfig: {
          commonRequestData: {
            hostname: 'api-eu.example.com',
            timeout: 8000,  // Medium latency
            headers: { 'X-Region': 'eu-west-1' }
          },
          commonAttempts: 5
        }
      },
      {
        id: 'ap-southeast',
        commonConfig: {
          commonRequestData: {
            hostname: 'api-ap.example.com',
            timeout: 12000,  // Higher latency expected
            headers: { 'X-Region': 'ap-southeast-1' }
          },
          commonAttempts: 7,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
        }
      }
    ]
  }
);
```

## Multi-Phase Workflows

For complex operations that require multiple stages of execution, use `stableWorkflow` to orchestrate phase-based workflows with full control over execution order and error handling.

### Basic Workflow

```typescript
import { stableWorkflow } from '@emmvish/stable-request';

const workflow = await stableWorkflow(
  [
    {
      id: 'validation',
      concurrentExecution: true,
      requests: [
        {
          id: 'check-inventory',
          requestOptions: {
            reqData: { path: '/inventory/check' },
            resReq: true
          }
        },
        {
          id: 'validate-payment',
          requestOptions: {
            reqData: { path: '/payment/validate' },
            resReq: true
          }
        }
      ]
    },
    {
      id: 'processing',
      concurrentExecution: false,
      stopOnFirstError: true,
      requests: [
        {
          id: 'charge-payment',
          requestOptions: {
            reqData: { path: '/payment/charge', method: REQUEST_METHODS.POST },
            resReq: true
          }
        },
        {
          id: 'reserve-inventory',
          requestOptions: {
            reqData: { path: '/inventory/reserve', method: REQUEST_METHODS.POST },
            resReq: true
          }
        }
      ]
    }
  ],
  {
    workflowId: 'order-processing-123',
    stopOnFirstPhaseError: true,
    logPhaseResults: true,
    commonRequestData: {
      hostname: 'api.example.com',
      headers: { 'X-Transaction-Id': 'txn-123' }
    },
    commonAttempts: 3,
    commonWait: 1000
  }
);

console.log('Workflow completed:', workflow.success);
console.log(`${workflow.successfulRequests}/${workflow.totalRequests} requests succeeded`);
console.log(`Completed in ${workflow.executionTime}ms`);
```

**Workflow Result:**
```typescript
interface STABLE_WORKFLOW_RESULT {
  workflowId: string;           // Workflow identifier
  success: boolean;             // Did all phases succeed?
  executionTime: number;        // Total workflow duration (ms)
  timestamp: string;            // ISO timestamp
  totalPhases: number;          // Number of phases defined
  completedPhases: number;      // Number of phases executed
  totalRequests: number;        // Total requests across all phases
  successfulRequests: number;   // Successful requests
  failedRequests: number;       // Failed requests
  phases: PHASE_RESULT[];       // Detailed results per phase
  error?: string;               // Workflow-level error (if any)
}
```

### Phase Configuration

Each phase can have its own execution mode and error handling:

```typescript
{
  id: 'phase-name',                    // Optional: phase identifier
  concurrentExecution?: boolean,       // true = parallel, false = sequential
  stopOnFirstError?: boolean,          // Stop phase on first request failure
  commonConfig?: { /* phase-level common config */ },
  requests: [/* array of requests */]
}
```

**Configuration Priority:**
Individual Request > Phase Common Config > Workflow Common Config

### Workflow with Request Groups

Combine workflows with request groups for fine-grained control:

```typescript
const workflow = await stableWorkflow(
  [
    {
      id: 'critical-validation',
      concurrentExecution: true,
      requests: [
        {
          id: 'auth-check',
          groupId: 'critical',
          requestOptions: {
            reqData: { path: '/auth/verify' },
            resReq: true
          }
        },
        {
          id: 'rate-limit-check',
          groupId: 'critical',
          requestOptions: {
            reqData: { path: '/ratelimit/check' },
            resReq: true
          }
        }
      ]
    },
    {
      id: 'data-processing',
      concurrentExecution: false,
      commonConfig: {
        // Phase-specific overrides
        commonAttempts: 5,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      },
      requests: [
        {
          id: 'process-data',
          groupId: 'standard',
          requestOptions: {
            reqData: { path: '/data/process', method: REQUEST_METHODS.POST },
            resReq: true
          }
        },
        {
          id: 'store-result',
          groupId: 'standard',
          requestOptions: {
            reqData: { path: '/data/store', method: REQUEST_METHODS.POST },
            resReq: true
          }
        }
      ]
    },
    {
      id: 'notifications',
      concurrentExecution: true,
      requests: [
        {
          id: 'email-notification',
          groupId: 'optional',
          requestOptions: {
            reqData: { path: '/notify/email' },
            resReq: true
          }
        },
        {
          id: 'webhook-notification',
          groupId: 'optional',
          requestOptions: {
            reqData: { path: '/notify/webhook' },
            resReq: true
          }
        }
      ]
    }
  ],
  {
    workflowId: 'data-pipeline-workflow',
    stopOnFirstPhaseError: true,
    logPhaseResults: true,
    
    commonRequestData: {
      hostname: 'api.example.com'
    },
    commonAttempts: 3,
    commonWait: 1000,
    
    // Request groups with different reliability requirements
    requestGroups: [
      {
        id: 'critical',
        commonConfig: {
          commonAttempts: 10,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          commonWait: 2000,
          commonHandleErrors: async ({ errorLog }) => {
            await alerting.critical('Critical service failure', errorLog);
          }
        }
      },
      {
        id: 'standard',
        commonConfig: {
          commonAttempts: 5,
          commonRetryStrategy: RETRY_STRATEGIES.LINEAR,
          commonWait: 1000
        }
      },
      {
        id: 'optional',
        commonConfig: {
          commonAttempts: 2,
          commonFinalErrorAnalyzer: async () => true  // Suppress errors
        }
      }
    ]
  }
);
```

### Phase Observability Hooks

Monitor workflow execution with phase-level hooks:

```typescript
const workflow = await stableWorkflow(
  [
    // ...phases...
  ],
  {
    workflowId: 'monitored-workflow',
    
    // Called after each phase completes successfully
    handlePhaseCompletion: async ({ workflowId, phaseResult }) => {
      console.log(`Phase ${phaseResult.phaseId} completed`);
      
      await analytics.track('workflow_phase_complete', {
        workflowId,
        phaseId: phaseResult.phaseId,
        duration: phaseResult.executionTime,
        successRate: phaseResult.successfulRequests / phaseResult.totalRequests
      });
    },
    
    // Called when a phase fails
    handlePhaseError: async ({ workflowId, phaseResult, error }) => {
      console.error(`Phase ${phaseResult.phaseId} failed`);
      
      await alerting.notify('workflow_phase_failed', {
        workflowId,
        phaseId: phaseResult.phaseId,
        error: error.message,
        failedRequests: phaseResult.failedRequests
      });
    },
    
    logPhaseResults: true  // Enable console logging
  }
);
```

## Real-World Examples

### 1. Polling for Job Completion

```typescript
const jobResult = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/jobs/abc123/status'
  },
  resReq: true,
  attempts: 20,             // Poll up to 20 times
  wait: 3000,               // Wait 3 seconds between polls
  retryStrategy: RETRY_STRATEGIES.FIXED,
  
  responseAnalyzer: async ({ data }) => {
    if (data.status === 'completed') {
      console.log('Job completed!');
      return true;  // Success
    }
    
    if (data.status === 'failed') {
      throw new Error(`Job failed: ${data.error}`);
    }
    
    console.log(`Job ${data.status}... ${data.progress}%`);
    return false;  // Keep polling
  },
  
  handleErrors: async ({ errorLog }) => {
    console.log(`Poll attempt ${errorLog.attempt}`);
  }
});

console.log('Final result:', jobResult);
```

### 2. Database Replication Lag

```typescript
const expectedVersion = 42;

const data = await stableRequest({
  reqData: {
    hostname: 'replica.db.example.com',
    path: '/records/123'
  },
  resReq: true,
  attempts: 10,
  wait: 500,
  retryStrategy: RETRY_STRATEGIES.LINEAR,
  
  hookParams: {
    responseAnalyzerParams: { expectedVersion }
  },
  
  responseAnalyzer: async ({ data, params }) => {
    // Wait until replica catches up
    if (data.version >= params.expectedVersion) {
      return true;
    }
    
    console.log(`Replica at version ${data.version}, waiting for ${params.expectedVersion}`);
    return false;
  }
});
```

### 3. Idempotent Payment Processing

```typescript
const paymentResult = await stableRequest({
  reqData: {
    hostname: 'api.stripe.com',
    path: '/v1/charges',
    method: REQUEST_METHODS.POST,
    headers: {
      'Authorization': 'Bearer sk_...',
      'Idempotency-Key': crypto.randomUUID()  // Ensure idempotency
    },
    body: {
      amount: 1000,
      currency: 'usd',
      source: 'tok_visa'
    }
  },
  resReq: true,
  attempts: 5,
  wait: 2000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  
  logAllErrors: true,
  logAllSuccessfulAttempts: true,
  
  handleErrors: async ({ errorLog }) => {
    await paymentLogger.error({
      attempt: errorLog.attempt,
      error: errorLog.error,
      isRetryable: errorLog.isRetryable
    });
  },
  
  responseAnalyzer: async ({ data }) => {
    // Validate payment succeeded
    return data.status === 'succeeded' && data.paid === true;
  },
  
  finalErrorAnalyzer: async ({ error }) => {
    // Alert team on payment failure
    await alerting.critical('Payment processing failed', error);
    return false;  // Throw error
  }
});
```

### 4. Batch User Creation with Error Handling

```typescript
const users = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
];

const requests = users.map((user, index) => ({
  id: `user-${index}`,
  requestOptions: {
    reqData: {
      body: user
    },
    resReq: true
  }
}));

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  
  commonRequestData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  
  commonAttempts: 3,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  commonResReq: true,
  commonLogAllErrors: true,
  
  commonHandleErrors: async ({ reqData, errorLog }) => {
    const user = reqData.data;
    console.error(`Failed to create user ${user.name}: ${errorLog.error}`);
  },
  
  commonResponseAnalyzer: async ({ data }) => {
    // Ensure user was created with an ID
    return data?.id && data?.email;
  }
});

const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`✓ Created ${successful.length} users`);
console.log(`✗ Failed to create ${failed.length} users`);

failed.forEach(r => {
  console.error(`  - ${r.requestId}: ${r.error}`);
});
```

### 5. Health Check Monitoring System

```typescript
const healthChecks = await stableApiGateway(
  [
    // Core services - must be healthy
    { id: 'auth', groupId: 'core', requestOptions: { reqData: { hostname: 'auth.internal', path: '/health' } } },
    { id: 'database', groupId: 'core', requestOptions: { reqData: { hostname: 'db.internal', path: '/health' } } },
    { id: 'api', groupId: 'core', requestOptions: { reqData: { hostname: 'api.internal', path: '/health' } } },
    
    // Optional services
    { id: 'cache', groupId: 'optional', requestOptions: { reqData: { hostname: 'cache.internal', path: '/health' } } },
    { id: 'search', groupId: 'optional', requestOptions: { reqData: { hostname: 'search.internal', path: '/health' } } }
  ],
  {
    commonResReq: true,
    concurrentExecution: true,
    
    requestGroups: [
      {
        id: 'core',
        commonConfig: {
          commonAttempts: 5,
          commonWait: 2000,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          
          commonResponseAnalyzer: async ({ data }) => {
            // Core services need strict validation
            return data?.status === 'healthy' && 
                   data?.uptime > 0 &&
                   data?.dependencies?.every(d => d.healthy);
          },
          
          commonHandleErrors: async ({ reqData, errorLog }) => {
            // Alert on core service issues
            await pagerDuty.trigger({
              severity: 'critical',
              service: reqData.baseURL,
              message: errorLog.error
            });
          }
        }
      },
      {
        id: 'optional',
        commonConfig: {
          commonAttempts: 2,
          
          commonResponseAnalyzer: async ({ data }) => {
            // Optional services: basic check
            return data?.status === 'ok';
          },
          
          commonFinalErrorAnalyzer: async ({ reqData, error }) => {
            // Log but don't alert
            console.warn(`Optional service ${reqData.baseURL} unhealthy`);
            return true;  // Don't throw
          }
        }
      }
    ]
  }
);

const report = {
  timestamp: new Date().toISOString(),
  core: healthChecks.filter(r => r.groupId === 'core').every(r => r.success),
  optional: healthChecks.filter(r => r.groupId === 'optional').every(r => r.success),
  overall: healthChecks.every(r => r.success) ? 'HEALTHY' : 'DEGRADED'
};

console.log('System Health:', report);
```

### 6. Data Pipeline (ETL Workflow)

```typescript
const etlWorkflow = await stableWorkflow(
  [
    {
      id: 'extract',
      concurrentExecution: true,
      commonConfig: {
        commonAttempts: 5,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      },
      requests: [
        { id: 'extract-users', requestOptions: { reqData: { path: '/extract/users' }, resReq: true } },
        { id: 'extract-orders', requestOptions: { reqData: { path: '/extract/orders' }, resReq: true } },
        { id: 'extract-products', requestOptions: { reqData: { path: '/extract/products' }, resReq: true } }
      ]
    },
    {
      id: 'transform',
      concurrentExecution: false,
      stopOnFirstError: true,
      requests: [
        {
          id: 'clean-data',
          requestOptions: {
            reqData: { path: '/transform/clean', method: REQUEST_METHODS.POST },
            resReq: true
          }
        },
        {
          id: 'enrich-data',
          requestOptions: {
            reqData: { path: '/transform/enrich', method: REQUEST_METHODS.POST },
            resReq: true
          }
        },
        {
          id: 'validate-data',
          requestOptions: {
            reqData: { path: '/transform/validate', method: REQUEST_METHODS.POST },
            resReq: true,
            responseAnalyzer: async ({ data }) => {
              return data?.validationErrors?.length === 0;
            }
          }
        }
      ]
    },
    {
      id: 'load',
      concurrentExecution: true,
      requests: [
        {
          id: 'load-warehouse',
          requestOptions: {
            reqData: { path: '/load/warehouse', method: REQUEST_METHODS.POST },
            resReq: true
          }
        },
        {
          id: 'update-indexes',
          requestOptions: {
            reqData: { path: '/load/indexes', method: REQUEST_METHODS.POST },
            resReq: true
          }
        },
        {
          id: 'refresh-cache',
          requestOptions: {
            reqData: { path: '/cache/refresh', method: REQUEST_METHODS.POST },
            resReq: true
          }
        }
      ]
    }
  ],
  {
    workflowId: `etl-${new Date().toISOString()}`,
    stopOnFirstPhaseError: true,
    logPhaseResults: true,
    
    commonRequestData: {
      hostname: 'pipeline.example.com'
    },
    commonAttempts: 3,
    commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
    
    handlePhaseCompletion: async ({ phaseResult }) => {
      const recordsProcessed = phaseResult.responses
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.data?.recordCount || 0), 0);
      
      await metrics.gauge('etl.phase.records', recordsProcessed, {
        phase: phaseResult.phaseId
      });
    },
    
    handlePhaseError: async ({ phaseResult, error }) => {
      await pagerDuty.alert('ETL Pipeline Phase Failed', {
        phase: phaseResult.phaseId,
        error: error.message,
        failedRequests: phaseResult.failedRequests
      });
    }
  }
);

console.log(`ETL Pipeline: ${etlWorkflow.success ? 'SUCCESS' : 'FAILED'}`);
console.log(`Total time: ${etlWorkflow.executionTime}ms`);
console.log(`Records processed: ${etlWorkflow.successfulRequests}/${etlWorkflow.totalRequests}`);
```

## Complete API Reference

### `stableRequest(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reqData` | `REQUEST_DATA` | **required** | Request configuration |
| `resReq` | `boolean` | `false` | Return response data vs. just boolean |
| `attempts` | `number` | `1` | Max retry attempts |
| `wait` | `number` | `1000` | Base delay between retries (ms) |
| `maxAllowedWait` | `number` | `60000` | Maximum permitted wait duration between retries (ms) |
| `retryStrategy` | `RETRY_STRATEGY_TYPES` | `'fixed'` | Retry backoff strategy |
| `performAllAttempts` | `boolean` | `false` | Execute all attempts regardless |
| `logAllErrors` | `boolean` | `false` | Enable error logging |
| `logAllSuccessfulAttempts` | `boolean` | `false` | Enable success logging |
| `maxSerializableChars` | `number` | `1000` | Max chars for logs |
| `trialMode` | `TRIAL_MODE_OPTIONS` | `{ enabled: false }` | Failure simulation |
| `hookParams` | `HookParams` | `{}` | Custom parameters for hooks |
| `responseAnalyzer` | `function` | `() => true` | Validate response content |
| `handleErrors` | `function` | `console.log` | Error handler |
| `handleSuccessfulAttemptData` | `function` | `console.log` | Success handler |
| `finalErrorAnalyzer` | `function` | `() => false` | Final error handler |

### REQUEST_DATA

```typescript
interface REQUEST_DATA<RequestDataType = any> {
  hostname: string;                    // Required
  protocol?: 'http' | 'https';         // Default: 'https'
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; // Default: 'GET'
  path?: `/${string}`;                 // Default: ''
  port?: number;                       // Default: 443
  headers?: Record<string, any>;       // Default: {}
  body?: RequestDataType;              // Request body
  query?: Record<string, any>;         // Query parameters
  timeout?: number;                    // Default: 15000ms
  signal?: AbortSignal;                // For cancellation
}
```

### `stableApiGateway(requests, options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrentExecution` | `boolean` | `true` | Execute requests concurrently or sequentially |
| `stopOnFirstError` | `boolean` | `false` | Stop execution on first error (sequential only) |
| `requestGroups` | `RequestGroup[]` | `[]` | Define groups with their own common configurations |
| `commonAttempts` | `number` | `1` | Default attempts for all requests |
| `commonPerformAllAttempts` | `boolean` | `false` | Default performAllAttempts for all requests |
| `commonWait` | `number` | `1000` | Default wait time for all requests |
| `commonMaxAllowedWait` | `number` | `60000` | Default maximum permitted wait time for all requests |
| `commonRetryStrategy` | `RETRY_STRATEGY_TYPES` | `'fixed'` | Default retry strategy for all requests |
| `commonLogAllErrors` | `boolean` | `false` | Default error logging for all requests |
| `commonLogAllSuccessfulAttempts` | `boolean` | `false` | Default success logging for all requests |
| `commonMaxSerializableChars` | `number` | `1000` | Default max chars for serialization |
| `commonTrialMode` | `TRIAL_MODE_OPTIONS` | `{ enabled: false }` | Default trial mode for all requests |
| `commonResponseAnalyzer` | `function` | `() => true` | Default response analyzer for all requests |
| `commonResReq` | `boolean` | `false` | Default resReq for all requests |
| `commonFinalErrorAnalyzer` | `function` | `() => false` | Default final error analyzer for all requests |
| `commonHandleErrors` | `function` | console.log | Default error handler for all requests |
| `commonHandleSuccessfulAttemptData` | `function` | console.log | Default success handler for all requests |
| `commonRequestData` | `Partial<REQUEST_DATA>` | `{ hostname: '' }` | Common set of request options for each request |
| `commonHookParams` | `HookParams` | `{ }` | Common options for each request hook |

### `stableWorkflow(phases, options)`

Execute a multi-phase workflow with full control over execution order and error handling.

**Phases Array:**
```typescript
interface STABLE_WORKFLOW_PHASE {
  id?: string;                     // Phase identifier (auto-generated if omitted)
  concurrentExecution?: boolean;   // true = parallel, false = sequential (default: true)
  stopOnFirstError?: boolean;      // Stop phase on first request failure (default: false)
  commonConfig?: Omit<API_GATEWAY_OPTIONS, 'concurrentExecution' | 'stopOnFirstError' | 'requestGroups'>;
  requests: API_GATEWAY_REQUEST[]; // Array of requests for this phase
}
```

**Workflow Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workflowId` | `string` | `workflow-{timestamp}` | Workflow identifier |
| `stopOnFirstPhaseError` | `boolean` | `false` | Stop workflow if any phase fails |
| `logPhaseResults` | `boolean` | `false` | Log phase execution to console |
| `handlePhaseCompletion` | `function` | `undefined` | Hook called after each successful phase |
| `handlePhaseError` | `function` | `undefined` | Hook called when a phase fails |
| `maxSerializableChars` | `number` | `1000` | Max chars for serialization in hooks |
| `workflowHookParams` | `WorkflowHookParams` | {} | Custom set of params passed to hooks |
| All `stableApiGateway` options | - | - | Applied as workflow-level defaults |

**STABLE_WORKFLOW_RESULT response:**
```typescript
interface STABLE_WORKFLOW_RESULT {
  workflowId: string;
  success: boolean;             // All phases successful?
  executionTime: number;        // Total workflow duration (ms)
  timestamp: string;            // ISO timestamp
  totalPhases: number;
  completedPhases: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  phases: PHASE_RESULT[];      // Detailed results per phase
  error?: string;              // Workflow-level error
}
```

### Hooks Reference

#### responseAnalyzer

**Purpose:** Validate response content, retry even on HTTP 200

```typescript
responseAnalyzer: async ({ reqData, data, trialMode, params }) => {
  // Return true if valid, false to retry
  return data.status === 'ready';
}
```

#### handleErrors

**Purpose:** Monitor and log failed attempts

```typescript
handleErrors: async ({ reqData, errorLog, maxSerializableChars }) => {
  await logger.error({
    url: reqData.url,
    attempt: errorLog.attempt,
    error: errorLog.error
  });
}
```

#### handleSuccessfulAttemptData

**Purpose:** Monitor and log successful attempts

```typescript
handleSuccessfulAttemptData: async ({ reqData, successfulAttemptData, maxSerializableChars }) => {
  await analytics.track({
    url: reqData.url,
    duration: successfulAttemptData.executionTime
  });
}
```

#### finalErrorAnalyzer

**Purpose:** Handle final error after all retries exhausted

```typescript
finalErrorAnalyzer: async ({ reqData, error, trialMode, params }) => {
  // Return true to suppress error (return false)
  // Return false to throw error
  if (error.message.includes('404')) {
    return true;  // Treat as non-critical
  }
  return false;  // Throw
}
```

#### handlePhaseCompletion

**Purpose:** Execute phase-bridging code upon successful completion of a phase

```typescript
handlePhaseCompletion: async ({ workflowId, phaseResult, maxSerializableChars, params }) => {
  await logger.log(phaseResult.phaseId, phaseResult.success);
  // phaseResult includes:
  // - phaseId, phaseIndex
  // - success, executionTime, timestamp
  // - totalRequests, successfulRequests, failedRequests
  // - responses array
}
```

#### handlePhaseError

**Purpose:** Execute error handling code if a phase runs into an error

```typescript
handlePhaseError: async ({ workflowId, phaseResult, error, maxSerializableChars, params }) => {
  await logger.error(error);
  // Similar to handlePhaseCompletion, plus:
  // - error: the error object
}
```

## Configuration Hierarchy

1. **Workflow-level** (lowest priority): Applied to all phases
2. **Phase-level**: Overrides workflow-level
3. **Request Group**: Overrides phase-level
4. **Individual Request** (highest priority): Overrides everything

## TypeScript Support

Fully typed with generics:

```typescript
interface CreateUserRequest {
  name: string;
  email: string;
}

interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

const user = await stableRequest<CreateUserRequest, UserResponse>({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST,
    body: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  },
  resReq: true
});

// user is typed as UserResponse
console.log(user.id);  // TypeScript knows this exists
```

## Best Practices

1. **Start simple** - Use basic retries first, add hooks as needed
2. **Use exponential backoff** for rate-limited APIs
3. **Validate response content** with `responseAnalyzer` for eventually-consistent systems
4. **Monitor everything** with `handleErrors` and `handleSuccessfulAttemptData`
5. **Group related requests** by service tier, region, or priority
6. **Handle failures gracefully** with `finalErrorAnalyzer` for non-critical features
7. **Test with trial mode** before deploying to production
8. **Set appropriate timeouts** to prevent hanging requests
9. **Use idempotency keys** for payment/financial operations
10. **Log contextual information** in your hooks for debugging
11. **Design workflows with clear phases** - Each phase should represent a logical stage
12. **Use phase hooks** (`handlePhaseCompletion`, `handlePhaseError`) for workflow observability
13. **Set `stopOnFirstPhaseError: true`** for critical workflows that shouldn't continue after failure
14. **Use mixed execution modes** - Concurrent for independent operations, sequential for dependencies
15. **Leverage request groups in workflows** for different reliability tiers within phases

## License

MIT © Manish Varma


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**Made with ❤️ for developers integrating with unreliable APIs**
