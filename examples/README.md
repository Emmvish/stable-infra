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

### Example 6: Distributed Workflow State Persistence

An enterprise-grade distributed data processing workflow demonstrating:
- **Redis-based state persistence** for workflow recovery
- **Multi-stage data pipeline** with checkpoints at each stage
- **Distributed lock mechanisms** for multi-instance safety
- **Phase completion tracking** to skip already-completed work
- **Workflow recovery and resumption** after failures
- **Real-time progress tracking** across distributed systems
- **State versioning and audit trails** for compliance
- **Hierarchical state keys** for organized storage
- **Automatic TTL-based cleanup** of completed workflows
- **Batch processing** with concurrent migrations

```bash
npx tsx examples/06-distributed-workflow-state-persistence.ts
```

**Key Features Demonstrated:**
- ✅ State persistence to Redis with TTL
- ✅ Workflow recovery and resumption after failures
- ✅ Multi-stage pipeline (Extract → Transform → Validate → Migrate → Verify)
- ✅ Distributed locking for concurrent safety
- ✅ State versioning with timestamps and version numbers
- ✅ Real-time progress tracking across instances
- ✅ Automatic cleanup of completed workflows
- ✅ Phase completion tracking and skip logic
- ✅ Hierarchical state keys (namespace:workflow:branch:phase)
- ✅ Batch processing with concurrent record migrations
- ✅ Complete audit trail of state changes
- ✅ Workflow recovery function for seamless resumption

**Use Case:** Large-scale data migration pipeline that can survive application restarts, run across multiple server instances, and resume from any checkpoint. Perfect for long-running workflows requiring resilience against infrastructure failures, database migrations, ETL pipelines, and distributed batch processing.

**Recovery Behavior Example:**
```
Initial Run (fails at Validate):
✓ Extract Source Data    → Checkpoint saved
✓ Transform Data         → Checkpoint saved
✗ Validate Data          → FAILURE

Resume Run:
⏭ Extract Source Data    → SKIPPED (already completed)
⏭ Transform Data         → SKIPPED (already completed)
✓ Validate Data          → EXECUTED
✓ Migrate Data           → EXECUTED
✓ Verify Migration       → EXECUTED
```

**State Persistence Configuration:**
```typescript
// Phase-level persistence
statePersistence: {
  persistenceFunction: persistToRedis,
  persistenceParams: { 
    ttl: 3600,              // 1 hour expiration
    enableLocking: true,     // Distributed lock
    namespace: 'migration'   // Key prefix
  },
  loadBeforeHooks: true,     // Load state before phase hooks
  storeAfterHooks: true      // Save state after phase hooks
}

// Global workflow persistence
commonStatePersistence: {
  persistenceFunction: createCheckpoint,
  persistenceParams: { ttl: 7200 },
  loadBeforeHooks: true,
  storeAfterHooks: true
}
```

**When to Use This Pattern:**
- ✅ Workflows that take more than 5 minutes to complete
- ✅ Processing large datasets (millions of records)
- ✅ Running on infrastructure that may restart (Kubernetes, cloud instances)
- ✅ Need visibility into workflow progress across systems
- ✅ Multiple instances need to coordinate work
- ✅ Failures are expensive and resumption is critical

**Production Considerations:**
- Use Redis Cluster for high availability
- Set appropriate TTL based on workflow duration
- Adjust lock timeouts based on phase execution time
- Monitor state object sizes (Redis has limits)
- Implement periodic cleanup of old workflow states
- Add metrics for state persistence operations
- Implement retry logic for Redis connection failures

---

### Example 7: Real-Time Metrics Monitoring & Performance Dashboard

A comprehensive metrics collection and analysis system demonstrating:
- **Multi-level metrics extraction** (request, phase, branch, workflow)
- **Infrastructure metrics** (circuit breaker, cache, rate limiter, concurrency limiter)
- **Real-time performance monitoring** with automated alerting
- **Health score calculation** for system assessment
- **Bottleneck identification** and optimization recommendations
- **SLA compliance tracking** with configurable thresholds
- **Performance dashboard** with detailed metric visualization
- **Request grouping** with priority-based policies

```bash
npx tsx examples/07-real-time-metrics-monitoring.ts
```

