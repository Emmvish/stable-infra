## stable-request

`stable-request` is a TypeScript-first HTTP reliability framework that goes beyond status-code retries by validating response content, handling eventual consistency, coordinating batch workflows with intelligent grouping, and providing deep observability into every request attempt. It is designed for real-world distributed systems where HTTP success does not guarantee business success.

## Why stable-request?

Most HTTP client libraries only retry on network failures or specific HTTP status codes. **stable-request** goes further by providing:

- ✅ **Content-aware retries** - Validate response content and retry even on successful HTTP responses
- 🚀 **Batch processing with groups** - Execute multiple requests with hierarchical configuration (global → group → request)
- 🎯 **Request grouping** - Organize related requests with shared settings and logical boundaries
- 🧪 **Trial mode** - Simulate failures to test your retry logic without depending on real network instability
- 📊 **Granular observability** - Monitor every attempt with detailed hooks
- ⚡ **Multiple retry strategies** - Fixed, linear, or exponential backoff
- 🔧 **Flexible error handling** - Custom error analysis and graceful degradation

## Installation

```bash
npm install @emmvish/stable-request
```

## Quick Start

### Single Request

```typescript
import { stableRequest, REQUEST_METHODS, RETRY_STRATEGIES } from '@emmvish/stable-request';

// Simple GET request with automatic retries
const response = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.GET
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

### Batch Requests

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
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonAttempts: 3,
  commonWait: 1000,
  commonRequestData: { hostname: 'api.example.com' }
});
```

### Grouped Requests

```typescript
import { stableApiGateway, RETRY_STRATEGIES } from '@emmvish/stable-request';

const results = await stableApiGateway(
  [
    {
      id: 'auth-check',
      groupId: 'critical-services',
      requestOptions: {
        reqData: { path: '/auth/verify' },
        resReq: true
      }
    },
    {
      id: 'analytics-track',
      groupId: 'optional-services',
      requestOptions: {
        reqData: { path: '/analytics/event' },
        resReq: true
      }
    }
  ],
  {
    // Global defaults
    commonAttempts: 2,
    commonRequestData: { hostname: 'api.example.com' },
    
    // Define groups with their own configurations
    requestGroups: [
      {
        id: 'critical-services',
        commonConfig: {
          commonAttempts: 10,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
        }
      },
      {
        id: 'optional-services',
        commonConfig: {
          commonAttempts: 1,
          commonFinalErrorAnalyzer: async () => true // Don't throw on failure
        }
      }
    ]
  }
);
```

## Core Features

### 1. Content-Aware Retries with `stableRequest`

Unlike traditional retry mechanisms, `stableRequest` validates the **content** of successful responses and retries if needed.

```typescript
await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data',
  },
  resReq: true,
  attempts: 5,
  wait: 2000,
  // Retry even on HTTP 200 if data is invalid
  responseAnalyzer: async (reqConfig, data) => {
    return data?.status === 'ready' && data?.items?.length > 0;
  }
});
```

**Use Cases:**
- Wait for async processing to complete
- Ensure data quality before proceeding
- Handle eventually-consistent systems
- Validate complex business rules in responses

### 2. Batch Processing with `stableApiGateway`

Process multiple requests efficiently with shared configuration and execution strategies.

#### Concurrent Execution

