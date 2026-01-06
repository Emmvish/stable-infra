# Enterprise Examples

This directory contains production-ready examples demonstrating advanced capabilities of `@emmvish/stable-request`.

## Prerequisites

```bash
# Install dependencies
npm install

# Build the library
npm run build
```

## Running the Examples

### Example 1: Multi-Source Data Synchronization Pipeline

A comprehensive data synchronization workflow demonstrating:
- **Concurrent data fetching** from multiple API endpoints
- **Data enrichment and transformation** across phases
- **Non-linear workflow** with conditional retry logic
- **Circuit breaker pattern** for preventing cascade failures
- **Response caching** for optimized performance
- **Rate limiting** to respect API quotas
- **Comprehensive observability** with detailed logging

```bash
npx tsx examples/01-data-sync-pipeline.ts
```

**Key Features Demonstrated:**
- ✅ Multi-phase workflow orchestration
- ✅ Concurrent request execution
- ✅ Phase decision hooks (REPLAY action)
- ✅ Circuit breaker integration
- ✅ Response caching with TTL
- ✅ Rate limiting (50 requests per 10 seconds)
- ✅ Exponential backoff retry strategy
- ✅ Pre-execution hooks for dynamic data handling
- ✅ Shared buffer for cross-phase state management
- ✅ Comprehensive phase completion tracking

**Use Case:** Enterprise data synchronization from external APIs with validation, transformation, and batch uploading.

---

### Example 2: Resilient Microservice Orchestration

A sophisticated microservice orchestration pattern demonstrating:
- **Branch-based workflow execution** for independent service coordination
- **Concurrent and sequential branch execution** with proper dependencies
- **Per-service circuit breakers** for isolated failure handling
- **Request grouping** for different SLAs (critical vs optional services)
- **Fallback strategies** for graceful degradation
- **Branch-level decision hooks** for complex retry logic
- **Partial failure handling** with workflow termination control

```bash
npx tsx examples/02-microservice-orchestration.ts
```

**Key Features Demonstrated:**
- ✅ Branch workflow execution
- ✅ Mixed concurrent and sequential branches
- ✅ Multiple circuit breakers (one per service)
- ✅ Request grouping with different retry policies
- ✅ Branch decision hooks (REPLAY and TERMINATE actions)
- ✅ Workflow termination on critical failures
- ✅ Graceful handling of non-critical failures
- ✅ Fallback mechanisms for service resilience
- ✅ Complex state management across branches
- ✅ Detailed metrics and observability

**Use Case:** E-commerce order processing coordinating user validation, inventory management, payment processing, and notifications with proper failure handling.

---

### Example 3: Production API Health Monitoring

A comprehensive health monitoring system demonstrating:
- **Individual service health checks** with stableRequest
- **Circuit breakers** to prevent cascade failures
- **Exponential backoff** for transient failures
- **Response caching** to reduce monitoring load
- **SLA compliance tracking** with configurable thresholds
- **Critical vs optional service differentiation**
- **Consecutive failure tracking** with alerting
- **Real-time performance metrics** and reporting

```bash
npx tsx examples/03-api-health-monitor.ts
```

**Key Features Demonstrated:**
- ✅ Individual request monitoring with stableRequest
- ✅ Circuit breaker per service
- ✅ Exponential backoff retry strategy
- ✅ Response caching with 5-second TTL
- ✅ SLA threshold validation (200ms - 2000ms)
- ✅ Priority-based service classification
- ✅ Consecutive failure detection
- ✅ Performance metrics collection
- ✅ Cache statistics tracking
- ✅ System-wide health assessment

**Use Case:** Monitor critical API endpoints across multiple services with automatic recovery, circuit breaking, and performance tracking for production systems.

---

### Example 4: Batch Image Processing Pipeline

A high-throughput batch processing system demonstrating:
- **Concurrent batch operations** with stableApiGateway
- **Rate limiting** for API quota management
- **Concurrency control** for resource optimization
- **Priority-based request grouping** (high/normal/low)
- **Different retry strategies** per priority level
- **Partial failure handling** with detailed tracking
- **Throughput optimization** with performance metrics

```bash
npx tsx examples/04-batch-image-processing.ts
```

**Key Features Demonstrated:**
- ✅ Concurrent batch processing with stableApiGateway
- ✅ Rate limiting (20 requests/second)
- ✅ Concurrency limiting (5 concurrent requests)
- ✅ Priority-based request grouping
- ✅ Exponential backoff for high priority
- ✅ Linear backoff for normal priority
- ✅ Fixed backoff for low priority
- ✅ Partial failure tolerance
- ✅ Real-time progress tracking
- ✅ Throughput analysis (~13 images/sec)

**Use Case:** Process batches of images (thumbnails, watermarks, compression) with rate limiting, concurrent execution, and comprehensive error handling for production image processing pipelines.

---

### Example 5: Chaos Engineering & Resilience Testing

A sophisticated resilience testing framework demonstrating:
- **Trial mode** for failure simulation
- **Multiple failure scenarios** (0% to 100% failure rates)
- **Retry strategy validation** under stress
- **Error handling verification** across conditions
- **Recovery behavior analysis** with metrics
- **Automated resilience scoring** system
- **Actionable recommendations** for production readiness

```bash
npx tsx examples/05-feature-flag-testing.ts
```

**Key Features Demonstrated:**
- ✅ Trial mode for failure simulation
- ✅ Configurable failure probabilities
- ✅ Retry failure simulation
- ✅ Resilience testing across scenarios
- ✅ Exponential backoff validation
- ✅ Automated scoring (0-100 scale)
- ✅ Production readiness assessment
- ✅ Detailed failure analysis
- ✅ Recovery pattern validation
- ✅ Actionable improvement recommendations

