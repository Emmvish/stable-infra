/**
 * Enterprise Example 5: Chaos Engineering with Trial Mode
 * 
 * This example demonstrates production-grade chaos testing that:
 * - Uses stableRequest with trial mode for failure simulation
 * - Tests system resilience under various failure scenarios
 * - Validates retry strategies and error handling
 * - Simulates intermittent failures and recovery
 * - Provides detailed failure analysis and recommendations
 * - Helps identify weaknesses before they hit production
 * - Demonstrates proper error handling patterns
 * 
 * Use Case: Test application resilience by simulating various failure
 * scenarios (network issues, timeouts, intermittent errors) to ensure
 * the system handles failures gracefully
 */

import { 
  stableRequest, 
  RETRY_STRATEGIES,
  REQUEST_METHODS,
  VALID_REQUEST_PROTOCOLS
} from '../src/index';

// Test scenarios
interface ChaosScenario {
  name: string;
  description: string;
  failureProbability: number;
  retryFailureProbability?: number;
  expectedBehavior: string;
}

// Define chaos engineering scenarios
const chaosScenarios: ChaosScenario[] = [
  {
    name: 'Healthy System',
    description: 'No failures - baseline test',
    failureProbability: 0,
    expectedBehavior: 'All requests succeed immediately'
  },
  {
    name: 'Intermittent Failures',
    description: '30% initial failure rate with recovery',
    failureProbability: 0.3,
    retryFailureProbability: 0.1,
    expectedBehavior: 'Some requests fail initially but recover on retry'
  },
  {
    name: 'High Failure Rate',
    description: '70% failure rate with some recovery',
    failureProbability: 0.7,
    retryFailureProbability: 0.4,
    expectedBehavior: 'Most requests require multiple retries'
  },
  {
    name: 'Persistent Failures',
    description: '50% failure rate that persists',
    failureProbability: 0.5,
    retryFailureProbability: 0.9,
    expectedBehavior: 'Significant failures even after retries'
  },
  {
    name: 'Complete Outage',
    description: '100% failure rate - total service unavailability',
    failureProbability: 1.0,
    retryFailureProbability: 1.0,
    expectedBehavior: 'All requests fail after exhausting retries'
  }
];

// Track test results
interface TestResult {
  scenario: string;
  success: boolean;
  attempts: number;
  duration: number;
  error?: string;
}

const testResults: TestResult[] = [];

