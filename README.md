## stable-request

A robust HTTP request wrapper built on top of Axios with intelligent retry strategies, content validation, batch processing, and comprehensive observability features.

## Why stable-request?

Most HTTP client libraries only retry on network failures or specific HTTP status codes. **stable-request** goes further by providing:

- ✅ **Content-aware retries** - Validate response content and retry even on successful HTTP responses
- 🚀 **Batch processing** - Execute multiple requests concurrently or sequentially with shared configuration
- 🧪 **Trial mode** - Simulate failures to test your retry logic without depending on real network instability
- 📊 **Granular observability** - Monitor every attempt with detailed hooks
- ⚡ **Multiple retry strategies** - Fixed, linear, or exponential backoff
- 🎯 **Flexible error handling** - Custom error analysis and graceful degradation

## Installation

```bash
npm install @mv/stable-request
```

## Quick Start

### Single Request

```typescript
import { stableRequest, REQUEST_METHODS, RETRY_STRATEGIES } from '@mv/stable-request';

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
import { stableApiGateway } from '@mv/stable-request';

const requests = [
  {
    id: 'user-1',
    requestOptions: {
      reqData: { hostname: 'api.example.com', path: '/users/1' },
      resReq: true
    }
  },
  {
    id: 'user-2',
    requestOptions: {
      reqData: { hostname: 'api.example.com', path: '/users/2' },
      resReq: true
    }
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonAttempts: 3,
  commonWait: 1000
});
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
import { stableApiGateway, RETRY_STRATEGIES, REQUEST_METHODS } from '@mv/stable-request';

const requests = [
  {
    id: 'create-user-1',
    requestOptions: {
      reqData: {
        hostname: 'api.example.com',
        path: '/users',
        method: REQUEST_METHODS.POST,
        body: { name: 'John Doe', email: 'john@example.com' }
      }
    }
  },
  {
    id: 'create-user-2',
    requestOptions: {
      reqData: {
        hostname: 'api.example.com',
        path: '/users',
        method: REQUEST_METHODS.POST,
        body: { name: 'Jane Smith', email: 'jane@example.com' }
      }
    }
  }
];

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonResReq: true,
  commonAttempts: 3,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});

// Process results
results.forEach(result => {
  if (result.success) {
    console.log(`${result.id} succeeded:`, result.data);
  } else {
    console.error(`${result.id} failed:`, result.error);
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

### 3. Trial Mode - Test Your Retry Logic

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

### 4. Multiple Retry Strategies

Choose the backoff strategy that fits your use case.

```typescript
import { stableRequest, RETRY_STRATEGIES } from '@mv/stable-request';

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

### 5. Comprehensive Observability

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

### 6. Smart Retry Logic

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

### 7. Final Error Analysis

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

### 8. Request Cancellation Support

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

### 9. Perform All Attempts Mode

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

Execute multiple HTTP requests with shared configuration.

#### Gateway Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrentExecution` | `boolean` | `true` | Execute requests concurrently or sequentially |
| `stopOnFirstError` | `boolean` | `false` | Stop execution on first error (sequential only) |
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

#### Request Format

```typescript
interface API_GATEWAY_REQUEST<RequestDataType, ResponseDataType> {
  id: string;                          // Unique identifier for the request
  requestOptions: STABLE_REQUEST<RequestDataType, ResponseDataType>;
}
```

**Note:** Individual request options override common options. If a specific option is not provided in `requestOptions`, the corresponding `common*` option is used.

#### Response Format

```typescript
interface API_GATEWAY_RESPONSE<ResponseDataType> {
  id: string;                          // Request identifier
  success: boolean;                    // Whether the request succeeded
  data?: ResponseDataType;             // Response data (if success is true)
  error?: string;                      // Error message (if success is false)
}
```

## Real-World Use Cases

### 1. Polling for Async Job Completion

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

### 2. Resilient External API Integration

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

### 3. Database Replication Consistency Check

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

### 4. Batch User Creation

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
      hostname: 'api.example.com',
      path: '/users',
      method: REQUEST_METHODS.POST,
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
  }
});