```typescript
import { stableApiGateway, RETRY_STRATEGIES, REQUEST_METHODS } from '@emmvish/stable-request';

const requests = [
  {
    id: 'create-user-1',
    requestOptions: {
      reqData: {
        body: { name: 'John Doe', email: 'john@example.com' }
      }
    }
  },
  {
    id: 'create-user-2',
    requestOptions: {
      reqData: {
        body: { name: 'Jane Smith', email: 'jane@example.com' }
      }
    }
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonRequestData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST
  },
  commonResReq: true,
  commonAttempts: 3,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
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

#### Sequential Execution

```typescript
const results = await stableApiGateway(requests, {
  concurrentExecution: false,
  stopOnFirstError: true,
  commonAttempts: 3
});
```

### 3. Request Grouping - Hierarchical Configuration

Organize requests into logical groups with their own configuration. The configuration priority is:

**Individual Request Options** (highest) → **Group Common Options** (middle) → **Global Common Options** (lowest)

```typescript
const results = await stableApiGateway(
  [
    {
      id: 'payment-stripe',
      groupId: 'payment-providers',
      requestOptions: {
        reqData: { path: '/stripe/charge' },
        resReq: true,
        // Individual override: even more attempts for Stripe
        attempts: 15
      }
    },
    {
      id: 'payment-paypal',
      groupId: 'payment-providers',
      requestOptions: {
        reqData: { path: '/paypal/charge' },
        resReq: true
      }
    },
    {
      id: 'analytics-event',
      groupId: 'analytics',
      requestOptions: {
        reqData: { path: '/track' },
        resReq: true
      }
    }
  ],
  {
    // Global configuration - applies to all ungrouped requests
    commonAttempts: 2,
    commonWait: 500,
    commonRequestData: {
      hostname: 'api.example.com',
      method: REQUEST_METHODS.POST
    },
    
    // Group-specific configurations
    requestGroups: [
      {
        id: 'payment-providers',
        commonConfig: {
          // Payment group: aggressive retries
          commonAttempts: 10,
          commonWait: 2000,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          commonRequestData: {
            headers: { 'X-Idempotency-Key': crypto.randomUUID() }
          },
          commonHandleErrors: async (reqData, error) => {
            await alertPagerDuty('Payment failure', error);
          }
        }
      },
      {
        id: 'analytics',
        commonConfig: {
          // Analytics group: minimal retries, failures acceptable
          commonAttempts: 1,
          commonFinalErrorAnalyzer: async () => true // Don't throw
        }
      }
    ]
  }
);

// Filter results by group
const paymentResults = results.filter(r => r.groupId === 'payment-providers');
const analyticsResults = results.filter(r => r.groupId === 'analytics');

console.log('Payment success rate:', 
  paymentResults.filter(r => r.success).length / paymentResults.length);
```

**Key Benefits of Request Grouping:**

1. **Service Tiering** - Different retry strategies for critical vs. optional services
2. **Regional Configuration** - Customize timeouts and retries per geographic region
3. **Priority Management** - Handle high-priority requests more aggressively
4. **Organized Configuration** - Group related requests with shared settings
5. **Simplified Maintenance** - Update group config instead of individual requests
6. **Better Monitoring** - Track metrics and failures by logical groups

### 4. Trial Mode - Test Your Retry Logic

Simulate request and retry failures with configurable probabilities.

```typescript
await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/test',
  },
  resReq: true,
  attempts: 5,
  trialMode: {
    enabled: true,
    reqFailureProbability: 0.3,    // 30% chance each request fails
    retryFailureProbability: 0.2    // 20% chance retry is marked non-retryable
  },
  logAllErrors: true
});
```

**Use Cases:**
- Integration testing
- Chaos engineering
- Validating monitoring and alerting
- Testing circuit breaker patterns

### 5. Multiple Retry Strategies

Choose the backoff strategy that fits your use case.

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@emmvish/stable-request';

// Fixed delay: 1s, 1s, 1s, 1s...
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 5,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.FIXED
});

// Linear backoff: 1s, 2s, 3s, 4s...
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 5,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.LINEAR
});

// Exponential backoff: 1s, 2s, 4s, 8s...
await stableRequest({
  reqData: { hostname: 'api.example.com', path: '/data' },
  resReq: true,
  attempts: 5,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

### 6. Comprehensive Observability

Monitor every request attempt with detailed logging hooks.

```typescript
await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/critical-endpoint',
  },
  resReq: true,
  attempts: 3,
  logAllErrors: true,
  handleErrors: async (reqConfig, errorLog) => {
    // Custom error handling - send to monitoring service
    await monitoringService.logError({
      endpoint: reqConfig.url,
      attempt: errorLog.attempt,
      error: errorLog.error,
      isRetryable: errorLog.isRetryable,
      type: errorLog.type, // 'HTTP_ERROR' or 'INVALID_CONTENT'
      timestamp: errorLog.timestamp,
      executionTime: errorLog.executionTime,
      statusCode: errorLog.statusCode
    });
  },
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: async (reqConfig, successData) => {
    // Track successful attempts
    analytics.track('request_success', {
      endpoint: reqConfig.url,
      attempt: successData.attempt,
      executionTime: successData.executionTime,
      statusCode: successData.statusCode
    });
  }
});
```

### 7. Smart Retry Logic

Automatically retries on common transient errors:

- HTTP 5xx (Server Errors)
- HTTP 408 (Request Timeout)
- HTTP 429 (Too Many Requests)
- HTTP 409 (Conflict)
- Network errors: `ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`

```typescript
await stableRequest({
  reqData: {
    hostname: 'unreliable-api.com',
    path: '/data',
  },
  resReq: true,
  attempts: 5,
  wait: 2000,
  retryStrategy: RETRY_STRATEGIES.LINEAR
  // Automatically retries on transient failures
});
```

### 8. Final Error Analysis

Decide whether to throw or return false based on error analysis.

```typescript
const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/optional-data',
  },
  resReq: true,
  attempts: 3,
  finalErrorAnalyzer: async (reqConfig, error) => {
    // Return true to suppress error and return false instead of throwing
    if (error.message.includes('404')) {
      console.log('Resource not found, treating as non-critical');
      return true; // Don't throw, return false
    }
    return false; // Throw the error
  }
});

