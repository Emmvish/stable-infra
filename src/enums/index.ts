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