const successful = results.filter(r => r.success);
const failed = results.filter(r => !r.success);

console.log(`Created ${successful.length} users`);
console.log(`Failed to create ${failed.length} users`);
```

### 5. Rate-Limited API with Backoff

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
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL, // Exponential backoff for rate limits
  handleErrors: async (reqConfig, error) => {
    if (error.type === 'HTTP_ERROR' && error.error.includes('429')) {
      console.log('Rate limited, backing off...');
    }
  }
});
```

### 6. Microservices Health Check

```typescript
const services = ['auth', 'users', 'orders', 'payments'];

const healthChecks = services.map(service => ({
  id: `health-${service}`,
  requestOptions: {
    reqData: {
      hostname: `${service}.internal.example.com`,
      path: '/health'
    },
    resReq: true,
    attempts: 3,
    wait: 500
  }
}));

const results = await stableApiGateway(healthChecks, {
  concurrentExecution: true,
  commonRetryStrategy: RETRY_STRATEGIES.LINEAR
});

const healthStatus = results.reduce((acc, result) => {
  const serviceName = result.id.replace('health-', '');
  acc[serviceName] = result.success ? 'healthy' : 'unhealthy';
  return acc;
}, {});

console.log('Service health status:', healthStatus);
```

### 7. Payment Processing with Idempotency

```typescript
const payment = await stableRequest({
  reqData: {
    hostname: 'payment-gateway.com',
    path: '/charge',
    method: REQUEST_METHODS.POST,
    headers: { 'Idempotency-Key': uniqueId },
    body: { amount: 1000, currency: 'USD' }
  },
  resReq: true,
  attempts: 3,
  wait: 1000,
  responseAnalyzer: async (reqConfig, data) => {
    return data.status === 'succeeded';
  },
  finalErrorAnalyzer: async (reqConfig, error) => {
    // Check if payment actually went through despite error
    const status = await checkPaymentStatus(uniqueId);
    return status === 'succeeded';
  }
});
```

### 8. Bulk Data Migration

```typescript
const records = await fetchLegacyRecords();

const migrationRequests = records.map((record, index) => ({
  id: `migrate-${record.id}`,
  requestOptions: {
    reqData: {
      hostname: 'new-system.example.com',
      path: '/import',
      method: REQUEST_METHODS.POST,
      body: record
    },
    resReq: true,
    // Individual retry config for critical records
    ...(record.critical && { 
      attempts: 5,
      wait: 2000,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
    })
  }
}));

const results = await stableApiGateway(migrationRequests, {
  concurrentExecution: true,
  commonAttempts: 3,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.LINEAR,
  commonHandleErrors: async (reqConfig, error) => {
    await logMigrationError(reqConfig.data.id, error);
  }
});
```

### 9. Multi-Source Data Aggregation

```typescript
const sources = [
  { id: 'source-1', hostname: 'api1.example.com', path: '/data' },
  { id: 'source-2', hostname: 'api2.example.com', path: '/info' },
  { id: 'source-3', hostname: 'api3.example.com', path: '/stats' }
];

const requests = sources.map(source => ({
  id: source.id,
  requestOptions: {
    reqData: {
      hostname: source.hostname,
      path: source.path
    },
    resReq: true,
    attempts: 3,
    finalErrorAnalyzer: async () => true // Don't fail if one source is down
  }
}));

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonWait: 1000,
  commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});

const aggregatedData = results
  .filter(r => r.success)
  .map(r => r.data);

console.log(`Collected data from ${aggregatedData.length}/${sources.length} sources`);
```

### 10. Sequential Workflow with Dependencies