// result will be false if finalErrorAnalyzer returned true
if (result === false) {
  console.log('Request failed but was handled gracefully');
}
```

### 9. Request Cancellation Support

Support for AbortController to cancel requests.

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000);

try {
  await stableRequest({
    reqData: {
      hostname: 'api.example.com',
      path: '/slow-endpoint',
      signal: controller.signal
    },
    resReq: true,
    attempts: 3
  });
} catch (error) {
  // Request was cancelled
}
```

### 10. Perform All Attempts Mode

Execute all retry attempts regardless of success, useful for warm-up scenarios.

```typescript
await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/cache-warmup',
  },
  attempts: 5,
  performAllAttempts: true, // Always performs all 5 attempts
  wait: 1000
});
```

## API Reference

### `stableRequest<RequestDataType, ResponseDataType>(options)`

Execute a single HTTP request with retry logic.

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `reqData` | `REQUEST_DATA` | **required** | Request configuration (hostname, path, method, etc.) |
| `resReq` | `boolean` | `false` | Return response data instead of just success boolean |
| `attempts` | `number` | `1` | Maximum number of retry attempts |
| `wait` | `number` | `1000` | Base delay in milliseconds between retries |
| `retryStrategy` | `RETRY_STRATEGY_TYPES` | `'fixed'` | Retry strategy: `'fixed'`, `'linear'`, or `'exponential'` |
| `responseAnalyzer` | `function` | `() => true` | Validates response content, return false to retry |
| `performAllAttempts` | `boolean` | `false` | Execute all attempts regardless of success |
| `logAllErrors` | `boolean` | `false` | Enable error logging for all failed attempts |
| `handleErrors` | `function` | console.log | Custom error handler |
| `logAllSuccessfulAttempts` | `boolean` | `false` | Log all successful attempts |
| `handleSuccessfulAttemptData` | `function` | console.log | Custom success handler |
| `maxSerializableChars` | `number` | `1000` | Max characters for serialized logs |
| `finalErrorAnalyzer` | `function` | `() => false` | Analyze final error, return true to suppress throwing |
| `trialMode` | `TRIAL_MODE_OPTIONS` | `{ enabled: false }` | Simulate failures for testing |

#### Request Data Configuration

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
  signal?: AbortSignal;                // For request cancellation
}
```

### `stableApiGateway<RequestDataType, ResponseDataType>(requests, options)`

Execute multiple HTTP requests with shared configuration and optional grouping.

#### Gateway Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrentExecution` | `boolean` | `true` | Execute requests concurrently or sequentially |
| `stopOnFirstError` | `boolean` | `false` | Stop execution on first error (sequential only) |
| `requestGroups` | `RequestGroup[]` | `[]` | Define groups with their own common configurations |
| `commonAttempts` | `number` | `1` | Default attempts for all requests |
| `commonPerformAllAttempts` | `boolean` | `false` | Default performAllAttempts for all requests |
| `commonWait` | `number` | `1000` | Default wait time for all requests |
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