**Use Case:** Test application resilience by simulating various failure scenarios (network issues, timeouts, intermittent errors) to ensure the system handles failures gracefully before production deployment.

---

## Architecture Patterns Demonstrated

### 1. **Multi-Phase Pipeline Pattern** (Example 1)
```
Fetch Data → Enrich → Validate → Upload → Verify
    ↓          ↓         ↓          ↓        ↓
 Parallel   Sequential  Replay   Parallel  Final
```

### 2. **Microservice Orchestration Pattern** (Example 2)
```
User Validation (Sequential, Critical)
        ↓
    ┌───┴───┐
Inventory   Payment (Concurrent, Critical, with Retry)
    └───┬───┘
        ↓
Notifications (Sequential, Optional, with Fallback)
```

### 3. **Health Monitoring Pattern** (Example 3)
```
Service 1 (Critical)   ──→  Circuit Breaker  ──→  Cache  ──→  SLA Check
Service 2 (Critical)   ──→  Circuit Breaker  ──→  Cache  ──→  SLA Check
Service 3 (Optional)   ──→  Circuit Breaker  ──→  Cache  ──→  SLA Check
        ↓                                                          ↓
    Alerting  ←────────────────────────────────────────  Metrics Collection
```

### 4. **Batch Processing Pattern** (Example 4)
```
[High Priority Jobs]    ──→  Rate Limiter  ──→  Concurrency Control  ──→  Process
[Normal Priority Jobs]  ──→  Rate Limiter  ──→  Concurrency Control  ──→  Process
[Low Priority Jobs]     ──→  Rate Limiter  ──→  Concurrency Control  ──→  Process
        ↓                                                                     ↓
    Metrics  ←─────────────────────────────────────────────────  Results Aggregation
```

### 5. **Chaos Testing Pattern** (Example 5)
```
Baseline Test (0% failure)     ──→  Validate Success
Intermittent Test (30% failure) ──→  Validate Recovery
High Failure Test (70% failure) ──→  Validate Retry Logic
Persistent Test (50% + 90%)     ──→  Validate Exhaustion
Complete Outage (100% failure)  ──→  Validate Proper Failure
        ↓                                        ↓
    Resilience Score  ←──────────────  Recommendations
```

## Advanced Features Showcased

### Resilience & Reliability
- **Circuit Breakers**: Prevent cascade failures across services
- **Exponential Backoff**: Intelligent retry with increasing delays
- **Rate Limiting**: Token bucket algorithm for API quota management
- **Concurrency Control**: Limit parallel operations to prevent overload
- **Trial Mode**: Simulate failures for resilience testing
- **Health Monitoring**: Continuous service health assessment

### Workflow Orchestration
- **Non-Linear Execution**: JUMP, SKIP, REPLAY, TERMINATE actions
- **Branch Workflows**: Independent execution paths with shared state
- **Phase Dependencies**: Control execution order and concurrency
- **Conditional Logic**: Dynamic workflow decisions based on results
- **Batch Processing**: High-throughput concurrent operations
- **Priority Queuing**: Different handling for different priority levels

### Observability & Monitoring
- **Execution History**: Track all phase executions and decisions
- **Comprehensive Metrics**: Success rates, execution times, retry counts
- **Error Tracking**: Detailed error logs with categorization
- **Circuit Breaker States**: Monitor service health in real-time
- **SLA Compliance**: Track response times against thresholds
- **Resilience Scoring**: Automated production readiness assessment

### Performance Optimization
- **Response Caching**: TTL-based caching with cache-control support
- **Request Grouping**: Different SLAs for different request types
- **Concurrent Execution**: Optimize throughput with controlled parallelism
- **Shared State Management**: Efficient data passing across phases
- **Resource Management**: Rate and concurrency limiting
- **Throughput Analysis**: Real-time performance metrics

## Production Considerations

These examples demonstrate patterns suitable for:

- **High-Availability Systems**: With circuit breakers and fallbacks
- **Large-Scale Data Processing**: With batching and rate limiting
- **Multi-Service Architectures**: With branch workflows and isolation
- **Critical Business Operations**: With comprehensive error handling
- **Monitoring Requirements**: With detailed observability hooks
- **Health Monitoring**: With SLA tracking and alerting
- **Batch Processing**: With concurrent execution and resource management
- **Resilience Testing**: With chaos engineering and failure simulation

## Core Functions Demonstrated

### stableRequest (Examples 1, 2, 3, 5)
- Individual HTTP request handling with advanced retry logic
- Circuit breaker integration for failure isolation
- Response caching for performance optimization
- Trial mode for failure simulation and testing
- Comprehensive error handling and recovery

### stableApiGateway (Example 4)
- Concurrent batch request processing
- Priority-based request grouping
- Rate and concurrency limiting
- Different retry strategies per group
- Partial failure tolerance

### stableWorkflow (Examples 1, 2)
- Multi-phase workflow orchestration
- Branch workflows for parallel execution
- Non-linear execution with phase decisions
- Shared state management across phases
- Complex conditional logic

## Customization

Each example can be customized by modifying:

1. **API Endpoints**: Replace JSONPlaceholder with your actual APIs
2. **Retry Strategies**: Adjust attempts, wait times, and strategies
3. **Circuit Breaker Thresholds**: Tune based on your service SLAs
4. **Rate Limits**: Configure based on your API quotas
5. **Business Logic**: Modify phase hooks and decision logic

## Learn More

- [Main README](../readme.md) - Library overview and quick start
- [API Reference](../docs/api-references.md) - Complete API documentation
- [Test Suite](../tests/) - Additional usage examples

---

**Note**: These examples use JSONPlaceholder (a free fake REST API) for demonstration. In production, replace with your actual service endpoints while maintaining the same orchestration patterns.