**Key Features Demonstrated:**
- ✅ MetricsAggregator utility class usage
- ✅ Multi-branch workflow with concurrent execution
- ✅ Request-level metrics (attempts, execution time)
- ✅ Phase-level metrics (throughput, completion rate)
- ✅ Branch-level metrics (parallel performance)
- ✅ Workflow-level metrics (end-to-end performance)
- ✅ Circuit breaker health monitoring
- ✅ Cache performance analysis (hit rate, efficiency)
- ✅ Rate limiter utilization tracking
- ✅ Concurrency limiter metrics
- ✅ Automated alert generation (CRITICAL/WARNING/INFO)
- ✅ Health score calculation (0-100 scale)
- ✅ SLA threshold validation
- ✅ Bottleneck identification
- ✅ Performance optimization recommendations
- ✅ Real-time monitoring hooks
- ✅ Request grouping with priority policies
- ✅ Comprehensive dashboard visualization

**Use Case:** Monitor and analyze performance of complex multi-branch workflows in production environments, identify bottlenecks, track SLA compliance, and receive automated alerts with actionable recommendations for optimization.

**Metrics Covered:**
- **Workflow**: Execution time, throughput, success rates, phase completion rates, branch statistics
- **Phases**: Individual phase performance, request distribution, decision tracking
- **Branches**: Concurrent execution performance, phase completion analysis
- **Infrastructure**: Circuit breaker state, cache efficiency, rate limiter utilization, concurrency metrics
- **Alerts**: Automated detection of performance issues, SLA violations, infrastructure problems

**Sample Output:**
```
📊 REAL-TIME METRICS DASHBOARD
================================================================================

📈 WORKFLOW METRICS:
  Workflow ID: metrics-monitoring-demo
  Status: ✅ SUCCESS
  Total Execution Time: 3847ms
  Throughput: 13.24 requests/second

  Phase Statistics:
    Completion Rate: 100.00%
    Avg Execution Time: 962.33ms

  Request Statistics:
    Total: 51 | Successful: 51 | Failed: 0
    Success Rate: 100.00%

⚙️  INFRASTRUCTURE METRICS:
  🔌 Circuit Breaker: ✅ CLOSED
    Health: ✅ Healthy
    Failure Rate: 0.00%

  💾 Cache:
    Hit Rate: 45.23%
    Network Requests Saved: 23
    Cache Efficiency: 88.76%

🏥 SYSTEM HEALTH SCORE: 100/100 (EXCELLENT)
```

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

### 6. **Distributed Workflow State Persistence Pattern** (Example 6)
```
┌─────────────────────────────────────────────────────────┐
│                  Workflow Coordinator                   │
│         (Resume from checkpoint or start fresh)          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────┐          ┌──────▼───────┐
│   Worker 1   │          │   Worker 2   │
│  (Phase 1-2) │          │  (Phase 3-5) │
└───────┬──────┘          └──────┬───────┘
        │                        │
        └────────────┬───────────┘
                     │
            ┌────────▼─────────┐
            │   Redis Store    │
            │  State + Locks   │
            │  Audit Trails    │
            └──────────────────┘

Pipeline Flow:
Extract → Transform → Validate → Migrate → Verify
   ↓          ↓          ↓          ↓         ↓
Checkpoint Checkpoint Checkpoint Checkpoint Final
   ↓          ↓          ↓          ↓         ↓
 Redis      Redis      Redis      Redis    Cleanup
```

### 7. **Real-Time Metrics Monitoring Pattern** (Example 7)
```
┌─────────────────────────────────────────────────────────────────┐
│                      Workflow Execution                         │
│  (Multi-branch with Request Grouping & Infrastructure)          │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼──────┐  ┌─────▼─────┐  ┌──────▼───────┐
│ Data Branch  │  │ Processing │  │ Enrichment   │
│  (Sequential)│  │  (Parallel)│  │  (Parallel)  │
└───────┬──────┘  └─────┬─────┘  └──────┬───────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                  │
┌───────▼────────┐              ┌─────────▼────────┐
│ Infrastructure │              │  Metrics Layer   │
│   Components   │              │   Aggregation    │
│                │              │                  │
│ • Circuit      │              │ • Workflow Level │
│   Breaker      │──────────────▶ • Branch Level   │
│ • Cache        │              │ • Phase Level    │
│ • Rate Limiter │              │ • Request Level  │
│ • Concurrency  │              │ • Infrastructure │
└────────┬───────┘              └─────────┬────────┘
         │                                 │
         └────────────────┬────────────────┘
                          │
                ┌─────────▼──────────┐
                │  Metrics Monitor   │
                │  & Alert Engine    │
                │                    │
                │ • SLA Validation   │
                │ • Threshold Checks │
                │ • Alert Generation │
                │ • Health Scoring   │
                └─────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌───────▼──────┐  ┌──────▼───────┐
│   Dashboard  │  │    Alerts    │  │ Recommendations│
│ (Visualization)│  │(CRITICAL/WARN)│ │ (Optimization) │
└──────────────┘  └──────────────┘  └────────────────┘
```

