# API Reference Documentation

Complete API reference documentation for `@emmvish/stable-request` - a production-grade TypeScript framework for resilient workflow execution.

## 📚 Core Modules

### [Stable Request](./stable-request.md)
Robust HTTP/HTTPS request client with automatic retries, caching, and error recovery.

**Key Features:**
- Full HTTP method support (GET, POST, PUT, PATCH, DELETE)
- Smart error detection and automatic retries
- Response caching with cache-control respect
- Circuit breaker fail-fast protection
- Rate limiting and concurrency control
- Custom response validation
- Comprehensive error logging
- Trial mode for testing

---

### [Stable Function](./stable-function.md)
Execute any function with resilience patterns - retries, circuit breaking, caching, rate limiting, and comprehensive observability.

**Key Features:**
- Generic function execution with type safety
- Configurable retry strategies (FIXED, LINEAR, EXPONENTIAL)
- Response analysis for intelligent retries
- Circuit breaker integration
- Result caching with TTL
- Rate limiting and concurrency control
- Pre-execution hooks for dynamic configuration
- Comprehensive metrics and observability

---

### [Stable API Gateway](./stable-api-gateway.md)
Batch request processing with configuration cascading, request grouping, and concurrent execution.

**Key Features:**
- Batch HTTP requests and function execution
- Request grouping with group-level configuration
- Configuration cascade (Individual → Group → Global)
- Concurrent and sequential execution modes
- Shared state buffers across requests
- Circuit breaker and caching per group
- Infrastructure metrics aggregation
- Request-level observability hooks

---

### [Stable Workflow](./stable-workflow.md)
Multi-phase workflow orchestration with sequential, concurrent, mixed, non-linear, and branched execution patterns.

**Key Features:**
- 5 execution modes: Sequential, Concurrent, Mixed, Non-Linear, Branched
- Phase decision hooks with actions (CONTINUE, SKIP, JUMP, REPLAY, TERMINATE)
- Branch decision system for conditional branching
- Dynamic phase injection
- Shared buffers for cross-phase state
- Phase replay with max count limits
- Early termination with reason tracking
- State persistence for workflow recovery
- Comprehensive workflow metrics

---

### [Stable Workflow Graph](./stable-workflow-graph.md)
Graph-based workflow orchestration with conditional routing, parallel execution, and merge points.

**Key Features:**
- 5 node types: PHASE, BRANCH, CONDITIONAL, PARALLEL_GROUP, MERGE_POINT
- 4 edge condition types: SUCCESS, FAILURE, CUSTOM, ALWAYS
- Fluent WorkflowGraphBuilder API
- DAG validation and cycle detection
- Conditional routing based on results
- Parallel group execution with synchronization
- Merge point dependencies
- Graph visualization and debugging
- Reusable workflow patterns

---

## 🛠️ Infrastructure Utilities

### [Infrastructure Utilities](./infra-utilities.md)
Production-ready infrastructure components for building resilient systems.

**Utilities:**
- **Cache Manager**: HTTP response caching with LRU eviction and TTL
- **Circuit Breaker**: Three-state fail-fast protection (CLOSED/OPEN/HALF_OPEN)
- **Rate Limiter**: Token bucket sliding-window rate limiting
- **Concurrency Limiter**: Semaphore-based concurrency control
- **Function Cache Manager**: Memoization for expensive computations
- **Metrics Aggregator**: Comprehensive metrics extraction and aggregation

---

## 🧰 Runner Utilities

### [Stable Runner](./stable-runner.md)
Config-driven runner for executing Stable Request jobs via JSON or ESM config files.

**Key Features:**
- Config-based execution for all core APIs
- File change detection and auto re-run
- Append-only JSON output for auditability
- Docker-friendly execution model

---

## 🎯 Quick Navigation

### By Use Case

**Single Operations:**
- Simple function execution → [Stable Function](./stable-function.md)
- Single HTTP request → [Stable Request](./stable-request.md)

**Batch Operations:**
- Multiple requests/functions → [Stable API Gateway](./stable-api-gateway.md)

**Workflow Orchestration:**
- Linear/branched workflows → [Stable Workflow](./stable-workflow.md)
- Complex graph workflows → [Stable Workflow Graph](./stable-workflow-graph.md)

**Infrastructure:**
- Caching, circuit breaking, rate limiting → [Infrastructure Utilities](./infra-utilities.md)
- Config-driven execution → [Stable Runner](./stable-runner.md)

---

## 📖 Documentation Structure

Each API reference includes:
- **Overview**: Module purpose and key features
- **Core Interfaces**: Complete type definitions with field tables
- **Configuration Options**: Detailed parameter descriptions
- **Lifecycle Diagrams**: ASCII flow diagrams
- **Configuration Examples**: 6+ real-world examples
- **Advanced Use Cases**: 3+ complex scenarios
- **Best Practices**: 10+ production tips

---

## 🔗 External Resources

- **GitHub Repository**: [https://github.com/emmvish/stable-request](https://github.com/emmvish/stable-request)
- **NPM Package**: [https://www.npmjs.com/package/@emmvish/stable-request](https://www.npmjs.com/package/@emmvish/stable-request)
- **Issues & Support**: [https://github.com/emmvish/stable-request/issues](https://github.com/emmvish/stable-request/issues)
- **Interactive Examples**: [https://emmvish.github.io/stable-request/examples.html](https://emmvish.github.io/stable-request/examples.html)

---

## 🚀 Getting Started

### Installation

```bash
npm install @emmvish/stable-request
```

### Basic Usage

```typescript
import { stableRequest, stableFunction, stableWorkflow } from '@emmvish/stable-request';

// Single resilient request
const result = await stableRequest({
  reqData: {
    hostname: 'api.example.com',
    path: '/data'
  },
  attempts: 3,
  resReq: true
});

// Function with resilience
const fnResult = await stableFunction({
  fn: expensiveOperation,
  args: [arg1, arg2],
  attempts: 3,
  returnResult: true
});

// Multi-phase workflow
const workflowResult = await stableWorkflow(phases, {
  workflowId: 'my-workflow',
  concurrentExecution: true
});
```