#### Request Group Configuration

```typescript
interface RequestGroup {
  id: string;                          // Unique group identifier
  commonConfig?: {
    // Any common* option can be specified here
    commonAttempts?: number;
    commonWait?: number;
    commonRetryStrategy?: RETRY_STRATEGY_TYPES;
    commonRequestData?: Partial<REQUEST_DATA>;
    commonResponseAnalyzer?: function;
    commonHandleErrors?: function;
    // ... all other common* options
  };
}
```

#### Request Format

```typescript
interface API_GATEWAY_REQUEST<RequestDataType, ResponseDataType> {
  id: string;                          // Unique identifier for the request
  groupId?: string;                    // Optional group identifier
  requestOptions: API_GATEWAY_REQUEST_OPTIONS_TYPE<RequestDataType, ResponseDataType>;
}
```

**Configuration Priority:** Individual request options override group options, which override global common options.

#### Response Format

```typescript
interface API_GATEWAY_RESPONSE<ResponseDataType> {
  requestId: string;                   // Request identifier
  groupId?: string;                    // Group identifier (if request was grouped)
  success: boolean;                    // Whether the request succeeded
  data?: ResponseDataType;             // Response data (if success is true)
  error?: string;                      // Error message (if success is false)
}
```

## Real-World Use Cases

### 1. Environment-Based Service Tiers with Groups

Organize API calls by criticality with different retry strategies per tier.

```typescript
const results = await stableApiGateway(
  [
    // Critical services
    { id: 'auth-validate', groupId: 'critical', requestOptions: { reqData: { path: '/auth/validate' }, resReq: true } },
    { id: 'db-primary', groupId: 'critical', requestOptions: { reqData: { path: '/db/health' }, resReq: true } },
    
    // Payment services
    { id: 'stripe-charge', groupId: 'payments', requestOptions: { reqData: { path: '/stripe/charge', body: { amount: 1000 } }, resReq: true } },
    { id: 'paypal-charge', groupId: 'payments', requestOptions: { reqData: { path: '/paypal/charge', body: { amount: 1000 } }, resReq: true } },
    
    // Analytics services
    { id: 'track-event', groupId: 'analytics', requestOptions: { reqData: { path: '/track' }, resReq: true } }
  ],
  {
    // Global defaults
    commonAttempts: 2,
    commonWait: 500,
    commonRequestData: { hostname: 'api.example.com', method: REQUEST_METHODS.POST },
    
    requestGroups: [
      {
        id: 'critical',
        commonConfig: {
          commonAttempts: 10,
          commonWait: 2000,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
          commonHandleErrors: async (reqData, error) => {
            await pagerDuty.alert('CRITICAL', error);
          }
        }
      },
      {
        id: 'payments',
        commonConfig: {
          commonAttempts: 5,
          commonWait: 1500,
          commonRetryStrategy: RETRY_STRATEGIES.LINEAR,
          commonRequestData: {
            headers: { 'X-Idempotency-Key': crypto.randomUUID() }
          },
          commonResponseAnalyzer: async (reqData, data) => {
            return data?.status === 'succeeded' && data?.transactionId;
          }
        }
      },
      {
        id: 'analytics',
        commonConfig: {
          commonAttempts: 1,
          commonFinalErrorAnalyzer: async () => true // Don't throw
        }
      }
    ]
  }
);

// Analyze results by group
const criticalHealth = results.filter(r => r.groupId === 'critical').every(r => r.success);
const paymentSuccess = results.filter(r => r.groupId === 'payments').filter(r => r.success).length;

if (!criticalHealth) {
  console.error('CRITICAL SERVICES DEGRADED');
}
console.log(`Payments: ${paymentSuccess} successful`);
```

### 2. Multi-Region API Deployment with Groups

Handle requests to different geographic regions with region-specific configurations.

