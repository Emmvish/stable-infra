
# Stable Buffer API Reference

## Table of Contents

1. [Overview](#overview)
2. [StableBufferOptions](#stablebufferoptions)
3. [State Access](#state-access)
4. [Transactions](#transactions)
5. [Metrics](#metrics)
6. [Examples](#examples)
7. [Operational Notes](#operational-notes)

---

## Overview

The **StableBuffer** is a transactional, in-memory shared state utility. It serializes concurrent updates through a promise queue, allowing workflows, gateways, and schedulers to mutate a shared buffer safely.

Source: [src/core/stable-buffer.ts](../../src/core/stable-buffer.ts)

Key features:

- ✅ **Serialized transactions** using a FIFO queue
- ✅ **Snapshot reads** via deep cloning
- ✅ **Timeouts** for long-running transactions
- ✅ **Metrics + guardrails** for validation

---

## StableBufferOptions

```ts
type StableBufferOptions = {
	initialState?: Record<string, any>;
	clone?: (state: Record<string, any>) => Record<string, any>;
	metricsGuardrails?: MetricsGuardrailsStableBuffer;
	transactionTimeoutMs?: number;
	logTransaction?: (log: StableBufferTransactionLog) => void | Promise<void>;
};
```

**Fields**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `initialState` | `Record<string, any>` | No | Starting state. Defaults to `{}`. |
| `clone` | `(state) => state` | No | Custom clone function for `read()`. Defaults to `structuredClone` or JSON cloning. |
| `metricsGuardrails` | `MetricsGuardrailsStableBuffer` | No | Guardrails for metrics validation. |
| `transactionTimeoutMs` | `number` | No | Timeout for each transaction. `0` or `undefined` disables timeouts. |
| `logTransaction` | `(log) => void \\| Promise<void>` | No | Optional transaction logger receiving `StableBufferTransactionLog`. |

---

## State Access

```ts
read(): Record<string, any>
getState(): Record<string, any>
setState(state: Record<string, any>): void
```

- `read()` returns a **cloned** snapshot of the current state.
- `getState()` returns the **live reference** (mutating it bypasses the queue).
- `setState()` replaces the internal state reference.

---

## Transactions

```ts
run<T>(fn: (state) => T | Promise<T>, options?: StableBufferTransactionOptions): Promise<T>
update(mutator: (state) => void | Promise<void>, options?: StableBufferTransactionOptions): Promise<void>
transaction<T>(fn: (state) => T | Promise<T>, options?: StableBufferTransactionOptions): Promise<T>
```

- `run()` is the core queued executor.
- `update()` is a convenience wrapper for void mutations.
- `transaction()` is an alias of `run()`.

Transactions are serialized using a single promise queue. Even if multiple calls are started concurrently, they execute one-by-one against the same state.

### Transaction Logging

You can pass metadata per transaction via `StableBufferTransactionOptions` and enable logging with `logTransaction`.

```ts
type StableBufferTransactionOptions = ExecutionContext & {
	activity?: string;
	hookName?: string;
    hookParams?: any;
};

type StableBufferTransactionLog = StableBufferTransactionOptions & {
	transactionId: string;
	queuedAt: string;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	queueWaitMs: number;
	success: boolean;
	errorMessage?: string;
	stateBefore: Record<string, any>;
	stateAfter: Record<string, any>;
};
```

**Consuming Logs in Other APIs:** Transaction logs can be passed to `stableRequest`, `stableFunction`, `stableApiGateway`, `stableWorkflow`, and `stableWorkflowGraph` via `loadTransactionLogs` or `transactionLogs` options. When provided, logs are available in all hooks.

Example:

```ts
const buffer = new StableBuffer({
	logTransaction: async (log) => {
		// persist log entry
	}
});

await buffer.run(
	(state) => {
		state.count = (state.count ?? 0) + 1;
	},
	{
		activity: 'workflow-phase',
		hookName: 'phase-1'
	}
);
```

---

## Metrics

```ts
getMetrics(): StableBufferMetrics
```

Returned metrics:

```ts
type StableBufferMetrics = {
	totalTransactions: number;
	averageQueueWaitMs: number;
	validation?: MetricsValidationResult;
};
```

Guardrails (if provided) are validated and exposed under `metrics.validation`.

---

## Examples

### Basic Usage

```ts
import { StableBuffer } from '@emmvish/stable-infra';

const buffer = new StableBuffer({
	initialState: { count: 0 }
});

await buffer.transaction((state) => {
	state.count += 1;
});

console.log(buffer.read());
```

### Concurrent Transactions (Serialized)

```ts
await Promise.all([
	buffer.transaction((state) => { state.count += 1; }),
	buffer.transaction((state) => { state.count += 1; }),
	buffer.transaction((state) => { state.count += 1; })
]);

// count increases by 3, with no race conditions
```

### Transaction Timeout

```ts
const buffer = new StableBuffer({
	initialState: { status: 'idle' },
	transactionTimeoutMs: 200
});

await buffer.transaction(async (state) => {
	state.status = 'working';
	await new Promise((r) => setTimeout(r, 500));
});
// -> throws: "StableBuffer transaction timed out after 200ms"
```

### Using StableBuffer with Core APIs

```ts
import {
	StableBuffer,
	stableRequest,
	stableFunction,
	stableApiGateway,
	stableWorkflow,
	RequestOrFunction
} from '@emmvish/stable-infra';

const shared = new StableBuffer({
	initialState: { traceId: 'trace-001' }
});

// stableRequest (commonBuffer)
await stableRequest({
	reqData: { hostname: 'api.example.com', path: '/ping' },
	resReq: true,
	commonBuffer: shared
});

// stableFunction (commonBuffer)
await stableFunction({
	fn: async () => 'ok',
	returnResult: true,
	commonBuffer: shared
});

// stableApiGateway (sharedBuffer)
await stableApiGateway(
	[
		{
			type: RequestOrFunction.REQUEST,
			request: {
				id: 'ping',
				requestOptions: { reqData: { hostname: 'api.example.com', path: '/ping' } }
			}
		}
	],
	[],
	{ sharedBuffer: shared }
);

// stableWorkflow (sharedBuffer)
await stableWorkflow(
	[
		{
			id: 'phase-1',
			requests: [
				{
					id: 'ping',
					requestOptions: { reqData: { hostname: 'api.example.com', path: '/ping' } }
				}
			]
		}
	],
	{ sharedBuffer: shared }
);
```

---

## Operational Notes

- **Timeouts do not cancel execution**; they only reject the caller while the queued work completes in the background to preserve ordering.
- **Single-process only**: no cross-process synchronization.
- **Avoid mutating `getState()`** directly unless you intentionally bypass transactional safety.
- **Long transactions block the queue**; keep mutations small and fast.
