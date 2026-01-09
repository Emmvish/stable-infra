/**
 * Enterprise Example 2: Resilient Microservice Orchestration with Branch Workflows
 * 
 * This example demonstrates a production-grade microservice orchestration pattern that:
 * - Executes multiple independent service branches concurrently
 * - Implements fallback strategies for critical services
 * - Uses circuit breakers per service to prevent cascade failures
 * - Includes comprehensive error recovery and retry logic
 * - Demonstrates branch-level decision hooks for complex orchestration
 * - Implements request grouping for different SLAs
 * - Shows how to handle partial failures gracefully
 * 
 * Use Case: E-commerce order processing system that coordinates multiple microservices
 * (user service, inventory service, payment service, notification service)
 */

import { 
  stableWorkflow, 
  RETRY_STRATEGIES, 
  PHASE_DECISION_ACTIONS,
  CircuitBreaker,
  REQUEST_METHODS,
  VALID_REQUEST_PROTOCOLS,
  type STABLE_WORKFLOW_BRANCH,
} from '../src/index.js';

// Simulated microservices (using JSONPlaceholder for demo)
const HOSTINGNAME = 'jsonplaceholder.typicode.com';
const INVENTORY_SERVICE = 'jsonplaceholder.typicode.com';
const PAYMENT_SERVICE = 'jsonplaceholder.typicode.com';
const NOTIFICATION_SERVICE = 'jsonplaceholder.typicode.com';

// Order processing state
interface OrderContext {
  orderId: string;
  customerId: number;
  items: Array<{ productId: number; quantity: number; price: number }>;
  totalAmount: number;
  
  // Service responses
  customerData?: any;
  inventoryCheck?: { available: boolean; reservationId?: string };
  paymentResult?: { success: boolean; transactionId?: string };
  notificationsSent?: string[];
  
  // State tracking
  startTime: number;
  retryAttempts: {
    payment: number;
    inventory: number;
    notification: number;
  };
  serviceFailures: {
    userService: number;
    inventoryService: number;
    paymentService: number;
    notificationService: number;
  };
  fallbacksUsed: string[];
}

const orderContext: OrderContext = {
  orderId: `ORD-${Date.now()}`,
  customerId: 1,
  items: [
    { productId: 1, quantity: 2, price: 29.99 },
    { productId: 2, quantity: 1, price: 49.99 }
  ],
  totalAmount: 109.97,
  startTime: Date.now(),
  retryAttempts: {
    payment: 0,
    inventory: 0,
    notification: 0
  },
  serviceFailures: {
    userService: 0,
    inventoryService: 0,
    paymentService: 0,
    notificationService: 0
  },
  fallbacksUsed: [],
  notificationsSent: []
};

// Circuit breakers for each microservice
const circuitBreakers = {
  userService: new CircuitBreaker({
    failureThresholdPercentage: 60,
    minimumRequests: 2,
    recoveryTimeoutMs: 20000,
    successThresholdPercentage: 50,
    halfOpenMaxRequests: 1
  }),
  inventoryService: new CircuitBreaker({
    failureThresholdPercentage: 50,
    minimumRequests: 2,
    recoveryTimeoutMs: 30000,
    successThresholdPercentage: 60,
    halfOpenMaxRequests: 2
  }),
  paymentService: new CircuitBreaker({
    failureThresholdPercentage: 40,
    minimumRequests: 2,
    recoveryTimeoutMs: 45000,
    successThresholdPercentage: 70,
    halfOpenMaxRequests: 1
  }),
  notificationService: new CircuitBreaker({
    failureThresholdPercentage: 70,
    minimumRequests: 3,
    recoveryTimeoutMs: 15000,
    successThresholdPercentage: 50,
    halfOpenMaxRequests: 3
  })
};

console.log('🏪 Starting E-Commerce Order Processing Orchestration...\n');
console.log(`Order ID: ${orderContext.orderId}`);
console.log(`Customer ID: ${orderContext.customerId}`);
console.log(`Items: ${orderContext.items.length}`);
console.log(`Total Amount: $${orderContext.totalAmount.toFixed(2)}\n`);

