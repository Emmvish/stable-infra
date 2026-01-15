/**
 * Example 8: Graph-Based Workflow Orchestration with stableWorkflowGraph
 * 
 * This example demonstrates the advanced graph-based workflow capabilities introduced in stableWorkflowGraph,
 * showcasing explicit dependency management, conditional routing, parallel execution,
 * and DAG (Directed Acyclic Graph) guarantees for complex workflow orchestration.
 * 
 * Use Case: E-commerce Order Processing Pipeline
 * - Order validation with conditional routing
 * - Parallel inventory and payment processing
 * - Merge point synchronization before fulfillment
 * - Conditional fulfillment based on shipping method
 * - DAG validation to prevent workflow cycles
 * 
 * Key Concepts:
 * - WorkflowGraphBuilder for declarative graph construction
 * - Conditional nodes for dynamic routing
 * - Parallel groups for concurrent execution
 * - Merge points for synchronization
 * - Edge conditions (success/failure/custom)
 * - State management via sharedBuffer
 * - DAG enforcement for workflow correctness
 */

import { 
  stableWorkflowGraph, 
  WorkflowGraphBuilder,
  REQUEST_METHODS,
  validateWorkflowGraph,
  WorkflowEdgeConditionTypes
} from '../src/index.js';

// Simulated order data
interface Order {
  orderId: string;
  customerId: string;
  items: Array<{ sku: string; quantity: number; price: number }>;
  paymentMethod: string;
  shippingAddress: string;
  priority: 'standard' | 'express' | 'overnight';
}

// Simulated API responses
interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

interface InventoryResult {
  available: boolean;
  reservationId?: string;
}

interface PaymentResult {
  success: boolean;
  transactionId?: string;
  errorCode?: string;
}

interface ShippingResult {
  trackingNumber?: string;
  estimatedDelivery?: string;
}

