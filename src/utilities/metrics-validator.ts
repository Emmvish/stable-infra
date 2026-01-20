import type {
  MetricGuardrail,
  MetricsGuardrails,
  MetricAnomaly,
  MetricsValidationResult
} from '../types/index.js';
import { AnomalySeverity as AnomalySeverityEnum, ViolationType as ViolationTypeEnum } from '../enums/index.js';
import {
  REQUEST_METRICS_TO_VALIDATE_KEYS,
  API_GATEWAY_METRICS_TO_VALIDATE_KEYS,
  WORKFLOW_METRICS_TO_VALIDATE_KEYS,
  CIRCUIT_BREAKER_METRICS_TO_VALIDATE_KEYS,
  CACHE_METRICS_TO_VALIDATE_KEYS,
  RATE_LIMITER_METRICS_TO_VALIDATE_KEYS,
  CONCURRENCY_LIMITER_METRICS_TO_VALIDATE_KEYS,
  PHASE_METRICS_TO_VALIDATE_KEYS,
  BRANCH_METRICS_TO_VALIDATE_KEYS
} from '../constants/index.js';

export class MetricsValidator {
  private static validateMetric(
    metricName: string,
    metricValue: number,
    guardrail: MetricGuardrail
  ): MetricAnomaly | null {
    if (guardrail.min !== undefined && metricValue < guardrail.min) {
      return {
        metricName,
        metricValue,
        guardrail,
        severity: this.determineSeverity(metricValue, guardrail, ViolationTypeEnum.BELOW_MIN),
        reason: `${metricName} (${metricValue.toFixed(2)}) is below minimum threshold (${guardrail.min})`,
        violationType: ViolationTypeEnum.BELOW_MIN
      };
    }
    
    if (guardrail.max !== undefined && metricValue > guardrail.max) {
      return {
        metricName,
        metricValue,
        guardrail,
        severity: this.determineSeverity(metricValue, guardrail, ViolationTypeEnum.ABOVE_MAX),
        reason: `${metricName} (${metricValue.toFixed(2)}) exceeds maximum threshold (${guardrail.max})`,
        violationType: ViolationTypeEnum.ABOVE_MAX
      };
    }
    
    if (guardrail.expected !== undefined && guardrail.tolerance !== undefined) {
      const lowerBound = guardrail.expected * (1 - guardrail.tolerance / 100);
      const upperBound = guardrail.expected * (1 + guardrail.tolerance / 100);
      
      if (metricValue < lowerBound || metricValue > upperBound) {
        return {
          metricName,
          metricValue,
          guardrail,
          severity: this.determineSeverity(metricValue, guardrail, ViolationTypeEnum.OUTSIDE_TOLERANCE),
          reason: `${metricName} (${metricValue.toFixed(2)}) is outside expected range (${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)}, expected: ${guardrail.expected} ±${guardrail.tolerance}%)`,
          violationType: ViolationTypeEnum.OUTSIDE_TOLERANCE
        };
      }
    }
    
    return null;
  }
  
  private static determineSeverity(
    value: number,
    guardrail: MetricGuardrail,
    violationType: ViolationTypeEnum
  ): AnomalySeverityEnum {
    if (violationType === ViolationTypeEnum.BELOW_MIN && guardrail.min !== undefined) {
      const deviation = ((guardrail.min - value) / guardrail.min) * 100;
      if (deviation > 50) return AnomalySeverityEnum.CRITICAL;
      if (deviation > 20) return AnomalySeverityEnum.WARNING;
      return AnomalySeverityEnum.INFO;
    }
    
    if (violationType === ViolationTypeEnum.ABOVE_MAX && guardrail.max !== undefined) {
      const deviation = ((value - guardrail.max) / guardrail.max) * 100;
      if (deviation > 50) return AnomalySeverityEnum.CRITICAL;
      if (deviation > 20) return AnomalySeverityEnum.WARNING;
      return AnomalySeverityEnum.INFO;
    }
    
    if (violationType === ViolationTypeEnum.OUTSIDE_TOLERANCE && guardrail.expected !== undefined && guardrail.tolerance !== undefined) {
      const deviation = Math.abs((value - guardrail.expected) / guardrail.expected) * 100;
      if (deviation > guardrail.tolerance * 2) return AnomalySeverityEnum.CRITICAL;
      if (deviation > guardrail.tolerance * 1.5) return AnomalySeverityEnum.WARNING;
      return AnomalySeverityEnum.INFO;
    }
    
    return AnomalySeverityEnum.WARNING;
  }
  