// Define the branched workflow
const orderBranches: STABLE_WORKFLOW_BRANCH[] = [
  // Branch 1: User Validation (Critical - Must succeed)
  {
    id: 'user-validation',
    markConcurrentBranch: false, // Execute first
    phases: [
      {
        id: 'fetch-user-details',
        requests: [
          {
            id: 'get-user',
            groupId: 'critical',
            requestOptions: {
              reqData: {
                path: `/users/${orderContext.customerId}`,
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              circuitBreaker: circuitBreakers.userService,
              preExecution: {
                preExecutionHook: () => {
                  console.log('👤 [User Service] Fetching customer details...');
                  return {};
                },
                applyPreExecutionConfigOverride: false
              },
              handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.customerData = successfulAttemptData.data;
                console.log(`✅ [User Service] Customer validated: ${buffer.customerData.name} (${successfulAttemptData.executionTime}ms)`);
              },
              handleErrors: async ({ errorLog, commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.serviceFailures.userService++;
                console.log(`⚠️  [User Service] Attempt failed: ${errorLog.error}`);
              }
            }
          }
        ]
      },
      {
        id: 'verify-user-status',
        requests: [
          {
            id: 'check-user-status',
            groupId: 'critical',
            requestOptions: {
              reqData: {
                path: `/users/${orderContext.customerId}/todos?_limit=1`,
                method: REQUEST_METHODS.GET
              },
              resReq: false,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log(`🔍 [User Service] Verifying account status for ${buffer.customerData?.name || 'customer'}...`);
                  
                  console.log('✅ [User Service] Account status verified - Active');
                  return {};
                },
                applyPreExecutionConfigOverride: false,
                continueOnPreExecutionHookFailure: false
              }
            }
          }
        ]
      }
    ]
  },

  // Branch 2: Inventory Management (Critical with fallback)
  {
    id: 'inventory-management',
    markConcurrentBranch: true, // Execute concurrently with payment
    allowReplay: true,
    maxReplayCount: 2,
    phases: [
      {
        id: 'check-inventory',
        requests: [
          {
            id: 'check-stock',
            groupId: 'critical',
            requestOptions: {
              reqData: {
                path: '/posts?_limit=5', // Simulating inventory check
                method: REQUEST_METHODS.GET
              },
              resReq: true,
              circuitBreaker: circuitBreakers.inventoryService,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log(`📦 [Inventory Service] Checking stock for ${buffer.items.length} items...`);
                  return {};
                },
                applyPreExecutionConfigOverride: false
              },
              handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                // Simulate inventory check result
                buffer.inventoryCheck = {
                  available: true,
                  reservationId: `RES-${Date.now()}`
                };
                console.log(`✅ [Inventory Service] Stock available, reserved: ${buffer.inventoryCheck.reservationId} (${successfulAttemptData.executionTime}ms)`);
              },
              handleErrors: async ({ errorLog, commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.serviceFailures.inventoryService++;
                buffer.retryAttempts.inventory++;
                console.log(`⚠️  [Inventory Service] Check failed (Attempt ${buffer.retryAttempts.inventory}): ${errorLog.error}`);
              },
              finalErrorAnalyzer: async ({ commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                console.log('🔄 [Inventory Service] Using fallback - Manual verification queue');
                buffer.inventoryCheck = {
                  available: true, // Optimistic assumption
                  reservationId: `FALLBACK-${Date.now()}`
                };
                buffer.fallbacksUsed.push('inventory-fallback');
                return true; // Suppress error
              }
            }
          }
        ]
      },
      {
        id: 'reserve-inventory',
        requests: [
          {
            id: 'create-reservation',
            groupId: 'critical',
            requestOptions: {
              reqData: {
                path: '/posts',
                method: REQUEST_METHODS.POST
              },
              resReq: true,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log(`🔒 [Inventory Service] Creating reservation ${buffer.inventoryCheck?.reservationId}...`);
                  
                  return {
                    reqData: {
                      hostname: HOSTINGNAME,
                      protocol:  VALID_REQUEST_PROTOCOLS.HTTPS,
                      path: '/posts',
                      method: REQUEST_METHODS.POST,
                      body: {
                        orderId: buffer.orderId,
                        items: buffer.items,
                        reservationId: buffer.inventoryCheck?.reservationId
                      }
                    }
                  };
                },
                applyPreExecutionConfigOverride: true
              },
              handleSuccessfulAttemptData: async ({ successfulAttemptData }) => {
                console.log(`✅ [Inventory Service] Reservation confirmed (${successfulAttemptData.executionTime}ms)`);
              }
            }
          }
        ]
      }
    ],
    branchDecisionHook: async ({ branchResults, executionNumber, sharedBuffer }) => {
      const buffer = sharedBuffer as OrderContext;
      const lastPhase = branchResults[branchResults.length - 1];
      
      // If inventory check failed and we haven't retried too many times
      if (!lastPhase.success && executionNumber < 2) {
        console.log(`\n🔄 [Inventory Branch] Retrying inventory check (Attempt ${executionNumber + 1})...\n`);
        return { 
          action: PHASE_DECISION_ACTIONS.REPLAY,
          metadata: { reason: 'Inventory check failed, retrying' }
        };
      }
      
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },

  // Branch 3: Payment Processing (Critical - Sequential phases)
  {
    id: 'payment-processing',
    markConcurrentBranch: true, // Execute concurrently with inventory
    allowReplay: true,
    maxReplayCount: 3,
    phases: [
      {
        id: 'validate-payment-method',
        requests: [
          {
            id: 'check-payment-method',
            groupId: 'critical',
            requestOptions: {
              reqData: {
                path: `/users/${orderContext.customerId}/albums?_limit=1`,
                method: REQUEST_METHODS.GET
              },
              resReq: false,
              preExecution: {
                preExecutionHook: () => {
                  console.log('💳 [Payment Service] Validating payment method...');
                  return {};
                },
                applyPreExecutionConfigOverride: false
              },
              handleSuccessfulAttemptData: async () => {
                console.log('✅ [Payment Service] Payment method validated');
              }
            }
          }
        ]
      },
      {
        id: 'process-payment',
        requests: [
          {
            id: 'charge-payment',
            groupId: 'critical',
            requestOptions: {
              reqData: {
                path: '/posts',
                method: REQUEST_METHODS.POST
              },
              resReq: true,
              circuitBreaker: circuitBreakers.paymentService,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log(`💰 [Payment Service] Processing payment of $${buffer.totalAmount.toFixed(2)}...`);
                  
                  return {
                    reqData: {
                      hostname: HOSTINGNAME,
                      protocol:  VALID_REQUEST_PROTOCOLS.HTTPS,
                      path: '/posts',
                      method: REQUEST_METHODS.POST,
                      body: {
                        orderId: buffer.orderId,
                        amount: buffer.totalAmount,
                        customerId: buffer.customerId
                      }
                    }
                  };
                },
                applyPreExecutionConfigOverride: true
              },
              handleSuccessfulAttemptData: async ({ successfulAttemptData, commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.paymentResult = {
                  success: true,
                  transactionId: `TXN-${Date.now()}`
                };
                console.log(`✅ [Payment Service] Payment successful: ${buffer.paymentResult.transactionId} (${successfulAttemptData.executionTime}ms)`);
              },
              handleErrors: async ({ errorLog, commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.serviceFailures.paymentService++;
                buffer.retryAttempts.payment++;
                console.log(`⚠️  [Payment Service] Payment failed (Attempt ${buffer.retryAttempts.payment}): ${errorLog.error}`);
              }
            }
          }
        ]
      }
    ],
    branchDecisionHook: async ({ branchResults, executionNumber, sharedBuffer }) => {
      const buffer = sharedBuffer as OrderContext;
      const paymentPhase = branchResults.find(p => p.phaseId === 'process-payment');
      
      // If payment failed and we have retry budget
      if (paymentPhase && !paymentPhase.success && executionNumber < 3) {
        console.log(`\n🔄 [Payment Branch] Retrying payment processing (Attempt ${executionNumber + 1}/3)...\n`);
        return { 
          action: PHASE_DECISION_ACTIONS.REPLAY,
          metadata: { reason: 'Payment processing failed, retrying' }
        };
      }
      
      // If payment still failed after retries, terminate entire workflow
      if (paymentPhase && !paymentPhase.success && executionNumber >= 3) {
        console.log('\n❌ [Payment Branch] Payment failed after all retries - Terminating workflow\n');
        return {
          action: PHASE_DECISION_ACTIONS.TERMINATE,
          metadata: { reason: 'Payment processing failed after maximum retries' }
        };
      }
      
      return { action: PHASE_DECISION_ACTIONS.CONTINUE };
    }
  },

  // Branch 4: Notification Services (Non-critical - Can fail gracefully)
  {
    id: 'notification-services',
    markConcurrentBranch: false, // Execute after payment and inventory
    phases: [
      {
        id: 'send-notifications',
        concurrentExecution: true,
        stopOnFirstError: false,
        requests: [
          {
            id: 'send-email',
            groupId: 'optional',
            requestOptions: {
              reqData: {
                path: '/posts',
                method: REQUEST_METHODS.POST
              },
              resReq: false,
              circuitBreaker: circuitBreakers.notificationService,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log(`📧 [Notification Service] Sending email to ${buffer.customerData?.email || 'customer'}...`);
                  
                  return {
                    reqData: {
                      hostname: HOSTINGNAME,
                      protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                      path: '/posts',
                      method: REQUEST_METHODS.POST,
                      body: {
                        type: 'email',
                        orderId: buffer.orderId,
                        recipient: buffer.customerData?.email
                      }
                    }
                  };
                },
                applyPreExecutionConfigOverride: true
              },
              handleSuccessfulAttemptData: async ({ commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.notificationsSent = buffer.notificationsSent || [];
                buffer.notificationsSent.push('email');
                console.log('✅ [Notification Service] Email sent successfully');
              },
              finalErrorAnalyzer: async () => {
                console.log('⚠️  [Notification Service] Email failed - Will retry in background job');
                return true; // Suppress error
              }
            }
          },
          {
            id: 'send-sms',
            groupId: 'optional',
            requestOptions: {
              reqData: {
                path: '/posts',
                method: REQUEST_METHODS.POST
              },
              resReq: false,
              circuitBreaker: circuitBreakers.notificationService,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log(`📱 [Notification Service] Sending SMS to ${buffer.customerData?.phone || 'customer'}...`);
                  
                  return {
                    reqData: {
                      hostname: HOSTINGNAME,
                      protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                      path: '/posts',
                      method: REQUEST_METHODS.POST,
                      body: {
                        type: 'sms',
                        orderId: buffer.orderId,
                        recipient: buffer.customerData?.phone
                      }
                    }
                  };
                },
                applyPreExecutionConfigOverride: true
              },
              handleSuccessfulAttemptData: async ({ commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.notificationsSent = buffer.notificationsSent || [];
                buffer.notificationsSent.push('sms');
                console.log('✅ [Notification Service] SMS sent successfully');
              },
              finalErrorAnalyzer: async () => {
                console.log('⚠️  [Notification Service] SMS failed - Will retry in background job');
                return true; // Suppress error
              }
            }
          },
          {
            id: 'update-dashboard',
            groupId: 'optional',
            requestOptions: {
              reqData: {
                path: '/posts',
                method: REQUEST_METHODS.POST
              },
              resReq: false,
              preExecution: {
                preExecutionHook: ({ commonBuffer }) => {
                  const buffer = commonBuffer as OrderContext;
                  console.log('📊 [Notification Service] Updating customer dashboard...');
                  
                  return {
                    reqData: {
                      hostname: HOSTINGNAME,
                      protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
                      path: '/posts',
                      method: REQUEST_METHODS.POST,
                      body: {
                        type: 'dashboard',
                        orderId: buffer.orderId,
                        customerId: buffer.customerId
                      }
                    }
                  };
                },
                applyPreExecutionConfigOverride: true
              },
              handleSuccessfulAttemptData: async ({ commonBuffer }) => {
                const buffer = commonBuffer as OrderContext;
                buffer.notificationsSent = buffer.notificationsSent || [];
                buffer.notificationsSent.push('dashboard');
                console.log('✅ [Notification Service] Dashboard updated');
              },
              finalErrorAnalyzer: async () => {
                console.log('⚠️  [Notification Service] Dashboard update failed - Non-critical');
                return true;
              }
            }
          }
        ]
      }
    ]
  }
];