```typescript
const results = await stableApiGateway(
  [
    { id: 'us-user-profile', groupId: 'us-east', requestOptions: { reqData: { path: '/users/profile' }, resReq: true } },
    { id: 'us-orders', groupId: 'us-east', requestOptions: { reqData: { path: '/orders' }, resReq: true } },
    
    { id: 'eu-user-profile', groupId: 'eu-west', requestOptions: { reqData: { path: '/users/profile' }, resReq: true } },
    { id: 'eu-orders', groupId: 'eu-west', requestOptions: { reqData: { path: '/orders' }, resReq: true } },
    
    { id: 'ap-user-profile', groupId: 'ap-southeast', requestOptions: { reqData: { path: '/users/profile' }, resReq: true } },
    { id: 'ap-orders', groupId: 'ap-southeast', requestOptions: { reqData: { path: '/orders' }, resReq: true } }
  ],
  {
    commonAttempts: 3,
    commonWait: 1000,
    
    requestGroups: [
      {
        id: 'us-east',
        commonConfig: {
          commonRequestData: {
            hostname: 'api-us-east.example.com',
            headers: { 'X-Region': 'us-east-1' },
            timeout: 5000 // Lower latency expected
          },
          commonAttempts: 3,
          commonRetryStrategy: RETRY_STRATEGIES.LINEAR
        }
      },
      {
        id: 'eu-west',
        commonConfig: {
          commonRequestData: {
            hostname: 'api-eu-west.example.com',
            headers: { 'X-Region': 'eu-west-1' },
            timeout: 8000
          },
          commonAttempts: 5,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
        }
      },
      {
        id: 'ap-southeast',
        commonConfig: {
          commonRequestData: {
            hostname: 'api-ap-southeast.example.com',
            headers: { 'X-Region': 'ap-southeast-1' },
            timeout: 10000 // Higher latency expected
          },
          commonAttempts: 7,
          commonWait: 1500,
          commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
        }
      }
    ]
  }
);

// Regional performance analysis
const regionPerformance = results.reduce((acc, result) => {
  if (!acc[result.groupId!]) acc[result.groupId!] = { success: 0, failed: 0 };
  result.success ? acc[result.groupId!].success++ : acc[result.groupId!].failed++;
  return acc;
}, {} as Record<string, { success: number; failed: number }>);

console.log('Regional performance:', regionPerformance);
```

### 3. Microservices Health Monitoring with Groups

Monitor different microservices with service-specific health check configurations.

```typescript
const healthChecks = await stableApiGateway(
  [
    // Core services
    { id: 'auth-health', groupId: 'core', requestOptions: { reqData: { hostname: 'auth.internal.example.com', path: '/health' } } },
    { id: 'user-health', groupId: 'core', requestOptions: { reqData: { hostname: 'users.internal.example.com', path: '/health' } } },
    { id: 'order-health', groupId: 'core', requestOptions: { reqData: { hostname: 'orders.internal.example.com', path: '/health' } } },
    
    // Auxiliary services
    { id: 'cache-health', groupId: 'auxiliary', requestOptions: { reqData: { hostname: 'cache.internal.example.com', path: '/health' } } },
    { id: 'search-health', groupId: 'auxiliary', requestOptions: { reqData: { hostname: 'search.internal.example.com', path: '/health' } } },
    
    // Third-party
    { id: 'stripe-health', groupId: 'third-party', requestOptions: { reqData: { hostname: 'api.stripe.com', path: '/v1/health' } } }
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
          commonResponseAnalyzer: async (reqData, data) => {
            return data?.status === 'healthy' && 
                   data?.dependencies?.every(d => d.status === 'healthy');
          },
          commonHandleErrors: async (reqData, error) => {
            await pagerDuty.trigger({ severity: 'critical', message: `Core service down: ${error.error}` });
          }
        }
      },
      {
        id: 'auxiliary',
        commonConfig: {
          commonAttempts: 2,
          commonResponseAnalyzer: async (reqData, data) => data?.status === 'ok',
          commonFinalErrorAnalyzer: async () => true // Don't fail on auxiliary issues
        }
      },
      {
        id: 'third-party',
        commonConfig: {
          commonAttempts: 3,
          commonWait: 3000,
          commonRequestData: { timeout: 15000 },
          commonHandleErrors: async (reqData, error) => {
            logger.warn('Third-party health check failed', { error });
          },
          commonFinalErrorAnalyzer: async () => true
        }
      }
    ]
  }
);

const healthReport = {
  timestamp: new Date().toISOString(),
  core: healthChecks.filter(r => r.groupId === 'core').every(r => r.success),
  auxiliary: healthChecks.filter(r => r.groupId === 'auxiliary').every(r => r.success),
  thirdParty: healthChecks.filter(r => r.groupId === 'third-party').every(r => r.success),
  overall: healthChecks.every(r => r.success) ? 'HEALTHY' : 'DEGRADED'
};

console.log('Health Report:', healthReport);
```

