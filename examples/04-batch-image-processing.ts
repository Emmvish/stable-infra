/**
 * Enterprise Example 4: Batch Image Processing with stableApiGateway
 * 
 * This example demonstrates production-grade batch processing that:
 * - Uses stableApiGateway for concurrent batch operations
 * - Implements rate limiting to respect API quotas
 * - Uses concurrency control for resource management
 * - Handles partial failures gracefully
 * - Provides progress tracking and detailed reporting
 * - Implements retry strategies for failed operations
 * - Groups requests by priority levels
 * 
 * Use Case: Process batches of images (thumbnails, watermarks, compression)
 * with rate limiting, concurrent execution, and comprehensive error handling
 */

import { 
  stableApiGateway, 
  RETRY_STRATEGIES,
  RateLimiter,
  ConcurrencyLimiter
} from '../src/index';
import type { API_GATEWAY_REQUEST } from '../src/index';

// Image processing job types
interface ImageJob {
  id: string;
  imageUrl: string;
  operations: string[];
  priority: 'high' | 'normal' | 'low';
  size: 'small' | 'medium' | 'large';
}

interface ProcessingStats {
  totalJobs: number;
  successful: number;
  failed: number;
  duration: number;
  averageTime: number;
}

// Simulated image processing jobs
const imageBatch: ImageJob[] = [
  { id: 'img-001', imageUrl: '/photos/1', operations: ['resize', 'thumbnail'], priority: 'high', size: 'large' },
  { id: 'img-002', imageUrl: '/photos/2', operations: ['watermark'], priority: 'normal', size: 'medium' },
  { id: 'img-003', imageUrl: '/photos/3', operations: ['compress'], priority: 'low', size: 'small' },
  { id: 'img-004', imageUrl: '/photos/4', operations: ['resize', 'compress'], priority: 'high', size: 'large' },
  { id: 'img-005', imageUrl: '/photos/5', operations: ['thumbnail'], priority: 'normal', size: 'small' },
  { id: 'img-006', imageUrl: '/photos/6', operations: ['watermark', 'compress'], priority: 'low', size: 'medium' },
  { id: 'img-007', imageUrl: '/photos/7', operations: ['resize'], priority: 'high', size: 'large' },
  { id: 'img-008', imageUrl: '/photos/8', operations: ['thumbnail', 'watermark'], priority: 'normal', size: 'medium' },
  { id: 'img-009', imageUrl: '/photos/9', operations: ['compress'], priority: 'low', size: 'small' },
  { id: 'img-010', imageUrl: '/photos/10', operations: ['resize', 'watermark'], priority: 'high', size: 'large' }
];

// Initialize rate limiter (20 requests per second)
const rateLimiter = new RateLimiter({
  tokensPerInterval: 20,
  interval: 1000,
  maxBurstSize: 25
});

// Initialize concurrency limiter (max 5 concurrent requests)
const concurrencyLimiter = new ConcurrencyLimiter({
  maxConcurrentRequests: 5
});

// Track processing results
const processingResults = {
  successful: [] as string[],
  failed: [] as string[],
  processingTimes: [] as number[]
};