// Execute the workflow
(async () => {
  try {
    const result = await stableWorkflow([], {
      workflowId: orderContext.orderId,
      
      // Enable branch execution
      enableBranchExecution: true,
      branches: orderBranches,
      
      // Common configuration for all services
      commonRequestData: {
        hostname: HOSTINGNAME,
        protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': orderContext.orderId,
          'User-Agent': 'StableRequest-OrderOrchestration/1.0'
        }
      },
      
      // Default resilience settings
      commonAttempts: 3,
      commonWait: 1000,
      commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      commonMaxAllowedWait: 8000,
      commonLogAllSuccessfulAttempts: true,
      
      // Request grouping for different SLAs
      requestGroups: [
        {
          id: 'critical',
          commonConfig: {
            commonAttempts: 5,
            commonWait: 2000,
            commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
            commonFinalErrorAnalyzer: async () => false // Always throw for critical
          }
        },
        {
          id: 'optional',
          commonConfig: {
            commonAttempts: 2,
            commonWait: 500,
            commonRetryStrategy: RETRY_STRATEGIES.FIXED,
            commonFinalErrorAnalyzer: async () => true // Suppress errors for optional
          }
        }
      ],
      
      // Rate limiting
      rateLimit: {
        maxRequests: 100,
        windowMs: 10000 // 100 requests per 10 seconds
      },
      
      // Concurrency control
      maxConcurrentRequests: 5,
      
      // Shared state
      sharedBuffer: orderContext,
      
      // Observability
      handleBranchCompletion: async ({ branchId, success }) => {
        const icon = success ? '✅' : '❌';
        console.log(`\n${icon} Branch "${branchId}" completed\n`);
      },
      
      handleBranchDecision: async (decision, branchResult) => {
        if (decision.action !== PHASE_DECISION_ACTIONS.CONTINUE) {
          console.log(`\n🔀 Branch Decision [${branchResult.branchId}]: ${decision.action}`);
          if (decision.metadata) {
            console.log(`   Reason: ${decision.metadata.reason}\n`);
          }
        }
      }
    });
    
    const duration = Date.now() - orderContext.startTime;
    
    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('📋 ORDER PROCESSING RESULTS');
    console.log('='.repeat(70));
    console.log(`Order ID:              ${orderContext.orderId}`);
    console.log(`Status:                ${result.success ? '✅ COMPLETED' : '❌ FAILED'}`);
    console.log(`Total Duration:        ${duration}ms`);
    console.log(`Execution Time:        ${result.executionTime}ms`);
    console.log('');
    console.log('Service Results:');
    console.log(`  Customer Validated:  ${orderContext.customerData ? '✅ Yes' : '❌ No'}`);
    console.log(`  Inventory Reserved:  ${orderContext.inventoryCheck?.available ? '✅ Yes' : '❌ No'}`);
    console.log(`  Payment Processed:   ${orderContext.paymentResult?.success ? '✅ Yes' : '❌ No'}`);
    console.log(`  Notifications Sent:  ${orderContext.notificationsSent?.length || 0}/3`);
    console.log('');
    console.log('Resilience Metrics:');
    console.log(`  Payment Retries:     ${orderContext.retryAttempts.payment}`);
    console.log(`  Inventory Retries:   ${orderContext.retryAttempts.inventory}`);
    console.log(`  Fallbacks Used:      ${orderContext.fallbacksUsed.length}`);
    console.log('');
    console.log('Branch Execution:');
    console.log(`  Total Branches:      ${result.branches?.length || 0}`);
    console.log(`  Successful:          ${result.branches?.filter(b => b.success).length || 0}`);
    console.log(`  Failed:              ${result.branches?.filter(b => !b.success).length || 0}`);
    console.log('');
    console.log('Request Statistics:');
    console.log(`  Total Requests:      ${result.totalRequests}`);
    console.log(`  Successful:          ${result.successfulRequests}`);
    console.log(`  Failed:              ${result.failedRequests}`);
    console.log(`  Success Rate:        ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
    console.log('='.repeat(70));
    
    // Circuit breaker states
    console.log('\n🔌 Circuit Breaker States:');
    Object.entries(circuitBreakers).forEach(([service, breaker]) => {
      const state = breaker.getState();
      const icon = state.state === 'CLOSED' ? '🟢' : state.state === 'HALF_OPEN' ? '🟡' : '🔴';
      console.log(`  ${icon} ${service.padEnd(25)} ${state.state.padEnd(10)} (${state.totalRequests} requests, ${state.failedRequests} failed)`);
    });
    
    // Payment transaction details
    if (orderContext.paymentResult?.success) {
      console.log('\n💳 Payment Details:');
      console.log(`  Transaction ID:      ${orderContext.paymentResult.transactionId}`);
      console.log(`  Amount:              $${orderContext.totalAmount.toFixed(2)}`);
      console.log(`  Status:              ✅ Authorized`);
    }
    
    // Inventory reservation details
    if (orderContext.inventoryCheck?.reservationId) {
      console.log('\n📦 Inventory Reservation:');
      console.log(`  Reservation ID:      ${orderContext.inventoryCheck.reservationId}`);
      console.log(`  Items:               ${orderContext.items.length}`);
      console.log(`  Status:              ${orderContext.inventoryCheck.available ? '✅ Reserved' : '❌ Not Available'}`);
      if (orderContext.fallbacksUsed.includes('inventory-fallback')) {
        console.log(`  Note:                ⚠️  Using fallback - Manual verification required`);
      }
    }
    
    console.log('');
    
  } catch (error: any) {
    console.error('\n❌ ORDER PROCESSING FAILED:', error.message);
    console.error('\nError Details:', error);
    
    // Display partial results
    const duration = Date.now() - orderContext.startTime;
    console.log('\n' + '='.repeat(70));
    console.log('📋 PARTIAL ORDER STATE');
    console.log('='.repeat(70));
    console.log(`Order ID:              ${orderContext.orderId}`);
    console.log(`Duration:              ${duration}ms`);
    console.log(`Customer Data:         ${orderContext.customerData ? '✅' : '❌'}`);
    console.log(`Inventory Check:       ${orderContext.inventoryCheck ? '✅' : '❌'}`);
    console.log(`Payment Result:        ${orderContext.paymentResult ? '✅' : '❌'}`);
    console.log('='.repeat(70));
    
    process.exit(1);
  }
})();