  static validateRequestMetrics(
    metrics: {
      totalAttempts?: number;
      successfulAttempts?: number;
      failedAttempts?: number;
      totalExecutionTime?: number;
      averageAttemptTime?: number;
    },
    guardrails: MetricsGuardrails
  ): MetricsValidationResult {
    const anomalies: MetricAnomaly[] = [];
    const requestGuardrails = guardrails.request || {};
    
    const metricsToValidate: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
      { name: REQUEST_METRICS_TO_VALIDATE_KEYS[0], value: metrics.totalAttempts, guardrail: requestGuardrails.totalAttempts },
      { name: REQUEST_METRICS_TO_VALIDATE_KEYS[1], value: metrics.successfulAttempts, guardrail: requestGuardrails.successfulAttempts },
      { name: REQUEST_METRICS_TO_VALIDATE_KEYS[2], value: metrics.failedAttempts, guardrail: requestGuardrails.failedAttempts },
      { name: REQUEST_METRICS_TO_VALIDATE_KEYS[3], value: metrics.totalExecutionTime, guardrail: requestGuardrails.totalExecutionTime || guardrails.common?.executionTime },
      { name: REQUEST_METRICS_TO_VALIDATE_KEYS[4], value: metrics.averageAttemptTime, guardrail: requestGuardrails.averageAttemptTime }
    ];
    
    for (const { name, value, guardrail } of metricsToValidate) {
      if (value !== undefined && guardrail) {
        const anomaly = this.validateMetric(name, value, guardrail);
        if (anomaly) anomalies.push(anomaly);
      }
    }
    
