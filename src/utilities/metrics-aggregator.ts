import {
    STABLE_WORKFLOW_RESULT,
    STABLE_WORKFLOW_PHASE_RESULT,
    API_GATEWAY_RESPONSE,
    BranchExecutionResult,
    WorkflowMetrics,
    BranchMetrics,
    PhaseMetrics,
    RequestGroupMetrics,
    RequestMetrics,
    CircuitBreakerDashboardMetrics,
    CacheDashboardMetrics,
    RateLimiterDashboardMetrics,
    ConcurrencyLimiterDashboardMetrics,
    SystemMetrics
} from '../types/index.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { CacheManager } from './cache-manager.js';
import { RateLimiter } from './rate-limiter.js';
import { ConcurrencyLimiter } from './concurrency-limiter.js';

/**
 * Metrics Aggregator - Extracts and computes all metrics from workflow results
 */
export class MetricsAggregator {
    /**
     * Extract comprehensive workflow metrics
     */
    static extractWorkflowMetrics<T = any>(
        result: STABLE_WORKFLOW_RESULT<T>
    ): WorkflowMetrics {
        const skippedPhases = result.phases.filter(p => p.skipped).length;
        const failedPhases = result.phases.filter(p => !p.success && !p.skipped).length;
        
        const phaseReplays = result.executionHistory.filter(
            (record, index, arr) => 
                arr.filter(r => r.phaseId === record.phaseId).length > 1
        ).length;
        
        const throughput = result.executionTime > 0 
            ? (result.totalRequests / (result.executionTime / 1000))
            : 0;
        
        const metrics: WorkflowMetrics = {
            workflowId: result.workflowId,
            success: result.success,
            executionTime: result.executionTime,
            timestamp: result.timestamp,
            
            totalPhases: result.totalPhases,
            completedPhases: result.completedPhases,
            skippedPhases: skippedPhases,
            failedPhases: failedPhases,
            phaseCompletionRate: result.totalPhases > 0 
                ? (result.completedPhases / result.totalPhases) * 100 
                : 0,
            averagePhaseExecutionTime: result.phases.length > 0
                ? result.phases.reduce((sum, p) => sum + p.executionTime, 0) / result.phases.length
                : 0,
            
            totalRequests: result.totalRequests,
            successfulRequests: result.successfulRequests,
            failedRequests: result.failedRequests,
            requestSuccessRate: result.totalRequests > 0 
                ? (result.successfulRequests / result.totalRequests) * 100 
                : 0,
            requestFailureRate: result.totalRequests > 0 
                ? (result.failedRequests / result.totalRequests) * 100 
                : 0,
            
            terminatedEarly: result.terminatedEarly || false,
            terminationReason: result.terminationReason,
            totalPhaseReplays: phaseReplays,
            totalPhaseSkips: skippedPhases,
            
            throughput: throughput
        };
        
        // Add branch metrics if available
        if (result.branches && result.branches.length > 0) {
            const completedBranches = result.branches.filter(b => !b.skipped && b.success).length;
            const failedBranches = result.branches.filter(b => !b.success && !b.skipped).length;
            
            metrics.totalBranches = result.branches.length;
            metrics.completedBranches = completedBranches;
            metrics.failedBranches = failedBranches;
            metrics.branchSuccessRate = result.branches.length > 0
                ? (completedBranches / result.branches.length) * 100
                : 0;
        }
        
        return metrics;
    }
    
    /**
     * Extract branch metrics
     */
    static extractBranchMetrics<T = any>(
        branch: BranchExecutionResult<T>
    ): BranchMetrics {
        const failedPhases = branch.phaseResults.filter(p => !p.success && !p.skipped).length;
        const totalRequests = branch.phaseResults.reduce((sum, p) => sum + p.totalRequests, 0);
        const successfulRequests = branch.phaseResults.reduce((sum, p) => sum + p.successfulRequests, 0);
        const failedRequests = branch.phaseResults.reduce((sum, p) => sum + p.failedRequests, 0);
        
        return {
            branchId: branch.branchId,
            branchIndex: branch.branchIndex,
            executionNumber: branch.executionNumber,
            success: branch.success,
            executionTime: branch.executionTime,
            skipped: branch.skipped || false,
            
            totalPhases: branch.phaseResults.length,
            completedPhases: branch.completedPhases,
            failedPhases: failedPhases,
            phaseCompletionRate: branch.phaseResults.length > 0
                ? (branch.completedPhases / branch.phaseResults.length) * 100
                : 0,
            
            totalRequests: totalRequests,
            successfulRequests: successfulRequests,
            failedRequests: failedRequests,
            requestSuccessRate: totalRequests > 0
                ? (successfulRequests / totalRequests) * 100
                : 0,
            
            hasDecision: !!branch.decision,
            decisionAction: branch.decision?.action,
            
            error: branch.error
        };
    }
    
