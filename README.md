# stable-request

**stable-request** is a TypeScript-first **HTTP workflow execution engine** for real-world distributed systems — where HTTP `200 OK` does **not** guarantee business success, and HTTP failures still deserve **structured, actionable responses**.

It ensures that **every request attempt**, whether it succeeds or fails, can be:

- Observed
- Analyzed
- Retried intelligently
- Suppressed when non-critical
- Escalated when business-critical

All without crashing your application or hiding context behind opaque errors.

**stable-request treats failures as data.**

> If you’ve ever logged `error.message` and thought  
> **“This tells me absolutely nothing”** — this library is for you.

In addition, it enables **content-aware retries**, **hierarchical configuration**, **batch orchestration**, and **multi-phase workflows** with deep observability — all built on top of standard HTTP calls.

All in all, it provides you with the **entire ecosystem** to build **API-integrations based workflows** with **complete flexibility**.

---

## 📚 Table of Contents
<!-- TOC START -->
- [Why stable-request exists](#why-stable-request-exists)
- [What stable-request gives you](#what-stable-request-gives-you)
  - [Core capabilities](#core-capabilities)
  - [Scaling beyond single requests](#scaling-beyond-single-requests)
  - [Full workflow orchestration](#full-workflow-orchestration)
- [How stable-request is different](#how-stable-request-is-different)
- [Choose your entry point](#choose-your-entry-point)
- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Basic Request (No Retries)](#1-basic-request-no-retries)
  - [Add Simple Retries](#2-add-simple-retries)
  - [Validate Response Content](#3-validate-response-content-content-aware-retries)
  - [Monitor Errors](#4-monitor-errors-observability)
  - [Monitor Successful Attempts](#5-monitor-successful-attempts)
  - [Handle Final Errors Gracefully](#6-handle-final-errors-gracefully)
  - [Pass Custom Parameters to Hooks](#7-pass-custom-parameters-to-hooks)
  - [Pre-Execution Hook](#8-pre-execution-hook-dynamic-configuration)
- [Intermediate Concepts](#intermediate-concepts)
  - [Making POST/PUT/PATCH/DELETE Requests](#making-postputpatchdelete-requests)
  - [Query Parameters](#query-parameters)
  - [Custom Timeout and Port](#custom-timeout-and-port)
  - [Request Cancellation](#request-cancellation)
  - [Trial Mode](#trial-mode-testing-your-retry-logic)
- [Batch Processing - Multiple Requests](#batch-processing---multiple-requests)
  - [Basic Batch Request](#basic-batch-request)
  - [Sequential Execution (With Dependencies)](#sequential-execution-with-dependencies)
  - [Shared Configuration (Common Options)](#shared-configuration-common-options)
- [Advanced: Request Grouping](#advanced-request-grouping)
  - [Service Tiers](#example-service-tiers)
  - [Multi-Region Configuration](#example-multi-region-configuration)
  - [Shared Buffer Across Requests](#example-shared-buffer-is-common-across-the-entire-batch-of-requests)
- [Multi-Phase Workflows](#multi-phase-workflows)
  - [Basic Workflow](#basic-workflow)
  - [Phase Configuration](#phase-configuration)
  - [Workflow with Request Groups](#workflow-with-request-groups)
  - [Phase Observability Hooks](#phase-observability-hooks)
  - [Concurrent Execution of Phases](#concurrent-execution-of-phases)
- [Real-World Examples](#real-world-examples)
  - [Polling for Job Completion](#1-polling-for-job-completion)
  - [Database Replication Lag](#2-database-replication-lag)
  - [Idempotent Payment Processing](#3-idempotent-payment-processing)
  - [Batch User Creation](#4-batch-user-creation-with-error-handling)
  - [Health Check Monitoring System](#5-health-check-monitoring-system)
  - [Data Pipeline (ETL Workflow)](#6-data-pipeline-etl-workflow)
- [Complete API Reference](#complete-api-reference)
  - [`stableRequest`](#stablerequestoptions)
  - [`stableApiGateway`](#stableapigatewayrequests-options)
  - [`stableWorkflow`](#stableworkflowphases-options)
- [Hooks Reference](#hooks-reference)
  - [`preExecutionHook`](#preexecutionhook)
  - [`responseAnalyzer`](#responseanalyzer)
  - [`handleErrors`](#handleerrors)
  - [`handleSuccessfulAttemptData`](#handlesuccessfulattemptdata)
  - [`finalErrorAnalyzer`](#finalerroranalyzer)
  - [`handlePhaseCompletion`](#handlephasecompletion)
  - [`handlePhaseError`](#handlephaseerror)
- [Configuration Hierarchy](#configuration-hierarchy)
- [TypeScript Support](#typescript-support)
- [License](#license)
<!-- TOC END -->

---

## Why stable-request exists

Modern systems fail in subtle and dangerous ways:

- APIs return `200` but the resource isn’t ready
- Databases are eventually consistent
- Downstream services partially fail
- Some requests are critical, others are optional
- Blind retries amplify failures
- Workflows fail midway and leave systems inconsistent

Most HTTP clients answer only one question:

> “Did the request fail at the network or HTTP layer?”

**stable-request answers a different one:**

> “Is the system state actually correct yet?”

---

## What stable-request gives you

### Core capabilities

✅ **Content-aware retries**  
  
  Retry based on response validation, not just status codes

🔄 **Deterministic execution semantics**  
  
  Fixed, linear, or exponential retry strategies with hard limits

🧠 **Graceful failure handling**  
  
  Suppress non-critical failures without crashing workflows

🧪 **Trial mode / chaos testing**  
  
  Simulate failures without depending on real outages

📊 **First-class observability hooks**  
  
  Inspect every failed and successful attempt

---

### Scaling beyond single requests

🚀 **Batch execution with shared state (`stableApiGateway`)**  
  
  Run many requests concurrently or sequentially with shared configuration and shared state

🎯 **Request groups**  
  
  Apply different reliability rules to critical, standard, and optional services

🧱 **Hierarchical configuration**  
  
  Workflow → Phase → Group → Request (predictable overrides)

---

### Full workflow orchestration

🧩 **Multi-phase workflows with shared state (`stableWorkflow`)**
  
  Model real-world business flows as deterministic, observable execution graphs.

🔀 **Mix concurrent and sequential execution**
  
  Parallelize where safe, serialize where correctness matters.

🛑 **Stop early or degrade gracefully**
  
  Stop execution early or continue based on business criticality.

📈 **Phase-level metrics and hooks**
  
  Track execution time, success rates, and failure boundaries per phase.

🧭 **Deterministic, observable execution paths**
  
  Every decision is explicit, traceable, and reproducible.

---

## How stable-request is different

| Traditional HTTP Clients | stable-request |
|--------------------------|---------------|
| Status-code based retries | Content-aware retries |
| Per-request thinking | System-level thinking |
| Fire-and-forget | Deterministic workflows |
| Best-effort retries | Business-aware execution |
| Little observability | Deep, structured hooks |

---

## Choose your entry point

| Need | Use |
|-----|-----|
| Reliable single API call | `stableRequest` |
| Batch or fan-out requests | `stableApiGateway` |
| Multi-step orchestration | `stableWorkflow` |

Start small and scale **without changing mental models**.

---

## Installation

```bash
npm install @emmvish/stable-request
```

## Quick Start

### 1. Basic Request (No Retries)

```typescript
import { stableRequest, REQUEST_METHODS } from '@emmvish/stable-request';

interface PatchRequestBodyParams {
  id: number;
  updates: {
    name?: string;
    age?: number;
  }
}

interface ResponseParams {
  id: number;
  name: string;
  age: number;
}

const getStableResponse = async () => {

  const token = 'my-auth-token';

  const data = await stableRequest<PatchRequestBodyParams, ResponseParams>({
    reqData: {
      method: REQUEST_METHODS.PATCH,
      hostname: 'api.example.com',
      path: '/users',
      headers: { Authorization: `Bearer ${token}` },
      body: { id: 123, updates: { age: 27 } }
    },
    resReq: true  // Return the response data
  });
  
  console.log(data); // { id: 123, name: 'MV', age: 27 }
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
  responseAnalyzer: async ({ reqData, data, trialMode, params, commonBuffer }) => {
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
  commonBuffer: Record<string, any> // For communication between request hooks
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
  handleErrors: async ({ reqData, errorLog, maxSerializableChars, commonBuffer }) => {
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
  commonBuffer: Record<string, any> // For communication between request hooks
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
  commonBuffer: Record<string, any> // For communication between request hooks
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
  commonBuffer: Record<string, any> // For communication between request hooks
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

### 8. Pre-Execution Hook (Dynamic Configuration)

Use `preExecution` to modify request configuration dynamically before execution:

```typescript
const outputBuffer: Record<string, any> = {};

const data = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/protected-resource'
  },
  resReq: true,
  attempts: 3,
  
  preExecution: {
    // Hook executed before any request attempts
    preExecutionHook: async ({ inputParams, commonBuffer }) => {
      const token = await authService.getToken(inputParams.userId);
      commonBuffer.token = token;
      commonBuffer.fetchedAt = new Date().toISOString();
      // Return configuration overrides
      return {
        reqData: {
          hostname: 'api.example.com',
          path: '/protected-resource',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        },
        attempts: 5
      };
    },
    preExecutionHookParams: {
      userId: 'user-123',
      environment: 'production'
    },
    applyPreExecutionConfigOverride: true,
    continueOnPreExecutionHookFailure: false
  },
  commonBuffer: outputBuffer
});

console.log('Token used:', outputBuffer.token);
console.log('Fetched at:', outputBuffer.fetchedAt);
```

**Pre-Execution Options:**

```typescript
interface PreExecutionOptions {
  preExecutionHook: (options: {
    inputParams: any;        // Custom parameters you provide
  }) => any | Promise<any>;  // Returns config overrides
  preExecutionHookParams?: any;              // Custom input parameters
  applyPreExecutionConfigOverride?: boolean;  // Apply returned overrides (default: false)
  continueOnPreExecutionHookFailure?: boolean; // Continue if hook fails (default: false)
}
```

## Intermediate Concepts

### Making POST/PUT/PATCH/DELETE Requests

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

### Example: Shared Buffer is common across the entire batch of requests

```typescript
const sharedBuffer: Record<string, any> = {};

const requests = [
  {
    id: 'a',
    requestOptions: {
      reqData: { path: '/a' },
      resReq: true,
      preExecution: {
        preExecutionHook: ({ commonBuffer }: any) => {
          commonBuffer.fromA = true;
          return {};
        },
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: false,
        continueOnPreExecutionHookFailure: false
      }
    }
  },
  {
    id: 'b',
    requestOptions: {
      reqData: { path: '/b' },
      resReq: true,
      preExecution: {
        preExecutionHook: ({ commonBuffer }: any) => {
          commonBuffer.fromB = true;
          return {};
        },
        preExecutionHookParams: {},
        applyPreExecutionConfigOverride: false,
        continueOnPreExecutionHookFailure: false
      }
    }
  }
] satisfies API_GATEWAY_REQUEST[];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonRequestData: { hostname: 'api.example.com' },
  sharedBuffer
});

console.log(sharedBuffer); // { fromA: true, fromB: true }
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

Each phase can have its own execution mode and error handling, and can also work upon the shared buffer:

```typescript
{
  id: 'phase-name',                    // Optional: phase identifier
  concurrentExecution?: boolean,       // true = parallel, false = sequential
  stopOnFirstError?: boolean,          // Stop phase on first request failure
  commonConfig?: { /* phase-level common config */ },
  requests: [/* array of requests */],
  sharedBuffer?: Record<string, any> // State to be shared among all requests in the phase
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
    handlePhaseCompletion: async ({ workflowId, phaseResult, sharedBuffer }) => {
      console.log(`Phase ${phaseResult.phaseId} completed`);
      
      await analytics.track('workflow_phase_complete', {
        workflowId,
        phaseId: phaseResult.phaseId,
        duration: phaseResult.executionTime,
        successRate: phaseResult.successfulRequests / phaseResult.totalRequests
      });
    },
    
    // Called when a phase fails
    handlePhaseError: async ({ workflowId, phaseResult, error, sharedBuffer }) => {
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

### Phase Observability Hooks

Workflow Buffer is shared by all phases and by extension, all requests contained in every phase of the workflow :

```typescript
const workflowBuffer: Record<string, any> = {};

const phases = [
  {
    id: 'p1',
    concurrentExecution: false,
    requests: [
      {
        id: 'r1',
        requestOptions: {
          reqData: { path: '/p1' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }: any) => {
              commonBuffer.token = 'wf-token';
              commonBuffer.setIn = 'p1';
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
    id: 'p2',
    concurrentExecution: false,
    requests: [
      {
        id: 'r2',
        requestOptions: {
          reqData: { path: '/p2' },
          resReq: true,
          preExecution: {
            preExecutionHook: ({ commonBuffer }: any) => {
              commonBuffer.usedIn = 'p2';
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
] satisfies STABLE_WORKFLOW_PHASE[];

const result = await stableWorkflow(phases, {
  workflowId: 'wf-buffer-demo',
  commonRequestData: { hostname: 'api.example.com' },
  sharedBuffer: workflowBuffer
});

console.log(workflowBuffer); // { token: 'wf-token' setIn: 'p1', usedIn: 'p2' }
```
### Concurrent Execution of Phases

```typescript
const phases = [
  {
    id: 'phase-1',
    requests: [
      { id: 'r1', requestOptions: { reqData: { path: '/p1/r1' }, resReq: true } }
    ]
  },
  {
    id: 'phase-2',
    requests: [
      { id: 'r2', requestOptions: { reqData: { path: '/p2/r1' }, resReq: true } }
    ]
  },
  {
    id: 'phase-3',
    requests: [
      { id: 'r3', requestOptions: { reqData: { path: '/p3/r1' }, resReq: true } }
    ]
  }
] satisfies STABLE_WORKFLOW_PHASE[];

const result = await stableWorkflow(phases, {
  workflowId: 'wf-concurrent-phases',
  commonRequestData: { hostname: 'api.example.com' },
  commonAttempts: 1,
  commonWait: 1,
  concurrentPhaseExecution: true
});
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
| `preExecution` | `RequestPreExecutionOptions` | `{}` | Executes before actually sending request, can modify request config |
| `commonBuffer` | `Record<string, any>` | `{}` | For communication between various request hooks |
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
| `sharedBuffer` | `Record<string, any>` | `undefined` | For communication between various requests |

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
  sharedBuffer: Record<string, any> // Shared buffer for API Gateway requests
}
```

**Workflow Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workflowId` | `string` | `workflow-{timestamp}` | Workflow identifier |
| `stopOnFirstPhaseError` | `boolean` | `false` | Stop workflow if any phase fails |
| `logPhaseResults` | `boolean` | `false` | Log phase execution to console |
| `concurrentPhaseExecution` | `boolean` | `false` | Execute all phases in parallel |
| `handlePhaseCompletion` | `function` | `undefined` | Hook called after each successful phase |
| `handlePhaseError` | `function` | `undefined` | Hook called when a phase fails |
| `maxSerializableChars` | `number` | `1000` | Max chars for serialization in hooks |
| `workflowHookParams` | `WorkflowHookParams` | {} | Custom set of params passed to hooks |
| `sharedBuffer` | `Record<string, any>` | `undefined` | Buffer shared by all phases and all requests within them |
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

#### preExecutionHook

**Purpose:** Dynamically configure request before execution

```typescript
preExecution: {
  preExecutionHook: async ({ inputParams, commonBuffer }) => {
    // Fetch dynamic data
    const token = await getAuthToken();
    
    // Store in common buffer
    commonBuffer.token = token;
    commonBuffer.timestamp = Date.now();
    
    // Return config overrides
    return {
      reqData: {
        headers: { 'Authorization': `Bearer ${token}` }
      },
      attempts: 5
    };
  },
  preExecutionHookParams: { userId: 'user-123' },
  applyPreExecutionConfigOverride: true,
  continueOnPreExecutionHookFailure: false
}
```

#### responseAnalyzer

**Purpose:** Validate response content, retry even on HTTP 200

```typescript
responseAnalyzer: async ({ reqData, data, trialMode, params, commonBuffer }) => {
  // Return true if valid, false to retry
  return data.status === 'ready';
}
```

#### handleErrors

**Purpose:** Monitor and log failed attempts

```typescript
handleErrors: async ({ reqData, errorLog, maxSerializableChars, params, commonBuffer }) => {
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
handleSuccessfulAttemptData: async ({ reqData, successfulAttemptData, maxSerializableChars, params, commonBuffer }) => {
  await analytics.track({
    url: reqData.url,
    duration: successfulAttemptData.executionTime
  });
}
```

#### finalErrorAnalyzer

**Purpose:** Handle final error after all retries exhausted

```typescript
finalErrorAnalyzer: async ({ reqData, error, trialMode, params, commonBuffer }) => {
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
handlePhaseCompletion: async ({ workflowId, phaseResult, maxSerializableChars, params, sharedBuffer }) => {
  await logger.log(phaseResult.phaseId, phaseResult.success);
}
```

#### handlePhaseError

**Purpose:** Execute error handling code if a phase runs into an error

```typescript
handlePhaseError: async ({ workflowId, phaseResult, error, maxSerializableChars, params, sharedBuffer }) => {
  await logger.error(error);
}
```

## Configuration Hierarchy

Configuration precedence across orchestration:

- Workflow-level (options.sharedBuffer)
- Phase-level (commonConfig)
- Request group (requestGroups[].commonConfig)
- Individual request options (highest priority)

Buffers are state (not config):

- Request scope: commonBuffer
- Gateway scope: Gateway's / Phase's sharedBuffer
- Workflow scope: Workflow's sharedBuffer

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

## License

MIT © Manish Varma


[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**Made with ❤️ for developers integrating with unreliable APIs**