```typescript
const workflowSteps = [
  {
    id: 'step-1-init',
    requestOptions: {
      reqData: {
        hostname: 'workflow.example.com',
        path: '/init',
        method: REQUEST_METHODS.POST,
        body: { workflowId: 'wf-123' }
      },
      resReq: true
    }
  },
  {
    id: 'step-2-process',
    requestOptions: {
      reqData: {
        hostname: 'workflow.example.com',
        path: '/process',
        method: REQUEST_METHODS.POST,
        body: { workflowId: 'wf-123' }
      },
      resReq: true,
      responseAnalyzer: async (reqConfig, data) => {
        return data.status === 'completed';
      }
    }
  },
  {
    id: 'step-3-finalize',
    requestOptions: {
      reqData: {
        hostname: 'workflow.example.com',
        path: '/finalize',
        method: REQUEST_METHODS.POST,
        body: { workflowId: 'wf-123' }
      },
      resReq: true
    }
  }
];

const results = await stableApiGateway(workflowSteps, {
  concurrentExecution: false, // Execute sequentially
  stopOnFirstError: true,     // Stop if any step fails
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
    failureCount = 0; // Reset on success
    return result;
  } catch (error) {
    if (failureCount >= CIRCUIT_THRESHOLD) {
      console.log('Circuit breaker activated');
      setTimeout(() => { failureCount = 0; }, 60000); // Reset after 1 minute
    }
    throw error;
  }
}
```

### Dynamic Request Configuration

```typescript
const endpoints = await getEndpointsFromConfig();

const requests = endpoints.map(endpoint => ({
  id: endpoint.id,
  requestOptions: {
    reqData: {
      hostname: endpoint.hostname,
      path: endpoint.path,
      method: endpoint.method,
      ...(endpoint.auth && { 
        headers: { Authorization: `Bearer ${endpoint.auth}` }
      })
    },
    resReq: true,
    attempts: endpoint.critical ? 5 : 3,
    retryStrategy: endpoint.critical ? RETRY_STRATEGIES.EXPONENTIAL : RETRY_STRATEGIES.FIXED
  }
}));

const results = await stableApiGateway(requests, {
  concurrentExecution: true,
  commonWait: 1000
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
    // Only retry if data is incomplete
    if (!data.complete) {
      console.log('Data incomplete, retrying...');
      return false;
    }
    
    // Don't retry if data is invalid (different from incomplete)
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
| **Trial mode** | ✅ Built-in failure simulation | ❌ No testing utilities |
| **Retry strategies** | ✅ Fixed, Linear, Exponential | ✅ Exponential only |
| **Observability** | ✅ Granular hooks for every attempt | ⚠️ Limited |
| **Final error analysis** | ✅ Custom error handling | ❌ No |

### vs. got

| Feature | stable-request | got |
|---------|----------------|-----|
| **Built on Axios** | ✅ Leverages Axios ecosystem | ❌ Standalone client |
| **Content validation** | ✅ Response analyzer | ❌ Only HTTP errors |
| **Batch processing** | ✅ Built-in gateway | ❌ Manual implementation |
| **Trial mode** | ✅ Simulation for testing | ❌ No |
| **Retry strategies** | ✅ 3 configurable strategies | ✅ Exponential with jitter |

### vs. p-retry + axios

| Feature | stable-request | p-retry + axios |
|---------|----------------|-----------------|
| **All-in-one** | ✅ Single package | ❌ Requires multiple packages |
| **HTTP-aware** | ✅ Built for HTTP | ❌ Generic retry wrapper |
| **Content validation** | ✅ Built-in | ❌ Manual implementation |
| **Batch processing** | ✅ Built-in | ❌ Manual implementation |
| **Observability** | ✅ Request-specific hooks | ⚠️ Generic callbacks |

## Best Practices

1. **Use exponential backoff for rate-limited APIs** to avoid overwhelming the server
2. **Set reasonable timeout values** in `reqData.timeout` to prevent hanging requests
3. **Implement responseAnalyzer** for APIs that return 200 OK with error details in the body
4. **Use concurrent execution** in `stableApiGateway` for independent requests
5. **Use sequential execution** when requests have dependencies or need to maintain order
6. **Leverage finalErrorAnalyzer** for graceful degradation in non-critical paths
7. **Enable logging in development** with `logAllErrors` and `logAllSuccessfulAttempts`
8. **Use Trial Mode** to test your error handling without relying on actual failures

## License

MIT © Manish Varma

[![npm version](https://img.shields.io/npm/v/stable-request.svg)](https://www.npmjs.com/package/stable-request)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

**Made with ❤️ for developers who are sick of integrating with unreliable APIs**