### 4. Polling for Async Job Completion

```typescript
const jobResult = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/jobs/123/status',
  },
  resReq: true,
  attempts: 20,
  wait: 3000,
  retryStrategy: RETRY_STRATEGIES.FIXED,
  responseAnalyzer: async (reqConfig, data) => {
    return data.status === 'completed';
  },
  handleErrors: async (reqConfig, error) => {
    console.log(`Job not ready yet (attempt ${error.attempt})`);
  }
});
```

### 5. Resilient External API Integration

```typescript
const weatherData = await stableRequest({
  reqData: {
    hostname: 'api.weather.com',
    path: '/current',
    query: { city: 'London' },
    headers: { 'Authorization': `Bearer ${token}` }
  },
  resReq: true,
  attempts: 5,
  wait: 2000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  logAllErrors: true,
  handleErrors: async (reqConfig, error) => {
    logger.warn('Weather API retry', { 
      attempt: error.attempt,
      isRetryable: error.isRetryable 
    });
  }
});
```

### 6. Database Replication Consistency Check

```typescript
const consistentData = await stableRequest({
  reqData: {
    hostname: 'replica.db.example.com',
    path: '/records/456',
  },
  resReq: true,
  attempts: 10,
  wait: 500,
  retryStrategy: RETRY_STRATEGIES.LINEAR,
  responseAnalyzer: async (reqConfig, data) => {
    // Wait until replica has the latest version
    return data.version >= expectedVersion;
  }
});
```

### 7. Batch User Creation

```typescript
const users = [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' }
];

const requests = users.map((user, index) => ({
  id: `create-user-${index}`,
  requestOptions: {
    reqData: {
      body: user
    },
    resReq: true
  }
}));

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonAttempts: 3,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  commonLogAllErrors: true,
  commonHandleErrors: async (reqConfig, error) => {
    console.log(`Failed to create user: ${error.error}`);
  },
  commonRequestData: {
    hostname: 'api.example.com',
    path: '/users',
    method: REQUEST_METHODS.POST
  }
});

const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`Created ${successful.length} users`);
console.log(`Failed to create ${failed.length} users`);
```

### 8. Batch Data Processing with Tiered Priority Groups