// Run chaos test for a single scenario
async function runChaosTest(scenario: ChaosScenario): Promise<TestResult> {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`   ${scenario.description}`);
  console.log(`   Failure Rate: ${(scenario.failureProbability * 100).toFixed(0)}% initial${scenario.retryFailureProbability ? `, ${(scenario.retryFailureProbability * 100).toFixed(0)}% on retry` : ''}`);
  
  const startTime = Date.now();
  let attemptCount = 0;
  
  try {
    const result = await stableRequest({
      reqData: {
        hostname: 'api.example.com',
        protocol: VALID_REQUEST_PROTOCOLS.HTTPS,
        path: '/chaos-test',
        method: REQUEST_METHODS.GET,
        headers: {
          'X-Test-Scenario': scenario.name
        },
        timeout: 5000
      },
      
      // Configure retry behavior
      attempts: 5,
      wait: 500,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      maxAllowedWait: 3000,
      
      // Enable trial mode for failure simulation
      trialMode: {
        enabled: true,
        reqFailureProbability: scenario.failureProbability,
        retryFailureProbability: scenario.retryFailureProbability
      },
      
      // Track all attempts
      logAllSuccessfulAttempts: true,
      handleSuccessfulAttemptData: async ({ successfulAttemptData }) => {
        attemptCount = parseInt(successfulAttemptData.attempt?.split('/')[0] || '1');
        if (attemptCount > 1) {
          console.log(`   ✅ Recovered on attempt ${attemptCount} (${successfulAttemptData.executionTime}ms)`);
        } else {
          console.log(`   ✅ Succeeded immediately (${successfulAttemptData.executionTime}ms)`);
        }
      },
      
      // Error analysis
      finalErrorAnalyzer: async ({ error }) => {
        console.log(`   ❌ Failed with Error: ${error}`);
        return false; // Re-throw for proper handling
      },
      
      resReq: true
    });
    
    const duration = Date.now() - startTime;
    
    return {
      scenario: scenario.name,
      success: true,
      attempts: attemptCount,
      duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      scenario: scenario.name,
      success: false,
      attempts: attemptCount,
      duration,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run all chaos engineering tests
async function runChaosEngineeringTests(): Promise<void> {
  console.log('🌪️  Starting Chaos Engineering Tests');
  console.log('═'.repeat(70));
  console.log('Testing system resilience under various failure scenarios');
  console.log(`Total Scenarios: ${chaosScenarios.length}`);
  console.log('═'.repeat(70));
  
  // Run each scenario
  for (const scenario of chaosScenarios) {
    const result = await runChaosTest(scenario);
    testResults.push(result);
    
    // Brief pause between scenarios
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Generate comprehensive resilience report
  console.log('\n' + '═'.repeat(70));
  console.log('📊 CHAOS ENGINEERING RESULTS');
  console.log('═'.repeat(70));
  
  console.log(`\nOverall Statistics:`);
  const successfulTests = testResults.filter(r => r.success).length;
  console.log(`  Tests Passed: ${successfulTests}/${testResults.length}`);
  console.log(`  Tests Failed: ${testResults.length - successfulTests}/${testResults.length}`);
  
  console.log(`\nResilience Analysis:`);
  
  // Analyze each scenario result
  testResults.forEach((result, index) => {
    const scenario = chaosScenarios[index];
    const icon = result.success ? '✅' : '❌';
    
    console.log(`\n${icon} ${result.scenario}:`);
    console.log(`   Expected: ${scenario.expectedBehavior}`);
    console.log(`   Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Attempts Used: ${result.attempts}`);
    console.log(`   Duration: ${result.duration}ms`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    // Provide resilience assessment
    if (scenario.failureProbability === 0) {
      if (result.success && result.attempts === 1) {
        console.log(`   ✅ Baseline: System performs well under normal conditions`);
      }
    } else if (scenario.failureProbability < 0.5) {
      if (result.success) {
        console.log(`   ✅ Resilient: Successfully recovered from intermittent failures`);
      }
    } else if (scenario.failureProbability < 1.0) {
      if (result.success && result.attempts > 1) {
        console.log(`   ✅ Robust: Handled high failure rate with retry strategy`);
      } else if (!result.success) {
        console.log(`   ⚠️  Acceptable: High failure rate exceeded retry capacity`);
      }
    } else {
      if (!result.success) {
        console.log(`   ✅ Expected: Correctly failed under complete outage`);
      }
    }
  });
  
  console.log('\n' + '═'.repeat(70));
  console.log('🎯 RESILIENCE ASSESSMENT');
  console.log('═'.repeat(70));
  
  // Calculate resilience score
  const baselineTest = testResults[0];
  const intermittentTest = testResults[1];
  const highFailureTest = testResults[2];
  const persistentTest = testResults[3];
  const outageTest = testResults[4];
  
  let resilienceScore = 0;
  const maxScore = 100;
  
  // Scoring criteria
  if (baselineTest.success && baselineTest.attempts === 1) {
    resilienceScore += 20;
    console.log('\n✅ Baseline Performance: 20/20 points');
  }
  
  if (intermittentTest.success) {
    resilienceScore += 25;
    console.log('✅ Intermittent Failure Recovery: 25/25 points');
  } else {
    console.log('❌ Intermittent Failure Recovery: 0/25 points');
  }
  
  if (highFailureTest.success) {
    resilienceScore += 25;
    console.log('✅ High Failure Rate Handling: 25/25 points');
  } else if (highFailureTest.attempts >= 3) {
    resilienceScore += 15;
    console.log('⚠️  High Failure Rate Handling: 15/25 points (attempted retries)');
  } else {
    console.log('❌ High Failure Rate Handling: 0/25 points');
  }
  
  if (!persistentTest.success && persistentTest.attempts >= 4) {
    resilienceScore += 15;
    console.log('✅ Persistent Failure Handling: 15/15 points (proper retry exhaustion)');
  }
  
  if (!outageTest.success) {
    resilienceScore += 15;
    console.log('✅ Complete Outage Handling: 15/15 points (failed appropriately)');
  }
  
  console.log(`\n📈 Overall Resilience Score: ${resilienceScore}/${maxScore} (${((resilienceScore / maxScore) * 100).toFixed(1)}%)`);
  
  // Provide recommendations
  console.log('\n💡 Recommendations:');
  
  if (resilienceScore >= 90) {
    console.log('   ✅ Excellent resilience - System is production-ready');
    console.log('   • Retry strategies are well-configured');
    console.log('   • Error handling is robust');
    console.log('   • Continue monitoring in production');
  } else if (resilienceScore >= 70) {
    console.log('   ⚠️  Good resilience - Minor improvements recommended');
    console.log('   • Consider increasing retry attempts for critical operations');
    console.log('   • Monitor intermittent failure patterns');
    console.log('   • Review timeout configurations');
  } else if (resilienceScore >= 50) {
    console.log('   ⚠️  Moderate resilience - Significant improvements needed');
    console.log('   • Implement exponential backoff for retries');
    console.log('   • Add circuit breakers for downstream services');
    console.log('   • Improve error logging and alerting');
  } else {
    console.log('   ❌ Poor resilience - Critical improvements required');
    console.log('   • Review and enhance retry strategies');
    console.log('   • Implement proper error handling throughout');
    console.log('   • Add monitoring and alerting systems');
    console.log('   • Consider implementing fallback mechanisms');
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('🌪️  Chaos Engineering: TEST SUITE COMPLETED');
  console.log('═'.repeat(70));
}

// Run chaos engineering tests
(async () => {
  try {
    await runChaosEngineeringTests();
    
    console.log('\n💡 Chaos Engineering Capabilities Demonstrated:');
    console.log('   ✅ Failure simulation with trial mode');
    console.log('   ✅ Resilience testing under various scenarios');
    console.log('   ✅ Retry strategy validation');
    console.log('   ✅ Error handling verification');
    console.log('   ✅ Recovery behavior analysis');
    console.log('   ✅ Automated resilience scoring');
    console.log('   ✅ Actionable recommendations');
    console.log('   ✅ Production readiness assessment');
    
  } catch (error) {
    console.error('❌ Chaos testing failed:', error);
    process.exit(1);
  }
})();