    /**
     * Extract phase metrics
     */
    static extractPhaseMetrics<T = any>(
        phase: STABLE_WORKFLOW_PHASE_RESULT<T>
    ): PhaseMetrics {
        return {
            phaseId: phase.phaseId,
            phaseIndex: phase.phaseIndex,
            workflowId: phase.workflowId,
            branchId: phase.branchId,
            executionNumber: phase.executionNumber || 0,
            
            success: phase.success,
            skipped: phase.skipped || false,
            executionTime: phase.executionTime,
            timestamp: phase.timestamp,
            
            totalRequests: phase.totalRequests,
            successfulRequests: phase.successfulRequests,
            failedRequests: phase.failedRequests,
            requestSuccessRate: phase.totalRequests > 0
                ? (phase.successfulRequests / phase.totalRequests) * 100
                : 0,
            requestFailureRate: phase.totalRequests > 0
                ? (phase.failedRequests / phase.totalRequests) * 100
                : 0,
            
            hasDecision: !!phase.decision,
            decisionAction: phase.decision?.action,
            targetPhaseId: phase.decision?.targetPhaseId,
            replayCount: phase.decision?.replayCount,
            
            error: phase.error
        };
    }
    
    /**
     * Extract request group metrics
     */
    static extractRequestGroupMetrics<T = any>(
        responses: API_GATEWAY_RESPONSE<T>[]
    ): RequestGroupMetrics[] {
        const groupMap = new Map<string, API_GATEWAY_RESPONSE<T>[]>();
        
        // Group responses by groupId
        responses.forEach(response => {
            const groupId = response.groupId || 'default';
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, []);
            }
            groupMap.get(groupId)!.push(response);
        });
        
        // Calculate metrics for each group
        return Array.from(groupMap.entries()).map(([groupId, groupResponses]) => {
            const successfulRequests = groupResponses.filter(r => r.success).length;
            const failedRequests = groupResponses.filter(r => !r.success).length;
            const totalRequests = groupResponses.length;
            
            return {
                groupId,
                totalRequests,
                successfulRequests,
                failedRequests,
                successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0,
                failureRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
                requestIds: groupResponses.map(r => r.requestId)
            };
        });
    }
    
    /**
     * Extract individual request metrics
     */
    static extractRequestMetrics<T = any>(
        responses: API_GATEWAY_RESPONSE<T>[]
    ): RequestMetrics[] {
        return responses.map(response => ({
            requestId: response.requestId,
            groupId: response.groupId,
            success: response.success,
            hasError: !!response.error,
            errorMessage: response.error
        }));
    }
    
    /**
     * Extract circuit breaker dashboard metrics
     */
    static extractCircuitBreakerMetrics(
        circuitBreaker: CircuitBreaker
    ): CircuitBreakerDashboardMetrics {
        const state = circuitBreaker.getState();
        const now = Date.now();
        const timeSinceLastStateChange = now - state.lastStateChangeTime;
        const timeUntilRecovery = state.openUntil ? Math.max(0, state.openUntil - now) : null;
        
        return {
            state: state.state,
            isHealthy: state.state !== 'OPEN',
            
            totalRequests: state.totalRequests,
            successfulRequests: state.successfulRequests,
            failedRequests: state.failedRequests,
            failurePercentage: state.failurePercentage,
            
            stateTransitions: state.stateTransitions,
            lastStateChangeTime: state.lastStateChangeTime,
            timeSinceLastStateChange: timeSinceLastStateChange,
            
            openCount: state.openCount,
            totalOpenDuration: state.totalOpenDuration,
            averageOpenDuration: state.averageOpenDuration,
            isCurrentlyOpen: state.state === 'OPEN',
            openUntil: state.openUntil,
            timeUntilRecovery: timeUntilRecovery,
            
            recoveryAttempts: state.recoveryAttempts,
            successfulRecoveries: state.successfulRecoveries,
            failedRecoveries: state.failedRecoveries,
            recoverySuccessRate: state.recoverySuccessRate,
            
            config: {
                failureThresholdPercentage: state.config.failureThresholdPercentage,
                minimumRequests: state.config.minimumRequests,
                recoveryTimeoutMs: state.config.recoveryTimeoutMs,
                successThresholdPercentage: state.config.successThresholdPercentage,
                halfOpenMaxRequests: state.config.halfOpenMaxRequests
            }
        };
    }
    
    /**
     * Extract cache dashboard metrics
     */
    static extractCacheMetrics(
        cache: CacheManager
    ): CacheDashboardMetrics {
        const stats = cache.getStats();
        const now = Date.now();
        
        return {
            isEnabled: true,
            
            currentSize: stats.size,
            maxSize: stats.maxSize,
            validEntries: stats.validEntries,
            expiredEntries: stats.expiredEntries,
            utilizationPercentage: stats.utilizationPercentage,
            
            totalRequests: stats.totalRequests,
            hits: stats.hits,
            misses: stats.misses,
            hitRate: stats.hitRate,
            missRate: stats.missRate,
            
            sets: stats.sets,
            evictions: stats.evictions,
            expirations: stats.expirations,
            
            averageGetTime: stats.averageGetTime,
            averageSetTime: stats.averageSetTime,
            averageCacheAge: stats.averageCacheAge,
            
            oldestEntryAge: stats.oldestEntry ? now - stats.oldestEntry : null,
            newestEntryAge: stats.newestEntry ? now - stats.newestEntry : null,
            
            networkRequestsSaved: stats.hits,
            cacheEfficiency: stats.hitRate
        };
    }
    
    /**
     * Extract rate limiter dashboard metrics
     */
    static extractRateLimiterMetrics(
        rateLimiter: RateLimiter
    ): RateLimiterDashboardMetrics {
        const state = rateLimiter.getState();
        const averageRequestRate = state.completedRequests > 0
            ? state.totalRequests / (state.windowMs / 1000)
            : 0;
        
        return {
            maxRequests: state.maxRequests,
            windowMs: state.windowMs,
            
            availableTokens: state.availableTokens,
            queueLength: state.queueLength,
            requestsInCurrentWindow: state.requestsInCurrentWindow,
            
            totalRequests: state.totalRequests,
            completedRequests: state.completedRequests,
            throttledRequests: state.throttledRequests,
            throttleRate: state.throttleRate,
            
            currentRequestRate: state.currentRequestRate,
            peakRequestRate: state.peakRequestRate,
            averageRequestRate: averageRequestRate,
            
            peakQueueLength: state.peakQueueLength,
            averageQueueWaitTime: state.averageQueueWaitTime,
            
            isThrottling: state.queueLength > 0 || state.availableTokens === 0,
            utilizationPercentage: (state.requestsInCurrentWindow / state.maxRequests) * 100
        };
    }
    
    /**
     * Extract concurrency limiter dashboard metrics
     */
    static extractConcurrencyLimiterMetrics(
        concurrencyLimiter: ConcurrencyLimiter
    ): ConcurrencyLimiterDashboardMetrics {
        const state = concurrencyLimiter.getState();
        
        return {
            limit: state.limit,
            
            running: state.running,
            queueLength: state.queueLength,
            utilizationPercentage: state.utilizationPercentage,
            
            totalRequests: state.totalRequests,
            completedRequests: state.completedRequests,
            failedRequests: state.failedRequests,
            queuedRequests: state.queuedRequests,
            successRate: state.successRate,
            
            peakConcurrency: state.peakConcurrency,
            averageConcurrency: state.running, // Current as average approximation
            concurrencyUtilization: state.utilizationPercentage,
            
            peakQueueLength: state.peakQueueLength,
            averageQueueWaitTime: state.averageQueueWaitTime,
            
            averageExecutionTime: state.averageExecutionTime,
            
            isAtCapacity: state.running >= state.limit,
            hasQueuedRequests: state.queueLength > 0
        };
    }
    
    /**
     * Aggregate all metrics from a workflow result
     */
    static aggregateSystemMetrics<T = any>(
        workflowResult: STABLE_WORKFLOW_RESULT<T>,
        circuitBreaker?: CircuitBreaker,
        cache?: CacheManager,
        rateLimiter?: RateLimiter,
        concurrencyLimiter?: ConcurrencyLimiter
    ): SystemMetrics {
        // Extract all responses from phases
        const allResponses = workflowResult.phases.flatMap(phase => phase.responses);
        
        const metrics: SystemMetrics = {
            workflow: this.extractWorkflowMetrics(workflowResult),
            branches: workflowResult.branches 
                ? workflowResult.branches.map(b => this.extractBranchMetrics(b))
                : [],
            phases: workflowResult.phases.map(p => this.extractPhaseMetrics(p)),
            requestGroups: this.extractRequestGroupMetrics(allResponses),
            requests: this.extractRequestMetrics(allResponses)
        };
        
        // Add optional utility metrics
        if (circuitBreaker) {
            metrics.circuitBreaker = this.extractCircuitBreakerMetrics(circuitBreaker);
        }
        
        if (cache) {
            metrics.cache = this.extractCacheMetrics(cache);
        }
        
        if (rateLimiter) {
            metrics.rateLimiter = this.extractRateLimiterMetrics(rateLimiter);
        }
        
        if (concurrencyLimiter) {
            metrics.concurrencyLimiter = this.extractConcurrencyLimiterMetrics(concurrencyLimiter);
        }
        
        return metrics;
    }
}