```typescript
const dataItems = [
  { id: 1, data: 'critical-transaction', priority: 'high' },
  { id: 2, data: 'user-action', priority: 'medium' },
  { id: 3, data: 'analytics-event', priority: 'low' }
];

const requests = dataItems.map(item => ({
  id: `item-${item.id}`,
  groupId: item.priority === 'high' ? 'high-priority' :
           item.priority === 'medium' ? 'medium-priority' : 'low-priority',
  requestOptions: {
    reqData: { body: item },
    resReq: true
  }
}));

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonRequestData: {
    hostname: 'processing.example.com',
    path: '/process',
    method: REQUEST_METHODS.POST
  },
  
  requestGroups: [
    {
      id: 'high-priority',
      commonConfig: {
        commonAttempts: 10,
        commonWait: 2000,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
        commonRequestData: { headers: { 'X-Priority': 'high' } },
        commonResponseAnalyzer: async (reqData, data) => {
          return data?.processed && !data?.errors?.length && data?.validationStatus === 'passed';
        }
      }
    },
    {
      id: 'medium-priority',
      commonConfig: {
        commonAttempts: 5,
        commonWait: 1000,
        commonRetryStrategy: RETRY_STRATEGIES.LINEAR,
        commonRequestData: { headers: { 'X-Priority': 'medium' } }
      }
    },
    {
      id: 'low-priority',
      commonConfig: {
        commonAttempts: 2,
        commonRequestData: { headers: { 'X-Priority': 'low' } },
        commonFinalErrorAnalyzer: async () => true // Accept failures
      }
    }
  ]
});

// Report by priority
const report = {
  high: results.filter(r => r.groupId === 'high-priority'),
  medium: results.filter(r => r.groupId === 'medium-priority'),
  low: results.filter(r => r.groupId === 'low-priority')
};

console.log(`High: ${report.high.filter(r => r.success).length}/${report.high.length}`);
console.log(`Medium: ${report.medium.filter(r => r.success).length}/${report.medium.length}`);
console.log(`Low: ${report.low.filter(r => r.success).length}/${report.low.length}`);
```

### 9. Rate-Limited API with Backoff

```typescript
const searchResults = await stableRequest({
  reqData: {
    hostname: 'api.ratelimited-service.com',
    path: '/search',
    query: { q: 'nodejs' }
  },
  resReq: true,
  attempts: 10,
  wait: 1000,
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
  handleErrors: async (reqConfig, error) => {
    if (error.type === 'HTTP_ERROR' && error.error.includes('429')) {
      console.log('Rate limited, backing off...');
    }
  }
});
```

### 10. Sequential Workflow with Dependencies

```typescript
const workflowSteps = [
  {
    id: 'step-1-init',
    requestOptions: {
      reqData: { path: '/init' },
      resReq: true
    }
  },
  {
    id: 'step-2-process',
    requestOptions: {
      reqData: { path: '/process' },
      resReq: true,
      responseAnalyzer: async (reqConfig, data) => {
        return data.status === 'completed';
      }
    }
  },
  {
    id: 'step-3-finalize',
    requestOptions: {
      reqData: { path: '/finalize' },
      resReq: true
    }
  }
];

const results = await stableApiGateway(workflowSteps, {
  concurrentExecution: false,
  stopOnFirstError: true,
  commonRequestData: {
    hostname: 'workflow.example.com',
    method: REQUEST_METHODS.POST,
    body: { workflowId: 'wf-123' }
  },
  commonAttempts: 5,
  commonWait: 2000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});

if (results.every(r => r.success)) {
  console.log('Workflow completed successfully');
} else {
  console.error('Workflow failed at step:', results.findIndex(r => !r.success) + 1);
}
```

## Advanced Patterns

### Circuit Breaker Pattern

```typescript
let failureCount = 0;
const CIRCUIT_THRESHOLD = 5;

async function resilientRequest(endpoint: string) {
  if (failureCount >= CIRCUIT_THRESHOLD) {
    throw new Error('Circuit breaker open');
  }

  try {
    const result = await stableRequest({
      reqData: { hostname: 'api.example.com', path: endpoint },
      resReq: true,
      attempts: 3,
      handleErrors: async () => {
        failureCount++;
      }
    });
    failureCount = 0;
    return result;
  } catch (error) {
    if (failureCount >= CIRCUIT_THRESHOLD) {
      console.log('Circuit breaker activated');
      setTimeout(() => { failureCount = 0; }, 60000);
    }
    throw error;
  }
}
```

### Dynamic Request Configuration with Groups

```typescript
const endpoints = await getEndpointsFromConfig();

const requests = endpoints.map(endpoint => ({
  id: endpoint.id,
  groupId: endpoint.tier, // 'critical', 'standard', or 'optional'
  requestOptions: {
    reqData: {
      hostname: endpoint.hostname,
      path: endpoint.path,
      method: endpoint.method,
      ...(endpoint.auth && { 
        headers: { Authorization: `Bearer ${endpoint.auth}` }
      })
    },
    resReq: true
  }
}));

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonWait: 1000,
  
  requestGroups: [
    {
      id: 'critical',
      commonConfig: {
        commonAttempts: 10,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      }
    },
    {
      id: 'standard',
      commonConfig: {
        commonAttempts: 5,
        commonRetryStrategy: RETRY_STRATEGIES.LINEAR
      }
    },
    {
      id: 'optional',
      commonConfig: {
        commonAttempts: 2,
        commonFinalErrorAnalyzer: async () => true
      }
    }
  ]
});
```

