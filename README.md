# stable-request

Robust request wrapper around Axios with configurable retry strategies, response validation, error/success hooks, cancellation support, and a trial mode for simulating failures.

- Retries with fixed, linear, or exponential backoff
- Validate responses via a custom analyzer before accepting
- Error and success hooks with safe execution and bounded stringification
- AbortSignal-based cancellation
- Trial mode to simulate request/retry failures for testing
- Tree-shakeable ESM with typed utilities

## Install

```sh
npm install stable-request
```

## Quick start

```ts
import { stableRequest, REQUEST_METHODS, VALID_REQUEST_PROTOCOLS } from 'stable-request';

const data = await stableRequest<{ message: string }>({
  reqData: {
    url: 'api.example.com',
    protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
    path: '/v1/ping',
    method: REQUEST_METHODS.GET,
    query: { lang: 'en' },
    timeout: 10000
  },
  resReq: true, // return response data instead of boolean
  responseAnalyzer: (data) => Boolean(data?.message)
});

console.log(data.message);
```

## Retry strategies

- fixed: constant delay between attempts
- linear: delay = attempt × baseDelay
- exponential: delay grows exponentially as $delay \times 2^{attempt - 1}$

```ts
import { stableRequest, RETRY_STRATEGIES } from 'stable-request';

await stableRequest({
  reqData: { url: 'api.example.com', path: '/v1/data' },
  attempts: 5,
  wait: 500, // base delay (ms)
  retryStrategy: RETRY_STRATEGIES.EXPONENTIAL
});
```

## Cancellation

```ts
import { stableRequest } from 'stable-request';

const controller = new AbortController();

const promise = stableRequest({
  reqData: {
    url: 'api.example.com',
    path: '/slow',
    signal: controller.signal
  },
  attempts: 1
});

// cancel if needed
controller.abort();
```

## Trial mode (failure simulation)

```ts
import { stableRequest } from 'stable-request';

await stableRequest({
  reqData: { url: 'api.example.com', path: '/v1/test' },
  resReq: false,
  attempts: 3,
  trialMode: {
    enabled: true,
    reqFailureProbability: 0.3,   // 30% chance initial request fails
    retryFailureProbability: 0.2  // 20% chance a retry is marked non-retryable
  }
});
```

Notes:
- Probabilities must be in [0, 1]; invalid values throw early.
- Trial mode logs request/response and final error/response to console.

## Error and success hooks

```ts
import { stableRequest, RESPONSE_ERRORS } from 'stable-request';

await stableRequest({
  reqData: { url: 'api.example.com', path: '/v1/items' },
  resReq: true,
  attempts: 3,
  logAllErrors: true,
  handleErrors: (reqConfig, error, maxLen) => {
    // error: { timestamp, attempt, error, type: RESPONSE_ERRORS, isRetryable }
    console.warn('Error log:', error);
  },
  logAllSuccessfulAttempts: true,
  handleSuccessfulAttemptData: (reqConfig, attemptData) => {
    // attemptData: { attempt, timestamp, data }
    console.info('Successful attempt:', attemptData.attempt);
  },
  finalErrorAnalyzer: (reqConfig, finalError) => {
    // return true to suppress throw and resolve to false instead
    return false;
  }
});
```

## Request shape

The library builds an Axios config for you. Minimal request:

```ts
import { stableRequest } from 'stable-request';

await stableRequest({
  reqData: {
    url: 'api.example.com', // host only
    path: '/v1/resource',   // path
    // optional:
    // protocol: 'https' | 'http' (default: https)
    // port: number (default: 443 for https)
    // method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT' (default: GET)
    // headers: object
    // query: object
    // body: object
    // timeout: number (ms)
    // signal: AbortSignal
  }
});
```

Generated Axios config roughly corresponds to:
- baseURL: `${protocol}://${url}:${port ?? 443}`
- url: `path`
- method, headers, params, data, timeout, signal

## API

- stableRequest<T = any>(options: STABLE_REQUEST<T>): Promise<T | boolean>

Common options:
- resReq: boolean — return response data (true) or boolean (false)
- attempts: number — total attempts (default 1)
- performAllAttempts: boolean — always perform all attempts
- wait: number — base delay between attempts (ms, default 1000)
- retryStrategy: 'fixed' | 'linear' | 'exponential'
- responseAnalyzer: (data: T) => boolean | Promise<boolean>
- logAllErrors / handleErrors
- logAllSuccessfulAttempts / handleSuccessfulAttemptData
- maxSerializableChars: number — safe stringification truncation (default 1000)
- finalErrorAnalyzer: (reqConfig, error) => boolean | Promise<boolean>
- trialMode: { enabled: boolean; reqFailureProbability?: number; retryFailureProbability?: number }

## Enums and types

```ts
import {
  REQUEST_METHODS,
  RETRY_STRATEGIES,
  VALID_REQUEST_PROTOCOLS
} from 'stable-request';

import type {
  REQUEST_DATA,
  STABLE_REQUEST,
  SUCCESSFUL_ATTEMPT_DATA,
  TRIAL_MODE_OPTIONS
} from 'stable-request';
```

## Utilities

Tree-shakeable utility imports:

```ts
import {
  delay,
  getNewDelayTime,
  isRetryableError,
  safelyStringify
} from 'stable-request/utilities';
```

- delay(wait?: number): Promise<boolean>
- getNewDelayTime(strategy, delay, currentAttempt): number
- isRetryableError(axiosError, trialMode?): boolean
- safelyStringify(obj, maxLength?): string

## Build and test

```sh
npm run build
npm test
```

## License

MIT
