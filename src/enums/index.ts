export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export enum PHASE_DECISION_ACTIONS {
  CONTINUE = 'continue',
  SKIP = 'skip',
  REPLAY = 'replay',
  JUMP = 'jump',
  TERMINATE = 'terminate'
}

export enum INVALID_AXIOS_RESPONSES {
  RESET = 'ECONNRESET',
  TIMEDOUT = 'ETIMEDOUT',
  REFUSED = 'ECONNREFUSED',
  NOTFOUND = 'ENOTFOUND',
  EAI_AGAIN = 'EAI_AGAIN',
}

export enum REQUEST_METHODS {
  GET = 'GET',
  POST = 'POST',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  PUT = 'PUT',
}

export enum RESPONSE_ERRORS {
  HTTP_ERROR = 'HTTP_ERROR',
  INVALID_CONTENT = 'INVALID_CONTENT',
}

export enum RETRY_STRATEGIES {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
}

export enum VALID_REQUEST_PROTOCOLS {
  HTTP = 'http',
  HTTPS = 'https',
}

export enum WorkflowNodeTypes {
  PHASE = 'phase',
  BRANCH = 'branch',
  CONDITIONAL = 'conditional',
  PARALLEL_GROUP = 'parallel-group',
  MERGE_POINT = 'merge-point'
}

export enum WorkflowEdgeConditionTypes {
  SUCCESS = 'success',
  FAILURE = 'failure',
  CUSTOM = 'custom',
  ALWAYS = 'always'
}

export enum RequestOrFunction {
  REQUEST = 'request',
  FUNCTION = 'function'
}

export enum AnomalySeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info'
}

export enum ViolationType {
  BELOW_MIN = 'below_min',
  ABOVE_MAX = 'above_max',
  OUTSIDE_TOLERANCE = 'outside_tolerance'
}

export enum PersistenceStage {
  BEFORE_HOOK = 'before_hook',
  AFTER_HOOK = 'after_hook'
}

export enum RunnerJobs {
  STABLE_REQUEST = 'stableRequest',
  STABLE_FUNCTION = 'stableFunction',
  STABLE_API_GATEWAY = 'stableApiGateway',
  STABLE_WORKFLOW = 'stableWorkflow',
  STABLE_WORKFLOW_GRAPH = 'stableWorkflowGraph'
}

export enum ScheduleTypes {
  INTERVAL = 'interval',
  CRON = 'cron',
  TIMESTAMP = 'timestamp',
  TIMESTAMPS = 'timestamps'
}

export enum InfrastructurePersistenceOperations {
  LOAD = 'load',
  STORE = 'store'
}

export enum ReplaySkipReasons {
  FILTERED = 'filtered',
  DUPLICATE = 'duplicate',
  MISSING_HANDLER = 'missing-handler'
}

export enum DistributedLockStatus {
  ACQUIRED = 'acquired',
  RELEASED = 'released',
  EXPIRED = 'expired',
  FAILED = 'failed',
  FENCED = 'fenced'
}

export enum DistributedLeaderStatus {
  LEADER = 'leader',
  FOLLOWER = 'follower',
  CANDIDATE = 'candidate',
  PARTITIONED = 'partitioned'
}

export enum DistributedOperationType {
  LOCK_ACQUIRE = 'lock:acquire',
  LOCK_RELEASE = 'lock:release',
  LOCK_EXTEND = 'lock:extend',
  LOCK_RENEW = 'lock:renew',
  STATE_GET = 'state:get',
  STATE_SET = 'state:set',
  STATE_UPDATE = 'state:update',
  STATE_DELETE = 'state:delete',
  STATE_CAS = 'state:compare-and-swap',
  LEADER_CAMPAIGN = 'leader:campaign',
  LEADER_RESIGN = 'leader:resign',
  LEADER_HEARTBEAT = 'leader:heartbeat',
  LEADER_QUORUM_CHECK = 'leader:quorum-check',
  COUNTER_INCREMENT = 'counter:increment',
  COUNTER_DECREMENT = 'counter:decrement',
  COUNTER_GET = 'counter:get',
  COUNTER_RESET = 'counter:reset',
  PUBSUB_PUBLISH = 'pubsub:publish',
  PUBSUB_SUBSCRIBE = 'pubsub:subscribe',
  TRANSACTION_BEGIN = 'transaction:begin',
  TRANSACTION_COMMIT = 'transaction:commit',
  TRANSACTION_ROLLBACK = 'transaction:rollback'
}

export enum DistributedConsistencyLevel {
  EVENTUAL = 'eventual',
  SESSION = 'session',
  STRONG = 'strong',
  LINEARIZABLE = 'linearizable'
}

export enum DistributedTransactionStatus {
  PENDING = 'pending',
  PREPARED = 'prepared',
  COMMITTED = 'committed',
  ROLLED_BACK = 'rolled-back',
  FAILED = 'failed',
  TIMEOUT = 'timeout'
}

export enum DistributedMessageDelivery {
  AT_MOST_ONCE = 'at-most-once',
  AT_LEAST_ONCE = 'at-least-once',
  EXACTLY_ONCE = 'exactly-once'
}

export enum DistributedLockRenewalMode {
  MANUAL = 'manual',
  AUTO = 'auto'
}

export enum DistributedTransactionOperationType {
  SET = 'set',
  DELETE = 'delete',
  INCREMENT = 'increment',
  DECREMENT = 'decrement',
  COMPARE_AND_SWAP = 'compare-and-swap'
}

export enum DistributedIsolationLevel {
  READ_COMMITTED = 'read-committed',
  SERIALIZABLE = 'serializable'
}

export enum DistributedBufferOperation {
  SET = 'set',
  UPDATE = 'update',
  DELETE = 'delete'
}

export enum DistributedConflictResolution {
  LAST_WRITE_WINS = 'last-write-wins',
  MERGE = 'merge',
  CUSTOM = 'custom'
}

export enum DistributedBufferKey {
  STATE = 'buffer:state',
  SYNC_CHANNEL = 'buffer:sync',
  LOCK = 'buffer:lock',
  SHARED_BUFFER = 'scheduler:shared-buffer'
}

export enum DistributedSchedulerKey {
  STATE = 'scheduler:state',
  LEADER = 'scheduler:leader',
  CIRCUIT_BREAKER = 'scheduler:circuit-breaker',
  RATE_LIMITER = 'scheduler:rate-limiter',
  CONCURRENCY_LIMITER = 'scheduler:concurrency-limiter',
  CACHE_MANAGER = 'scheduler:cache-manager'
}

export enum DistributedInfrastructureKey {
  CIRCUIT_BREAKER = 'circuit-breaker',
  RATE_LIMITER = 'rate-limiter',
  CONCURRENCY_LIMITER = 'concurrency-limiter',
  CACHE_MANAGER = 'cache-manager',
  FUNCTION_CACHE_MANAGER = 'function-cache-manager'
}