### Conditional Retry Based on Response

```typescript
await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data',
  },
  resReq: true,
  attempts: 5,
  responseAnalyzer: async (reqConfig, data) => {
    if (!data.complete) {
      console.log('Data incomplete, retrying...');
      return false;
    }
    
    if (data.error) {
      throw new Error('Invalid data, cannot retry');
    }
    
    return true;
  }
});
```

## TypeScript Support

Full TypeScript support with generic types for request and response data:

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
  resReq: true,
  attempts: 3
});

// user is fully typed as UserResponse
console.log(user.id);
```

## Comparison with Similar Libraries

### vs. axios-retry

| Feature | stable-request | axios-retry |
|---------|----------------|-------------|
| **Content validation** | ✅ Full support with `responseAnalyzer` | ❌ Only HTTP status codes |
| **Batch processing** | ✅ Built-in `stableApiGateway` | ❌ Manual implementation needed |
| **Request grouping** | ✅ Hierarchical configuration | ❌ No grouping support |
| **Trial mode** | ✅ Built-in failure simulation | ❌ No testing utilities |
| **Retry strategies** | ✅ Fixed, Linear, Exponential | ✅ Exponential only |
| **Observability** | ✅ Granular hooks for every attempt | ⚠️ Limited |
| **Final error analysis** | ✅ Custom error handling | ❌ No |

### vs. got

| Feature | stable-request | got |
|---------|----------------|-----|
| **Built on Axios** | ✅ Leverages Axios ecosystem | ❌ Standalone client |
| **Content validation** | ✅ Response analyzer | ❌ Only HTTP errors |
| **Batch processing** | ✅ Built-in gateway with grouping | ❌ Manual implementation |
| **Request grouping** | ✅ Multi-tier configuration | ❌ No grouping |
| **Trial mode** | ✅ Simulation for testing | ❌ No |
| **Retry strategies** | ✅ 3 configurable strategies | ✅ Exponential with jitter |

### vs. p-retry + axios

| Feature | stable-request | p-retry + axios |
|---------|----------------|-----------------|
| **All-in-one** | ✅ Single package | ❌ Requires multiple packages |
| **HTTP-aware** | ✅ Built for HTTP | ❌ Generic retry wrapper |
| **Content validation** | ✅ Built-in | ❌ Manual implementation |
| **Batch processing** | ✅ Built-in with groups | ❌ Manual implementation |
| **Request grouping** | ✅ Native support | ❌ No grouping |
| **Observability** | ✅ Request-specific hooks | ⚠️ Generic callbacks |

## Best Practices

1. **Use exponential backoff for rate-limited APIs** to avoid overwhelming the server
2. **Organize related requests into groups** for easier configuration management
3. **Set reasonable timeout values** in `reqData.timeout` to prevent hanging requests
4. **Implement responseAnalyzer** for APIs that return 200 OK with error details in the body
5. **Use concurrent execution** in `stableApiGateway` for independent requests
6. **Use sequential execution** when requests have dependencies or need to maintain order
7. **Leverage request groups** to differentiate between critical and optional services
8. **Use finalErrorAnalyzer** for graceful degradation in non-critical paths
9. **Enable logging in development** with `logAllErrors` and `logAllSuccessfulAttempts`
10. **Use Trial Mode** to test your error handling without relying on actual failures
11. **Group requests by region or service tier** for better monitoring and configuration

## License

MIT © Manish Varma

[![npm version](https://img.shields.io/npm/v/stable-request.svg)](https://www.npmjs.com/package/%40emmvish%2Fstable-request)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**Made with ❤️ for developers who are sick of integrating apps with unreliable APIs**