// Process batch of images using stableApiGateway
async function processBatchImages(): Promise<ProcessingStats> {
  const startTime = Date.now();
  
  console.log('🖼️  Starting Batch Image Processing');
  console.log('═'.repeat(70));
  console.log(`Total Images: ${imageBatch.length}`);
  console.log(`Rate Limit: 20 req/sec`);
  console.log(`Concurrency Limit: 5 concurrent requests`);
  console.log(`Priority Distribution:`);
  console.log(`  High: ${imageBatch.filter(j => j.priority === 'high').length}`);
  console.log(`  Normal: ${imageBatch.filter(j => j.priority === 'normal').length}`);
  console.log(`  Low: ${imageBatch.filter(j => j.priority === 'low').length}`);
  console.log('═'.repeat(70));
  console.log('');
  
  // Convert jobs to API requests
  const requests: API_GATEWAY_REQUEST[] = imageBatch.map(job => ({
    id: job.id,
    groupId: job.priority, // Group by priority
    requestOptions: {
      reqData: {
        path: job.imageUrl,
        method: 'GET'
      },
      resReq: true,
      
      // Retry configuration based on priority
      attempts: job.priority === 'high' ? 5 : job.priority === 'normal' ? 3 : 2,
      wait: job.priority === 'high' ? 2000 : 1000,
      retryStrategy: RETRY_STRATEGIES.EXPONENTIAL,
      maxAllowedWait: 10000,
      
      // Apply rate and concurrency limiting
      rateLimiter: rateLimiter,
      concurrencyLimiter: concurrencyLimiter,
      
      // Timeout based on job size
      timeout: job.size === 'large' ? 15000 : job.size === 'medium' ? 10000 : 5000,
      
      // Success tracking
      logAllSuccessfulAttempts: true,
      handleSuccessfulAttemptData: async ({ successfulAttemptData }) => {
        processingResults.successful.push(job.id);
        processingResults.processingTimes.push(successfulAttemptData.executionTime || 0);
        
        const priorityIcon = job.priority === 'high' ? '🔴' : job.priority === 'normal' ? '🟡' : '🟢';
        console.log(`  ${priorityIcon} ${job.id}: Processed ${job.operations.join(', ')} (${successfulAttemptData.executionTime}ms)`);
      },
      
      // Error handling
      finalErrorAnalyzer: async ({ error }) => {
        processingResults.failed.push(job.id);
        console.log(`  ❌ ${job.id}: Processing failed - ${error}`);
        return true; // Suppress error to continue with other images
      }
    }
  }));
  
  console.log('🔄 Processing images...\n');
  
  // Execute batch processing with stableApiGateway
  const results = await stableApiGateway(requests, {
    // Use concurrent execution
    concurrentExecution: true,
    
    // Common configuration for all requests
    commonRequestData: {
      hostname: 'jsonplaceholder.typicode.com',
      protocol: 'https',
      headers: {
        'Content-Type': 'application/json',
        'X-Batch-ID': `BATCH-${Date.now()}`,
        'User-Agent': 'ImageProcessor/2.0'
      }
    },
    
    // Request groups with different retry strategies
    requestGroups: [
      {
        groupId: 'high',
        commonAttempts: 5,
        commonWait: 2000,
        commonRetryStrategy: RETRY_STRATEGIES.EXPONENTIAL
      },
      {
        groupId: 'normal',
        commonAttempts: 3,
        commonWait: 1000,
        commonRetryStrategy: RETRY_STRATEGIES.LINEAR
      },
      {
        groupId: 'low',
        commonAttempts: 2,
        commonWait: 500,
        commonRetryStrategy: RETRY_STRATEGIES.FIXED
      }
    ],
    
    // Don't stop on first error
    stopOnFirstError: false,
    
    // Default settings
    attempts: 3,
    wait: 1000,
    timeout: 10000,
    logAllSuccessfulAttempts: true
  });
  
  const duration = Date.now() - startTime;
  
  // Generate processing report
  console.log('\n' + '═'.repeat(70));
  console.log('📊 BATCH PROCESSING SUMMARY');
  console.log('═'.repeat(70));
  
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  
  console.log(`\nProcessing Results:`);
  console.log(`  ✅ Successful: ${successfulResults.length}/${imageBatch.length}`);
  console.log(`  ❌ Failed: ${failedResults.length}/${imageBatch.length}`);
  console.log(`  Success Rate: ${((successfulResults.length / imageBatch.length) * 100).toFixed(2)}%`);
  
  console.log(`\nPriority Breakdown:`);
  const highPriority = imageBatch.filter(j => j.priority === 'high');
  const normalPriority = imageBatch.filter(j => j.priority === 'normal');
  const lowPriority = imageBatch.filter(j => j.priority === 'low');
  
  const highSuccess = processingResults.successful.filter(id => 
    highPriority.some(j => j.id === id)
  ).length;
  const normalSuccess = processingResults.successful.filter(id => 
    normalPriority.some(j => j.id === id)
  ).length;
  const lowSuccess = processingResults.successful.filter(id => 
    lowPriority.some(j => j.id === id)
  ).length;
  
  console.log(`  🔴 High:   ${highSuccess}/${highPriority.length} successful`);
  console.log(`  🟡 Normal: ${normalSuccess}/${normalPriority.length} successful`);
  console.log(`  🟢 Low:    ${lowSuccess}/${lowPriority.length} successful`);
  
  console.log(`\nPerformance Metrics:`);
  console.log(`  Total Duration: ${duration}ms`);
  if (processingResults.processingTimes.length > 0) {
    const avgTime = processingResults.processingTimes.reduce((a, b) => a + b, 0) / processingResults.processingTimes.length;
    const minTime = Math.min(...processingResults.processingTimes);
    const maxTime = Math.max(...processingResults.processingTimes);
    
    console.log(`  Average Processing Time: ${Math.round(avgTime)}ms`);
    console.log(`  Fastest: ${minTime}ms`);
    console.log(`  Slowest: ${maxTime}ms`);
  }
  console.log(`  Throughput: ${((imageBatch.length / duration) * 1000).toFixed(2)} images/sec`);
  
  console.log(`\nResource Management:`);
  console.log(`  Rate Limiter: Active (20 req/sec)`);
  console.log(`  Concurrency Limiter: Active (5 concurrent)`);
  console.log(`  Requests Throttled: Handled smoothly`);
  
  if (failedResults.length > 0) {
    console.log(`\n⚠️  Failed Images:`);
    failedResults.forEach(result => {
      const job = imageBatch.find(j => j.id === result.requestId);
      if (job) {
        console.log(`  - ${result.requestId}: ${job.operations.join(', ')} [${job.priority}]`);
      }
    });
  }
  
  console.log('\n' + '═'.repeat(70));
  
  if (successfulResults.length === imageBatch.length) {
    console.log('✅ Batch Processing: COMPLETED SUCCESSFULLY');
  } else if (successfulResults.length >= imageBatch.length * 0.9) {
    console.log('⚠️  Batch Processing: COMPLETED WITH WARNINGS');
    console.log(`   ${failedResults.length} images require manual intervention`);
  } else {
    console.log('❌ Batch Processing: COMPLETED WITH ERRORS');
    console.log(`   ${failedResults.length} images failed to process`);
  }
  
  console.log('═'.repeat(70));
  
  return {
    totalJobs: imageBatch.length,
    successful: successfulResults.length,
    failed: failedResults.length,
    duration,
    averageTime: processingResults.processingTimes.length > 0 
      ? processingResults.processingTimes.reduce((a, b) => a + b, 0) / processingResults.processingTimes.length 
      : 0
  };
}

// Run batch processing
(async () => {
  try {
    const stats = await processBatchImages();
    
    console.log('\n💡 Batch Processing Capabilities Demonstrated:');
    console.log('   ✅ Concurrent batch operations using stableApiGateway');
    console.log('   ✅ Rate limiting for API quota management');
    console.log('   ✅ Concurrency control for resource optimization');
    console.log('   ✅ Priority-based request grouping');
    console.log('   ✅ Different retry strategies per priority level');
    console.log('   ✅ Partial failure handling');
    console.log('   ✅ Detailed progress tracking and reporting');
    console.log('   ✅ Performance metrics and throughput analysis');
    
    // Exit with appropriate code
    process.exit(stats.successful >= stats.totalJobs * 0.9 ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Batch processing failed:', error);
    process.exit(1);
  }
})();
