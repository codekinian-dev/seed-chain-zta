import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Custom metrics
const errorRate = new Rate('errors');
const seedBatchCreated = new Counter('seed_batch_created');
const seedBatchFailed = new Counter('seed_batch_failed');
const seedBatchDuration = new Trend('seed_batch_duration');

// Load PDF file once at init stage (global scope)
const pdfFileData = open('./documents/test.pdf', 'b');
const pdfFile = http.file(pdfFileData, 'test.pdf', 'application/pdf');

// Load seed batch dataset from JSON file
const seedBatchDataset = new SharedArray('seedBatchData', function () {
    return JSON.parse(open('./documents/seed-batch-dataset.json'));
});

// K6 options - Load test configuration (reduced VUs to prevent OOM)
export const options = {
    stages: [
        { duration: '30s', target: 5 },   // Ramp up to 5 users
        { duration: '1m', target: 5 },    // Stay at 5 users
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Stay at 10 users
        { duration: '30s', target: 0 },   // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<10000'], // 95% of requests must complete below 10s (blockchain + file upload)
        'seed_batch_duration': ['p(95)<10000'], // Seed batch creation under 10s
        'errors': ['rate<0.1'],                 // Error rate must be less than 10%
        'http_req_failed': ['rate<0.05'],       // HTTP errors must be less than 5%
    },
};

// API configuration
const API_BASE_URL = 'https://gateway.jabarchain.me';

// Test user credentials from query_result.csv
// These users are registered via setup-test-users.sh
const TEST_USERS = [
    { username: '1E1DFC06', password: 'Test123!' },
    { username: '46FC9A16', password: 'Test123!' },
    { username: 'B59D7AAB', password: 'Test123!' },
    { username: 'C258D1E8', password: 'Test123!' },
    { username: 'E9C38C5C', password: 'Test123!' },
    { username: '812E38B8', password: 'Test123!' },
    { username: 'FA076AF8', password: 'Test123!' },
    { username: '0604DE6E', password: 'Test123!' },
    { username: '3595C469', password: 'Test123!' },
    { username: '7BF8E819', password: 'Test123!' },
    { username: '0E540A27', password: 'Test123!' },
    { username: 'BF785D7D', password: 'Test123!' },
    { username: 'CC562ABD', password: 'Test123!' },
    { username: '51E748FE', password: 'Test123!' },
    { username: '63AF1539', password: 'Test123!' },
    { username: 'A1B9FEBB', password: 'Test123!' },
    { username: 'kpri_rati', password: 'Test123!' },
    { username: '28CF0230', password: 'Test123!' },
    { username: '91420A44', password: 'Test123!' },
    { username: '5089220F', password: 'Test123!' },
    { username: 'C362EC88', password: 'Test123!' },
    { username: 'B9741EC8', password: 'Test123!' },
    { username: '1ECD114C', password: 'Test123!' },
    { username: '7DCF7CA4', password: 'Test123!' },
    { username: '1A6A8FD7', password: 'Test123!' },
    { username: '48CA8C6A', password: 'Test123!' },
    { username: 'DC6629E6', password: 'Test123!' },
    { username: '1E845C34', password: 'Test123!' },
    { username: 'F3376F5A', password: 'Test123!' },
];


/**
 * Get access token via Gateway Login API
 */