## Advanced Features Showcased

### Resilience & Reliability
- **Circuit Breakers**: Prevent cascade failures across services
- **Exponential Backoff**: Intelligent retry with increasing delays
- **Rate Limiting**: Token bucket algorithm for API quota management
- **Concurrency Control**: Limit parallel operations to prevent overload
- **Trial Mode**: Simulate failures for resilience testing
- **Health Monitoring**: Continuous service health assessment
- **State Persistence**: Redis-based workflow recovery and resumption
- **Distributed Locking**: Safe multi-instance workflow execution

### Workflow Orchestration
- **Non-Linear Execution**: JUMP, SKIP, REPLAY, TERMINATE actions
- **Branch Workflows**: Independent execution paths with shared state
- **Phase Dependencies**: Control execution order and concurrency
- **Conditional Logic**: Dynamic workflow decisions based on results
- **Batch Processing**: High-throughput concurrent operations
- **Priority Queuing**: Different handling for different priority levels
- **Checkpoint Management**: Automatic state snapshots at phase boundaries
- **Phase Skip Logic**: Automatically skip completed phases during recovery

### Observability & Monitoring
- **Execution History**: Track all phase executions and decisions
- **Comprehensive Metrics**: Success rates, execution times, retry counts
- **Error Tracking**: Detailed error logs with categorization
- **Circuit Breaker States**: Monitor service health in real-time
- **SLA Compliance**: Track response times against thresholds
- **Resilience Scoring**: Automated production readiness assessment
- **State Versioning**: Track all state changes with timestamps
- **Audit Trails**: Complete history of workflow state modifications
- **Progress Tracking**: Real-time workflow progress visibility across instances
- **Metrics Aggregation**: Multi-level metrics extraction (request → system)
- **Performance Dashboards**: Real-time visualization of all metrics
- **Automated Alerting**: CRITICAL/WARNING/INFO alerts with recommendations
- **Health Scoring**: 0-100 system health score calculation
- **Bottleneck Detection**: Identify performance bottlenecks automatically

### Performance Optimization
- **Response Caching**: TTL-based caching with cache-control support
- **Request Grouping**: Different SLAs for different request types
- **Concurrent Execution**: Optimize throughput with controlled parallelism
- **Shared State Management**: Efficient data passing across phases
- **Resource Management**: Rate and concurrency limiting
- **Throughput Analysis**: Real-time performance metrics
- **Cache Efficiency Tracking**: Hit rates and network request savings
- **Performance Profiling**: Detailed execution time analysis

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
- **Distributed Workflows**: With state persistence and recovery
- **Long-Running Operations**: With checkpoint-based resumption
- **Performance Optimization**: With metrics-driven insights and bottleneck detection
- **Real-Time Monitoring**: With automated alerting and health scoring

## Core Functions Demonstrated

### stableRequest (Examples 1, 2, 3, 5, 7)
- Individual HTTP request handling with advanced retry logic
- Circuit breaker integration for failure isolation
- Response caching for performance optimization
- Trial mode for failure simulation and testing
- Comprehensive error handling and recovery
- Detailed request-level metrics collection

### stableApiGateway (Example 4)
- Concurrent batch request processing
- Priority-based request grouping
- Rate and concurrency limiting
- Different retry strategies per group
- Partial failure tolerance
- Gateway-level metrics aggregation

### stableWorkflow (Examples 1, 2, 6, 7)
- Multi-phase workflow orchestration
- Branch workflows for parallel execution
- Non-linear execution with phase decisions
- Shared state management across phases
- Complex conditional logic
- State persistence for workflow recovery
- Distributed execution with locking
- Comprehensive workflow-level metrics

### MetricsAggregator (Example 7)
- Multi-level metrics extraction (request → system)
- Workflow metrics computation
- Branch and phase metrics analysis
- Infrastructure metrics collection
- Request group metrics aggregation
- System-wide metrics aggregation

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