async function runGraphWorkflowOrchestration() {
  console.log('🚀 Starting Graph-Based Workflow Orchestration Example\n');
  console.log('=' .repeat(80));
  
  // Sample order to process
  const order: Order = {
    orderId: 'ORD-2026-001',
    customerId: 'CUST-12345',
    items: [
      { sku: 'LAPTOP-001', quantity: 1, price: 1299.99 },
      { sku: 'MOUSE-042', quantity: 2, price: 29.99 }
    ],
    paymentMethod: 'credit_card',
    shippingAddress: '123 Main St, San Francisco, CA 94102',
    priority: 'express'
  };

  // Shared buffer for passing data between phases
  const sharedBuffer: Record<string, any> = {
    order,
    timestamp: new Date().toISOString()
  };

  console.log('\n📦 Order Details:');
  console.log(`   Order ID: ${order.orderId}`);
  console.log(`   Customer: ${order.customerId}`);
  console.log(`   Items: ${order.items.length}`);
  console.log(`   Total: $${order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)}`);
  console.log(`   Priority: ${order.priority.toUpperCase()}`);

  // Build the workflow graph
  console.log('\n📊 Building Workflow Graph...\n');

  const graph = new WorkflowGraphBuilder<any, any>()
    // Phase 1: Validate Order
    .addPhase('validate-order', {
      requests: [{
        id: 'validate-req',
        requestOptions: {
          reqData: {
            path: '/posts/1', // Simulating validation endpoint
            method: REQUEST_METHODS.GET
          },
          resReq: true,
          attempts: 2,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            // Simulate validation logic
            const isValid = Math.random() > 0.1; // 90% success rate
            commonBuffer!.validationResult = {
              valid: isValid,
              errors: isValid ? [] : ['Invalid shipping address']
            } as ValidationResult;
            console.log(`   ✓ Order validation: ${isValid ? 'PASSED' : 'FAILED'}`);
          }
        }
      }]
    })
    
    // Conditional: Route based on validation
    .addConditional('validation-check', async ({ sharedBuffer }) => {
      const result = sharedBuffer?.validationResult as ValidationResult;
      return result.valid ? 'parallel-processing' : 'validation-failed';
    })
    
    // Phase: Validation Failed (terminal node)
    .addPhase('validation-failed', {
      requests: [{
        id: 'notify-validation-failure',
        requestOptions: {
          reqData: {
            path: '/posts',
            method: REQUEST_METHODS.POST,
            body: JSON.stringify({ status: 'validation_failed' })
          },
          resReq: true,
          attempts: 1,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async () => {
            console.log('   ✗ Validation failed - Order rejected');
          }
        }
      }]
    })
    
    // Parallel Group: Process inventory and payment concurrently
    .addParallelGroup('parallel-processing', ['check-inventory', 'process-payment'])
    
    // Phase 2a: Check Inventory (runs in parallel)
    .addPhase('check-inventory', {
      requests: [{
        id: 'inventory-req',
        requestOptions: {
          reqData: {
            path: '/posts/2',
            method: REQUEST_METHODS.GET
          },
          resReq: true,
          attempts: 3,
          wait: 1000,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            // Simulate inventory check
            const available = Math.random() > 0.15; // 85% success rate
            commonBuffer!.inventoryResult = {
              available,
              reservationId: available ? `RES-${Date.now()}` : undefined
            } as InventoryResult;
            console.log(`   ✓ Inventory check: ${available ? 'AVAILABLE' : 'OUT OF STOCK'}`);
          }
        }
      }]
    })
    
    // Phase 2b: Process Payment (runs in parallel)
    .addPhase('process-payment', {
      requests: [{
        id: 'payment-req',
        requestOptions: {
          reqData: {
            path: '/posts/3',
            method: REQUEST_METHODS.GET
          },
          resReq: true,
          attempts: 3,
          wait: 1500,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            // Simulate payment processing
            const success = Math.random() > 0.1; // 90% success rate
            commonBuffer!.paymentResult = {
              success,
              transactionId: success ? `TXN-${Date.now()}` : undefined,
              errorCode: success ? undefined : 'INSUFFICIENT_FUNDS'
            } as PaymentResult;
            console.log(`   ✓ Payment processing: ${success ? 'SUCCESS' : 'FAILED'}`);
          }
        }
      }]
    })
    
    // Merge Point: Wait for both inventory and payment
    .addMergePoint('processing-complete', ['check-inventory', 'process-payment'])
    
    // Conditional: Check if both inventory and payment succeeded
    .addConditional('fulfillment-decision', async ({ sharedBuffer }) => {
      const inventory = sharedBuffer?.inventoryResult as InventoryResult;
      const payment = sharedBuffer?.paymentResult as PaymentResult;
      
      if (!inventory.available) return 'inventory-failed';
      if (!payment.success) return 'payment-failed';
      return 'determine-shipping';
    })
    
    // Phase: Inventory Failed
    .addPhase('inventory-failed', {
      requests: [{
        id: 'notify-inventory-failure',
        requestOptions: {
          reqData: {
            path: '/posts',
            method: REQUEST_METHODS.POST,
            body: JSON.stringify({ status: 'inventory_unavailable' })
          },
          resReq: true,
          attempts: 1,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async () => {
            console.log('   ✗ Inventory unavailable - Order cancelled');
          }
        }
      }]
    })
    
    // Phase: Payment Failed
    .addPhase('payment-failed', {
      requests: [{
        id: 'notify-payment-failure',
        requestOptions: {
          reqData: {
            path: '/posts',
            method: REQUEST_METHODS.POST,
            body: JSON.stringify({ status: 'payment_failed' })
          },
          resReq: true,
          attempts: 1,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            const payment = commonBuffer!.paymentResult as PaymentResult;
            console.log(`   ✗ Payment failed: ${payment.errorCode} - Order cancelled`);
          }
        }
      }]
    })
    
    // Conditional: Determine shipping method based on priority
    .addConditional('determine-shipping', async ({ sharedBuffer }) => {
      const order = sharedBuffer?.order as Order;
      return order.priority === 'overnight' ? 'express-shipping' : 'standard-shipping';
    })
    
    // Phase 3a: Standard Shipping
    .addPhase('standard-shipping', {
      requests: [{
        id: 'standard-ship-req',
        requestOptions: {
          reqData: {
            path: '/posts/4',
            method: REQUEST_METHODS.GET
          },
          resReq: true,
          attempts: 2,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            commonBuffer!.shippingResult = {
              trackingNumber: `STD-${Date.now()}`,
              estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
            } as ShippingResult;
            console.log('   ✓ Standard shipping arranged (5-7 business days)');
          }
        }
      }]
    })
    
    // Phase 3b: Express Shipping
    .addPhase('express-shipping', {
      requests: [{
        id: 'express-ship-req',
        requestOptions: {
          reqData: {
            path: '/posts/5',
            method: REQUEST_METHODS.GET
          },
          resReq: true,
          attempts: 2,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            commonBuffer!.shippingResult = {
              trackingNumber: `EXP-${Date.now()}`,
              estimatedDelivery: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString()
            } as ShippingResult;
            console.log('   ✓ Express shipping arranged (1-2 business days)');
          }
        }
      }]
    })
    
    // Merge Point: Consolidate shipping methods
    .addMergePoint('shipping-complete', ['standard-shipping', 'express-shipping'])
    
    // Phase 4: Send Confirmation
    .addPhase('send-confirmation', {
      requests: [{
        id: 'confirmation-req',
        requestOptions: {
          reqData: {
            path: '/posts',
            method: REQUEST_METHODS.POST,
            body: JSON.stringify({ status: 'order_confirmed' })
          },
          resReq: true,
          attempts: 3,
          wait: 500,
          logAllSuccessfulAttempts: true,
          handleSuccessfulAttemptData: async ({ commonBuffer }) => {
            const shipping = commonBuffer!.shippingResult as ShippingResult;
            console.log(`   ✓ Confirmation sent - Tracking: ${shipping.trackingNumber}`);
          }
        }
      }]
    })
    
    // Define the workflow structure with edges
    .connect('validate-order', 'validation-check', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('validation-check', 'parallel-processing', { condition: { type: WorkflowEdgeConditionTypes.SUCCESS } })
    .connect('validation-check', 'validation-failed', { condition: { type: WorkflowEdgeConditionTypes.FAILURE } })
    .connect('parallel-processing', 'check-inventory', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('parallel-processing', 'process-payment', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('check-inventory', 'processing-complete', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('process-payment', 'processing-complete', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('processing-complete', 'fulfillment-decision', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('fulfillment-decision', 'inventory-failed', { condition: { type: WorkflowEdgeConditionTypes.FAILURE } })
    .connect('fulfillment-decision', 'payment-failed', { condition: { type: WorkflowEdgeConditionTypes.FAILURE } })
    .connect('fulfillment-decision', 'determine-shipping', { condition: { type: WorkflowEdgeConditionTypes.SUCCESS } })
    .connect('determine-shipping', 'standard-shipping', { condition: { type: WorkflowEdgeConditionTypes.FAILURE } })
    .connect('determine-shipping', 'express-shipping', { condition: { type: WorkflowEdgeConditionTypes.SUCCESS } })
    .connect('standard-shipping', 'shipping-complete', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('express-shipping', 'shipping-complete', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    .connect('shipping-complete', 'send-confirmation', { condition: { type: WorkflowEdgeConditionTypes.ALWAYS } })
    
    // Set entry point
    .setEntryPoint('validate-order')
    
    // Build the graph
    .build();

  // Validate the graph structure
  console.log('🔍 Validating Workflow Graph Structure...\n');
  const validation = validateWorkflowGraph(graph);
  
  if (!validation.valid) {
    console.error('❌ Graph validation failed:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
    return;
  }
  
  console.log('✅ Graph validation passed!');
  console.log(`   Nodes: ${graph.nodes.size}`);
  console.log(`   Entry Point: ${graph.entryPoint}`);
  console.log(`   Exit Points: ${graph.exitPoints?.join(', ') || 'auto-detected'}`);
  
  if (validation.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`   - ${warning}`));
  }

  // Execute the workflow
  console.log('\n🎯 Executing Graph-Based Workflow...\n');
  console.log('─'.repeat(80));
  
  const startTime = Date.now();
  
  const result = await stableWorkflowGraph(graph, {
    workflowId: 'order-processing-graph',
    sharedBuffer,
    logPhaseResults: false, // We're handling our own logging
    validateGraph: true, // Ensure DAG constraints
    stopOnFirstPhaseError: false, // Continue on failures to demonstrate routing
    commonRequestData: { hostname: 'jsonplaceholder.typicode.com' }
  });
  
  const executionTime = Date.now() - startTime;
  
  console.log('─'.repeat(80));
  console.log('\n📈 Workflow Execution Results:\n');
  console.log('=' .repeat(80));
  
  // Overall status
  console.log(`\n✨ Overall Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`⏱️  Total Execution Time: ${executionTime}ms`);
  console.log(`📊 Phases Executed: ${result.completedPhases}/${result.totalPhases}`);
  console.log(`🔢 Total Requests: ${result.totalRequests}`);
  console.log(`✅ Successful: ${result.successfulRequests}`);
  console.log(`❌ Failed: ${result.failedRequests}`);
  console.log(`📈 Success Rate: ${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`);
  
  // Execution path
  console.log('\n🛤️  Execution Path:');
  result.executionHistory.forEach((record, index) => {
    const status = record.success ? '✅' : '❌';
    console.log(`   ${index + 1}. ${status} ${record.phaseId} (${record.executionTime}ms)`);
  });
  
  // Final order status
  console.log('\n📦 Final Order Status:');
  const validation_result = sharedBuffer.validationResult as ValidationResult | undefined;
  const inventory = sharedBuffer.inventoryResult as InventoryResult | undefined;
  const payment = sharedBuffer.paymentResult as PaymentResult | undefined;
  const shipping = sharedBuffer.shippingResult as ShippingResult | undefined;
  
  if (validation_result && !validation_result.valid) {
    console.log('   ❌ Order Status: REJECTED (Validation Failed)');
    console.log(`   Reason: ${validation_result.errors?.join(', ')}`);
  } else if (inventory && !inventory.available) {
    console.log('   ❌ Order Status: CANCELLED (Inventory Unavailable)');
  } else if (payment && !payment.success) {
    console.log(`   ❌ Order Status: CANCELLED (Payment Failed - ${payment.errorCode})`);
  } else if (shipping) {
    console.log('   ✅ Order Status: CONFIRMED');
    console.log(`   📦 Tracking Number: ${shipping.trackingNumber}`);
    console.log(`   📅 Estimated Delivery: ${new Date(shipping.estimatedDelivery!).toLocaleDateString()}`);
    if (inventory) console.log(`   🏷️  Reservation ID: ${inventory.reservationId}`);
    if (payment) console.log(`   💳 Transaction ID: ${payment.transactionId}`);
  }
  
  // Metrics
  if (result.metrics) {
    console.log('\n📊 Workflow Metrics:');
    console.log(`   Request Success Rate: ${result.metrics.requestSuccessRate?.toFixed(2)}%`);
    console.log(`   Avg Phase Time: ${result.metrics.averagePhaseExecutionTime?.toFixed(2)}ms`);
    console.log(`   Phase Completion Rate: ${result.metrics.phaseCompletionRate?.toFixed(2)}%`);
  }
  
  // Graph-specific insights
  console.log('\n🎯 Graph Workflow Insights:');
  console.log('   ✓ DAG validation enforced - no cycles detected');
  console.log('   ✓ Conditional routing based on runtime state');
  console.log('   ✓ Parallel execution of inventory + payment');
  console.log('   ✓ Merge point synchronization before fulfillment');
  console.log('   ✓ Dynamic shipping method selection');
  console.log('   ✓ Multiple terminal paths for different outcomes');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Graph-Based Workflow Orchestration Example Complete!\n');
}

// Run the example
runGraphWorkflowOrchestration().catch(error => {
  console.error('\n❌ Example failed:', error);
  process.exit(1);
});