function getAccessToken(userIndex) {
    // Select user based on VU ID to distribute load across multiple users
    const user = TEST_USERS[userIndex % TEST_USERS.length];

    const loginUrl = `${API_BASE_URL}/api/v1/identity/login`;

    const payload = JSON.stringify({
        username: user.username,
        password: user.password,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    };

    const response = http.post(loginUrl, payload, params);

    const checkRes = check(response, {
        'Gateway login successful': (r) => r.status === 200,
        'Access token received': (r) => {
            try {
                const body = r.json();
                return body.success === true && body.data?.accessToken !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    if (!checkRes) {
        console.error(`Gateway login failed for ${user.username}: ${response.status} - ${response.body}`);
        errorRate.add(1);
        return null;
    }

    return response.json('data').accessToken;
}

/**
 * Get seed batch data from dataset
 * Uses modulo to cycle through dataset entries
 */
function getSeedBatchData(iteration) {
    const timestamp = Date.now();
    const dataIndex = iteration % seedBatchDataset.length;
    const baseData = seedBatchDataset[dataIndex];

    // Map dataset fields to API expected fields
    // Add unique suffix to seedSourceNumber to avoid duplicates
    return {
        varietyName: baseData.variety,
        commodity: baseData.commodity,
        harvestDate: baseData.harvestDate,
        seedSourceNumber: `${baseData.seedSourceNumber}-${timestamp}-${iteration}`,
        origin: baseData.origin,
        iupbNumber: baseData.iupbNumber,
        seedClass: baseData.seedClass,
        declaredQuantity: baseData.declaredQuantity,
        qtyBaseUnit: 'GRAM' // Default unit
    };
}

/**
 * Main test scenario
 */
export default function () {
    // Step 1: Get access token using VU ID for user distribution
    const vuId = __VU; // Virtual User ID (1-based)
    const token = getAccessToken(vuId);

    if (!token) {
        errorRate.add(1);
        sleep(1);
        return;
    }

    // Step 2: Create seed batch using standard endpoint with file upload
    const iteration = __ITER;
    const seedData = getSeedBatchData(iteration);

    const createUrl = `${API_BASE_URL}/api/seed-batches`;

    // Use K6 native multipart/form-data (more memory efficient than FormData library)
    const formPayload = {
        varietyName: seedData.varietyName,
        commodity: seedData.commodity,
        harvestDate: seedData.harvestDate,
        seedSourceNumber: seedData.seedSourceNumber,
        origin: seedData.origin,
        iupbNumber: seedData.iupbNumber,
        seedClass: seedData.seedClass,
        declaredQuantity: String(seedData.declaredQuantity),
        qtyBaseUnit: seedData.qtyBaseUnit,
        document: pdfFile,
    };

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'CreateSeedBatch' },
    };

    const response = http.post(createUrl, formPayload, params);

    // Record response time for seed batch creation
    seedBatchDuration.add(response.timings.duration);

    // Validate response
    const checkRes = check(response, {
        'Create seed batch - status 200 or 201': (r) => r.status === 200 || r.status === 201,
        'Create seed batch - has success field': (r) => {
            try {
                return r.json('success') !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    // Check if request was successful (status 200 or 201)
    const isSuccess = response.status === 200 || response.status === 201;

    if (!isSuccess) {
        const errorBody = response.body ? String(response.body).substring(0, 500) : 'No response body';
        console.error(`Create seed batch failed: ${response.status} - ${errorBody}`);
        errorRate.add(1);
        seedBatchFailed.add(1);
    } else {
        errorRate.add(0);
        seedBatchCreated.add(1);
        // Log successful request every 5 iterations to reduce console overhead
        if (__ITER % 5 === 0) {
            console.log(`✓ Iteration ${__ITER}: Seed batch created successfully`);
        }
    }

    // Think time - simulate real user behavior and reduce memory pressure
    sleep(Math.random() * 5 + 5); // Random sleep between 5-10 seconds
}

/**
 * Setup function - runs once before test
 */
export function setup() {
    console.log('=== K6 Load Test Setup ===');
    console.log(`Target: Max 10 Virtual Users`);
    console.log(`Duration: ~3.5 minutes total`);
    console.log(`API: ${API_BASE_URL}`);
    console.log('==========================');

    return {};
}

/**
 * Teardown function - runs once after test
 */
export function teardown(data) {
    console.log('=== K6 Load Test Completed ===');
}

/**
 * Handle Summary - Generate HTML and CSV reports with timestamp
 */
export function handleSummary(data) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..*/, ''); // Format: 2025-11-28_14-30-45

    // Extract metrics for CSV
    const httpReqDuration = data.metrics.http_req_duration || {};
    const seedBatchDurationMetric = data.metrics.seed_batch_duration || {};
    const iterations = data.metrics.iterations || {};
    const httpReqs = data.metrics.http_reqs || {};

    // Calculate metrics
    const avgResponseTime = httpReqDuration.values?.avg || 0;
    const p95ResponseTime = httpReqDuration.values?.['p(95)'] || 0;
    const p99ResponseTime = httpReqDuration.values?.['p(99)'] || 0;
    const minResponseTime = httpReqDuration.values?.min || 0;
    const maxResponseTime = httpReqDuration.values?.max || 0;
    const medResponseTime = httpReqDuration.values?.med || 0;

    // Throughput (RPS) = total requests / total duration in seconds
    const totalRequests = httpReqs.values?.count || 0;
    const testDuration = (data.state?.testRunDurationMs || 390000) / 1000; // default ~6.5 min
    const throughputRPS = totalRequests / testDuration;

    // Overhead calculation (difference between total response time and actual processing)
    // Using p95 - median as a proxy for overhead/variability
    const overhead = p95ResponseTime - medResponseTime;

    // Seed batch specific metrics
    const seedBatchAvg = seedBatchDurationMetric.values?.avg || 0;
    const seedBatchP95 = seedBatchDurationMetric.values?.['p(95)'] || 0;

    // Get success/failure counts
    const seedBatchCreatedCount = data.metrics.seed_batch_created?.values?.count || 0;
    const seedBatchFailedCount = data.metrics.seed_batch_failed?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    // CSV Header and Data
    const csvHeader = 'Timestamp,Test_Type,Total_Requests,Success_Count,Failed_Count,Error_Rate_Percent,Avg_Response_Time_ms,Med_Response_Time_ms,P95_Response_Time_ms,P99_Response_Time_ms,Min_Response_Time_ms,Max_Response_Time_ms,Throughput_RPS,Overhead_ms,SeedBatch_Avg_ms,SeedBatch_P95_ms,Test_Duration_sec';
    const csvData = `${now.toISOString()},CreateSeedBatch,${totalRequests},${seedBatchCreatedCount},${seedBatchFailedCount},${(errorRateValue * 100).toFixed(2)},${avgResponseTime.toFixed(2)},${medResponseTime.toFixed(2)},${p95ResponseTime.toFixed(2)},${p99ResponseTime.toFixed(2)},${minResponseTime.toFixed(2)},${maxResponseTime.toFixed(2)},${throughputRPS.toFixed(4)},${overhead.toFixed(2)},${seedBatchAvg.toFixed(2)},${seedBatchP95.toFixed(2)},${testDuration.toFixed(2)}`;
    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/report-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