    return {
      isValid: anomalies.length === 0,
      anomalies,
      validatedAt: new Date().toISOString()
    };
  }
  
  static validateApiGatewayMetrics(
    metrics: {
      totalRequests?: number;
      successfulRequests?: number;
      failedRequests?: number;
      successRate?: number;
      failureRate?: number;
      executionTime?: number;
      throughput?: number;
      averageRequestDuration?: number;
    },
    guardrails: MetricsGuardrails
  ): MetricsValidationResult {
    const anomalies: MetricAnomaly[] = [];
    const gatewayGuardrails = guardrails.apiGateway || {};
    
    const metricsToValidate: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[0], value: metrics.totalRequests, guardrail: gatewayGuardrails.totalRequests },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[1], value: metrics.successfulRequests, guardrail: gatewayGuardrails.successfulRequests },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[2], value: metrics.failedRequests, guardrail: gatewayGuardrails.failedRequests },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[3], value: metrics.successRate, guardrail: gatewayGuardrails.successRate || guardrails.common?.successRate },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[4], value: metrics.failureRate, guardrail: gatewayGuardrails.failureRate || guardrails.common?.failureRate },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[5], value: metrics.executionTime, guardrail: gatewayGuardrails.executionTime || guardrails.common?.executionTime },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[6], value: metrics.throughput, guardrail: gatewayGuardrails.throughput || guardrails.common?.throughput },
      { name: API_GATEWAY_METRICS_TO_VALIDATE_KEYS[7], value: metrics.averageRequestDuration, guardrail: gatewayGuardrails.averageRequestDuration }
    ];
    
    for (const { name, value, guardrail } of metricsToValidate) {
      if (value !== undefined && guardrail) {
        const anomaly = this.validateMetric(name, value, guardrail);
        if (anomaly) anomalies.push(anomaly);
      }
    }
    
    return {
      isValid: anomalies.length === 0,
      anomalies,
      validatedAt: new Date().toISOString()
    };
  }
  
  static validateWorkflowMetrics(
    metrics: {
      totalPhases?: number;
      completedPhases?: number;
      failedPhases?: number;
      totalRequests?: number;
      successfulRequests?: number;
      failedRequests?: number;
      requestSuccessRate?: number;
      requestFailureRate?: number;
      executionTime?: number;
      averagePhaseExecutionTime?: number;
      throughput?: number;
      phaseCompletionRate?: number;
    },
    guardrails: MetricsGuardrails
  ): MetricsValidationResult {
    const anomalies: MetricAnomaly[] = [];
    const workflowGuardrails = guardrails.workflow || {};
    
    const metricsToValidate: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[0], value: metrics.totalPhases, guardrail: workflowGuardrails.totalPhases },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[1], value: metrics.completedPhases, guardrail: workflowGuardrails.completedPhases },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[2], value: metrics.failedPhases, guardrail: workflowGuardrails.failedPhases },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[3], value: metrics.totalRequests, guardrail: workflowGuardrails.totalRequests },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[4], value: metrics.successfulRequests, guardrail: workflowGuardrails.successfulRequests },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[5], value: metrics.failedRequests, guardrail: workflowGuardrails.failedRequests },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[6], value: metrics.requestSuccessRate, guardrail: workflowGuardrails.requestSuccessRate || guardrails.common?.successRate },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[7], value: metrics.requestFailureRate, guardrail: workflowGuardrails.requestFailureRate || guardrails.common?.failureRate },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[8], value: metrics.executionTime, guardrail: workflowGuardrails.executionTime || guardrails.common?.executionTime },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[9], value: metrics.averagePhaseExecutionTime, guardrail: workflowGuardrails.averagePhaseExecutionTime },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[10], value: metrics.throughput, guardrail: workflowGuardrails.throughput || guardrails.common?.throughput },
      { name: WORKFLOW_METRICS_TO_VALIDATE_KEYS[11], value: metrics.phaseCompletionRate, guardrail: workflowGuardrails.phaseCompletionRate }
    ];
    
    for (const { name, value, guardrail } of metricsToValidate) {
      if (value !== undefined && guardrail) {
        const anomaly = this.validateMetric(name, value, guardrail);
        if (anomaly) anomalies.push(anomaly);
      }
    }
    
    return {
      isValid: anomalies.length === 0,
      anomalies,
      validatedAt: new Date().toISOString()
    };
  }
  
  static validatePhaseMetrics(
    metrics: {
      totalRequests?: number;
      successfulRequests?: number;
      failedRequests?: number;
      requestSuccessRate?: number;
      requestFailureRate?: number;
      executionTime?: number;
    },
    guardrails: MetricsGuardrails
  ): MetricsValidationResult {
    const anomalies: MetricAnomaly[] = [];
    const phaseGuardrails = guardrails.phase || {};
    
    const metricsToValidate: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
      { name: PHASE_METRICS_TO_VALIDATE_KEYS[0], value: metrics.totalRequests, guardrail: phaseGuardrails.totalRequests },
      { name: PHASE_METRICS_TO_VALIDATE_KEYS[1], value: metrics.successfulRequests, guardrail: phaseGuardrails.successfulRequests },
      { name: PHASE_METRICS_TO_VALIDATE_KEYS[2], value: metrics.failedRequests, guardrail: phaseGuardrails.failedRequests },
      { name: PHASE_METRICS_TO_VALIDATE_KEYS[3], value: metrics.requestSuccessRate, guardrail: phaseGuardrails.requestSuccessRate || guardrails.common?.successRate },
      { name: PHASE_METRICS_TO_VALIDATE_KEYS[4], value: metrics.requestFailureRate, guardrail: phaseGuardrails.requestFailureRate || guardrails.common?.failureRate },
      { name: PHASE_METRICS_TO_VALIDATE_KEYS[5], value: metrics.executionTime, guardrail: phaseGuardrails.executionTime || guardrails.common?.executionTime }
    ];
    
    for (const { name, value, guardrail } of metricsToValidate) {
      if (value !== undefined && guardrail) {
        const anomaly = this.validateMetric(name, value, guardrail);
        if (anomaly) anomalies.push(anomaly);
      }
    }
    
    return {
      isValid: anomalies.length === 0,
      anomalies,
      validatedAt: new Date().toISOString()
    };
  }
  
  static validateBranchMetrics(
    metrics: {
      totalPhases?: number;
      completedPhases?: number;
      failedPhases?: number;
      phaseCompletionRate?: number;
      totalRequests?: number;
      successfulRequests?: number;
      failedRequests?: number;
      requestSuccessRate?: number;
      executionTime?: number;
    },
    guardrails: MetricsGuardrails
  ): MetricsValidationResult {
    const anomalies: MetricAnomaly[] = [];
    const branchGuardrails = guardrails.branch || {};
    
    const metricsToValidate: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[0], value: metrics.totalPhases, guardrail: branchGuardrails.totalPhases },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[1], value: metrics.completedPhases, guardrail: branchGuardrails.completedPhases },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[2], value: metrics.failedPhases, guardrail: branchGuardrails.failedPhases },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[3], value: metrics.phaseCompletionRate, guardrail: branchGuardrails.phaseCompletionRate },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[4], value: metrics.totalRequests, guardrail: branchGuardrails.totalRequests },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[5], value: metrics.successfulRequests, guardrail: branchGuardrails.successfulRequests },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[6], value: metrics.failedRequests, guardrail: branchGuardrails.failedRequests },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[7], value: metrics.requestSuccessRate, guardrail: branchGuardrails.requestSuccessRate || guardrails.common?.successRate },
      { name: BRANCH_METRICS_TO_VALIDATE_KEYS[8], value: metrics.executionTime, guardrail: branchGuardrails.executionTime || guardrails.common?.executionTime }
    ];
    
    for (const { name, value, guardrail } of metricsToValidate) {
      if (value !== undefined && guardrail) {
        const anomaly = this.validateMetric(name, value, guardrail);
        if (anomaly) anomalies.push(anomaly);
      }
    }
    
    return {
      isValid: anomalies.length === 0,
      anomalies,
      validatedAt: new Date().toISOString()
    };
  }
  
  static validateInfrastructureMetrics(
    infrastructureMetrics: {
      circuitBreaker?: {
        failureRate?: number;
        totalRequests?: number;
        failedRequests?: number;
      };
      cache?: {
        hitRate?: number;
        missRate?: number;
        utilizationPercentage?: number;
        evictionRate?: number;
      };
      rateLimiter?: {
        throttleRate?: number;
        queueLength?: number;
        utilizationPercentage?: number;
        averageQueueWaitTime?: number;
      };
      concurrencyLimiter?: {
        utilizationPercentage?: number;
        queueLength?: number;
        averageQueueWaitTime?: number;
      };
    },
    guardrails: MetricsGuardrails
  ): MetricsValidationResult {
    const anomalies: MetricAnomaly[] = [];
    const infraGuardrails = guardrails.infrastructure || {};
    
    if (infrastructureMetrics.circuitBreaker && infraGuardrails.circuitBreaker) {
      const cb = infrastructureMetrics.circuitBreaker;
      const cbGuardrails = infraGuardrails.circuitBreaker;
      
      const cbMetrics: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
        { name: `circuitBreaker.${CIRCUIT_BREAKER_METRICS_TO_VALIDATE_KEYS[0]}`, value: cb.failureRate, guardrail: cbGuardrails.failureRate },
        { name: `circuitBreaker.${CIRCUIT_BREAKER_METRICS_TO_VALIDATE_KEYS[1]}`, value: cb.totalRequests, guardrail: cbGuardrails.totalRequests },
        { name: `circuitBreaker.${CIRCUIT_BREAKER_METRICS_TO_VALIDATE_KEYS[2]}`, value: cb.failedRequests, guardrail: cbGuardrails.failedRequests }
      ];
      
      for (const { name, value, guardrail } of cbMetrics) {
        if (value !== undefined && guardrail) {
          const anomaly = this.validateMetric(name, value, guardrail);
          if (anomaly) anomalies.push(anomaly);
        }
      }
    }
    
    if (infrastructureMetrics.cache && infraGuardrails.cache) {
      const cache = infrastructureMetrics.cache;
      const cacheGuardrails = infraGuardrails.cache;
      
      const cacheMetrics: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
        { name: `cache.${CACHE_METRICS_TO_VALIDATE_KEYS[0]}`, value: cache.hitRate, guardrail: cacheGuardrails.hitRate },
        { name: `cache.${CACHE_METRICS_TO_VALIDATE_KEYS[1]}`, value: cache.missRate, guardrail: cacheGuardrails.missRate },
        { name: `cache.${CACHE_METRICS_TO_VALIDATE_KEYS[2]}`, value: cache.utilizationPercentage, guardrail: cacheGuardrails.utilizationPercentage },
        { name: `cache.${CACHE_METRICS_TO_VALIDATE_KEYS[3]}`, value: cache.evictionRate, guardrail: cacheGuardrails.evictionRate }
      ];
      
      for (const { name, value, guardrail } of cacheMetrics) {
        if (value !== undefined && guardrail) {
          const anomaly = this.validateMetric(name, value, guardrail);
          if (anomaly) anomalies.push(anomaly);
        }
      }
    }
    
    if (infrastructureMetrics.rateLimiter && infraGuardrails.rateLimiter) {
      const rl = infrastructureMetrics.rateLimiter;
      const rlGuardrails = infraGuardrails.rateLimiter;
      
      const rlMetrics: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
        { name: `rateLimiter.${RATE_LIMITER_METRICS_TO_VALIDATE_KEYS[0]}`, value: rl.throttleRate, guardrail: rlGuardrails.throttleRate },
        { name: `rateLimiter.${RATE_LIMITER_METRICS_TO_VALIDATE_KEYS[1]}`, value: rl.queueLength, guardrail: rlGuardrails.queueLength },
        { name: `rateLimiter.${RATE_LIMITER_METRICS_TO_VALIDATE_KEYS[2]}`, value: rl.utilizationPercentage, guardrail: rlGuardrails.utilizationPercentage },
        { name: `rateLimiter.${RATE_LIMITER_METRICS_TO_VALIDATE_KEYS[3]}`, value: rl.averageQueueWaitTime, guardrail: rlGuardrails.averageQueueWaitTime }
      ];
      
      for (const { name, value, guardrail } of rlMetrics) {
        if (value !== undefined && guardrail) {
          const anomaly = this.validateMetric(name, value, guardrail);
          if (anomaly) anomalies.push(anomaly);
        }
      }
    }
    
    if (infrastructureMetrics.concurrencyLimiter && infraGuardrails.concurrencyLimiter) {
      const cl = infrastructureMetrics.concurrencyLimiter;
      const clGuardrails = infraGuardrails.concurrencyLimiter;
      
      const clMetrics: Array<{ name: string; value: number | undefined; guardrail: MetricGuardrail | undefined }> = [
        { name: `concurrencyLimiter.${CONCURRENCY_LIMITER_METRICS_TO_VALIDATE_KEYS[0]}`, value: cl.utilizationPercentage, guardrail: clGuardrails.utilizationPercentage },
        { name: `concurrencyLimiter.${CONCURRENCY_LIMITER_METRICS_TO_VALIDATE_KEYS[1]}`, value: cl.queueLength, guardrail: clGuardrails.queueLength },
        { name: `concurrencyLimiter.${CONCURRENCY_LIMITER_METRICS_TO_VALIDATE_KEYS[2]}`, value: cl.averageQueueWaitTime, guardrail: clGuardrails.averageQueueWaitTime }
      ];
      
      for (const { name, value, guardrail } of clMetrics) {
        if (value !== undefined && guardrail) {
          const anomaly = this.validateMetric(name, value, guardrail);
          if (anomaly) anomalies.push(anomaly);
        }
      }
    }
    
    return {
      isValid: anomalies.length === 0,
      anomalies,
      validatedAt: new Date().toISOString()
    };
  }
}
