import { CircuitBreakerConfig } from '../types/index.js';
import { CircuitBreakerState } from '../enums/index.js';

export class CircuitBreaker {
    private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    private readonly config: Required<CircuitBreakerConfig>;
    
    private totalRequests: number = 0;
    private failedRequests: number = 0;
    private successfulRequests: number = 0;
    
    private totalAttempts: number = 0;
    private failedAttempts: number = 0;
    private successfulAttempts: number = 0;
    
    private lastFailureTime: number = 0;
    private halfOpenRequests: number = 0;
    private halfOpenSuccesses: number = 0;
    private halfOpenFailures: number = 0;

    constructor(config: CircuitBreakerConfig) {
        this.config = {
            failureThresholdPercentage: Math.max(0, Math.min(100, config.failureThresholdPercentage)),
            minimumRequests: Math.max(1, config.minimumRequests),
            recoveryTimeoutMs: Math.max(100, config.recoveryTimeoutMs),
            successThresholdPercentage: config.successThresholdPercentage ?? 50,
            halfOpenMaxRequests: config.halfOpenMaxRequests ?? 5,
            trackIndividualAttempts: config.trackIndividualAttempts ?? false
        };
    }

    async canExecute(): Promise<boolean> {
        if (this.state === CircuitBreakerState.CLOSED) {
            return true;
        }

        if (this.state === CircuitBreakerState.OPEN) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure >= this.config.recoveryTimeoutMs) {
                this.transitionToHalfOpen();
                return true;
            }
            return false;
        }

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            return this.halfOpenRequests < this.config.halfOpenMaxRequests;
        }

        return false;
    }

    recordSuccess(): void {
        this.totalRequests++;
        this.successfulRequests++;

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.halfOpenSuccesses++;
            this.halfOpenRequests++;
            this.checkHalfOpenTransition();
        } else if (this.state === CircuitBreakerState.CLOSED) {
            if (this.shouldResetCounters()) {
                this.resetCounters();
            }
        }
    }

    recordFailure(): void {
        this.totalRequests++;
        this.failedRequests++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.halfOpenFailures++;
            this.halfOpenRequests++;
            this.checkHalfOpenTransition();
        } else if (this.state === CircuitBreakerState.CLOSED) {
            this.checkThreshold();
        }
    }

    recordAttemptSuccess(): void {
        this.totalAttempts++;
        this.successfulAttempts++;

        if (this.state === CircuitBreakerState.CLOSED) {
            if (this.config.trackIndividualAttempts) {
                this.checkAttemptThreshold();
            }
            if (this.shouldResetCounters()) {
                this.resetCounters();
            }
        }
    }

    recordAttemptFailure(): void {
        this.totalAttempts++;
        this.failedAttempts++;
        this.lastFailureTime = Date.now();

        if (this.state === CircuitBreakerState.CLOSED) {
            if (this.config.trackIndividualAttempts) {
                this.checkAttemptThreshold();
            }
        }
    }

    private checkThreshold(): void {
        if (this.totalRequests < this.config.minimumRequests) {
            return;
        }

        const failurePercentage = (this.failedRequests / this.totalRequests) * 100;
        
        if (failurePercentage >= this.config.failureThresholdPercentage) {
            this.transitionToOpen();
        }
    }

    private checkAttemptThreshold(): void {
        if (this.totalAttempts < this.config.minimumRequests) {
            return;
        }

        const failurePercentage = (this.failedAttempts / this.totalAttempts) * 100;
        
        if (failurePercentage >= this.config.failureThresholdPercentage) {
            this.transitionToOpen();
        }
    }

    private checkHalfOpenTransition(): void {
        if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
            const successPercentage = (this.halfOpenSuccesses / this.halfOpenRequests) * 100;
            
            if (successPercentage >= this.config.successThresholdPercentage) {
                this.transitionToClosed();
            } else {
                this.transitionToOpen();
            }
        }
    }

    private transitionToClosed(): void {
        this.state = CircuitBreakerState.CLOSED;
        this.resetCounters();
        this.resetHalfOpenCounters();
    }

    private transitionToOpen(): void {
        this.state = CircuitBreakerState.OPEN;
        this.resetHalfOpenCounters();
    }

    private transitionToHalfOpen(): void {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.resetHalfOpenCounters();
    }

    private shouldResetCounters(): boolean {
        const threshold = this.config.trackIndividualAttempts 
            ? this.totalAttempts >= this.config.minimumRequests * 10
            : this.totalRequests >= this.config.minimumRequests * 10;
        return threshold;
    }

    private resetCounters(): void {
        this.totalRequests = 0;
        this.failedRequests = 0;
        this.successfulRequests = 0;
        this.totalAttempts = 0;
        this.failedAttempts = 0;
        this.successfulAttempts = 0;
    }

    private resetHalfOpenCounters(): void {
        this.halfOpenRequests = 0;
        this.halfOpenSuccesses = 0;
        this.halfOpenFailures = 0;
    }

    getState(): {
        state: CircuitBreakerState;
        totalRequests: number;
        failedRequests: number;
        successfulRequests: number;
        failurePercentage: number;
        totalAttempts: number;
        failedAttempts: number;
        successfulAttempts: number;
        attemptFailurePercentage: number;
        config: Required<CircuitBreakerConfig>;
    } {
        return {
            state: this.state,
            totalRequests: this.totalRequests,
            failedRequests: this.failedRequests,
            successfulRequests: this.successfulRequests,
            failurePercentage: this.totalRequests > 0 
                ? (this.failedRequests / this.totalRequests) * 100 
                : 0,
            totalAttempts: this.totalAttempts,
            failedAttempts: this.failedAttempts,
            successfulAttempts: this.successfulAttempts,
            attemptFailurePercentage: this.totalAttempts > 0
                ? (this.failedAttempts / this.totalAttempts) * 100
                : 0,
            config: this.config
        };
    }

    reset(): void {
        this.state = CircuitBreakerState.CLOSED;
        this.resetCounters();
        this.resetHalfOpenCounters();
        this.lastFailureTime = 0;
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        const canExecute = await this.canExecute();
        
        if (!canExecute) {
            throw new CircuitBreakerOpenError(
                `Circuit breaker is ${this.state}. Request blocked.`
            );
        }

        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }
}

export class CircuitBreakerOpenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CircuitBreakerOpenError';
    }
}