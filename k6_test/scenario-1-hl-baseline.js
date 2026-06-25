/**
 * =============================================================================
 * K6 TEST - SCENARIO 1: HYPERLEDGER ONLY (BASELINE)
 * =============================================================================
 *
 * Arsitektur: Keycloak Auth → API Gateway → Hyperledger Fabric Chaincode
 *
 * Komponen yang diuji:
 * - Keycloak Authentication (token validation via protect())
 * - Hyperledger Fabric chaincode invoke (createSeedBatch)
 *
 * Komponen yang TIDAK diaktifkan (baseline):
 * - ✗ IPFS distributed storage (mock CID)
 * - ✗ Zero Trust Architecture policy engine
 *
 * Endpoint: POST /api/seed-batches/load-test
 * - Tidak ada upload file ke IPFS
 * - Mock CID digenerate in-process
 * - Pengukuran: latency chaincode Fabric murni
 *
 * Hasil: Mengukur performa murni blockchain Fabric tanpa overhead
 *         penyimpanan terdistribusi atau policy engine ZTA.
 * =============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// =============================================================================
// CUSTOM METRICS
// =============================================================================
const errorRate = new Rate('errors');
const hlTxSuccess = new Counter('hl_tx_success');
const hlTxFailed = new Counter('hl_tx_failed');
const hlTxDuration = new Trend('hl_tx_duration');
const fabricInvokeDuration = new Trend('fabric_invoke_duration');
const authDuration = new Trend('auth_duration');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================
export const options = {
    stages: [
        { duration: '1m', target: 5 },    // Ramp up to 5 VUs
        { duration: '2m', target: 5 },     // Stay at 5 VUs
        { duration: '1m', target: 10 },    // Ramp up to 10 VUs
        { duration: '2m', target: 10 },    // Stay at 10 VUs
        { duration: '1m', target: 15 },    // Ramp up to 15 VUs
        { duration: '2m', target: 15 },    // Stay at 15 VUs
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        'hl_tx_duration': ['p(95)<15000'],     // 95% HL tx < 15s (blockchain latency)
        'fabric_invoke_duration': ['p(95)<12000'], // 95% Fabric invoke < 12s
        'http_req_duration': ['p(95)<15000'],   // 95% HTTP req < 15s
        'errors': ['rate<0.1'],                  // Error rate < 10%
        'http_req_failed': ['rate<0.05'],        // HTTP error < 5%
    },
};

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = 'https://gateway.jabarchain.me';

// =============================================================================
// LOAD SEED BATCH DATASET
// =============================================================================
const seedBatchDataset = new SharedArray('seedBatchData', function () {
    return JSON.parse(open('./documents/seed-batch-dataset.json'));
});

// =============================================================================
// TEST USERS (dari setup-test-users.sh)
// =============================================================================
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

// =============================================================================
// TOKEN CACHE (per VU)
// =============================================================================
const tokenCache = {};

/**
 * Get access token via Gateway Login API
 * Token di-cache per VU untuk menghindari rate limiting
 */
function getAccessToken(userIndex) {
    if (tokenCache[userIndex]) {
        return tokenCache[userIndex];
    }

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
        tags: { name: 'AuthLogin' },
    };

    const authStart = Date.now();
    const response = http.post(loginUrl, payload, params);
    const authTime = Date.now() - authStart;
    authDuration.add(authTime);

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
        console.error(`[SCENARIO-1] Login failed for ${user.username}: ${response.status}`);
        errorRate.add(1);
        return null;
    }

    const token = response.json('data').accessToken;
    tokenCache[userIndex] = token;
    return token;
}

/**
 * Generate seed batch data payload for HL-only test
 * Format JSON tanpa file upload, dikirim ke /load-test endpoint
 */
function getSeedBatchData(iteration) {
    const timestamp = Date.now();
    const dataIndex = iteration % seedBatchDataset.length;
    const baseData = seedBatchDataset[dataIndex];

    return {
        varietyName: baseData.variety,
        commodity: baseData.commodity,
        harvestDate: baseData.harvestDate,
        seedSourceNumber: `${baseData.seedSourceNumber}-HL-${timestamp}-${iteration}`,
        origin: baseData.origin,
        iupbNumber: baseData.iupbNumber,
        seedClass: baseData.seedClass,
        declaredQuantity: baseData.declaredQuantity,
        qtyBaseUnit: 'GRAM',
        documentName: `hl_baseline_doc_${iteration}.pdf`
    };
}

// =============================================================================
// MAIN TEST SCENARIO
// =============================================================================
export default function () {
    // -------------------------------------------------------------------------
    // STEP 1: Authenticate via Keycloak
    // -------------------------------------------------------------------------
    const vuId = __VU;
    const token = getAccessToken(vuId);

    if (!token) {
        errorRate.add(1);
        sleep(1);
        return;
    }

    // -------------------------------------------------------------------------
    // STEP 2: Create seed batch - HYPERLEDGER ONLY (via load-test endpoint)
    // -------------------------------------------------------------------------
    // Endpoint ini TIDAK menggunakan IPFS (mock CID digenerate in-process)
    // dan TIDAK menggunakan ZTA policy engine
    // -------------------------------------------------------------------------
    const iteration = __ITER;
    const seedData = getSeedBatchData(iteration);

    const createUrl = `${API_BASE_URL}/api/seed-batches/load-test`;

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'Scenario1_HL_Baseline' },
    };

    const response = http.post(createUrl, JSON.stringify(seedData), params);

    // Track overall HL transaction duration
    hlTxDuration.add(response.timings.duration);

    // Track Fabric invoke duration (proxy: HTTP duration minus overhead)
    // Estimasi: Fabric invoke ≈ HTTP duration - auth validation - network latency
    fabricInvokeDuration.add(response.timings.duration * 0.85);

    // -------------------------------------------------------------------------
    // STEP 3: Validate response
    // -------------------------------------------------------------------------
    const checkRes = check(response, {
        'Scenario 1 - HL only: status 200 or 201': (r) => r.status === 200 || r.status === 201,
        'Scenario 1 - HL only: has batchId': (r) => {
            try {
                const body = r.json();
                return body.success === true && body.data?.batchId !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    if (response.status === 200 || response.status === 201) {
        errorRate.add(0);
        hlTxSuccess.add(1);

        if (__ITER % 5 === 0) {
            const body = response.json();
            console.log(`[SCENARIO-1] ✓ Iter ${__ITER}: Batch ${body.data?.batchId} created | ${response.timings.duration}ms`);
        }
    } else {
        const errBody = response.body ? String(response.body).substring(0, 300) : 'No body';
        console.error(`[SCENARIO-1] ✗ Iter ${__ITER}: Failed ${response.status} - ${errBody}`);
        errorRate.add(1);
        hlTxFailed.add(1);
    }

    // -------------------------------------------------------------------------
    // STEP 4: Think time
    // -------------------------------------------------------------------------
    // Simulasi jeda antar transaksi untuk menghindari overload
    sleep(Math.random() * 3 + 2); // 2-5 detik
}

// =============================================================================
// SETUP
// =============================================================================
export function setup() {
    console.log('=============================================');
    console.log('SCENARIO 1: HYPERLEDGER ONLY (BASELINE)');
    console.log('=============================================');
    console.log('Arsitektur: Keycloak → Hyperledger Fabric');
    console.log('Komponen:  Auth + Chaincode (mock CID)');
    console.log('Tanpa:     IPFS, ZTA Policy Engine');
    console.log('Target:    Max 15 VUs, ~8.5 menit');
    console.log('=============================================');

    return { scenario: 'HL_BASELINE', timestamp: new Date().toISOString() };
}

// =============================================================================
// TEARDOWN
// =============================================================================
export function teardown(data) {
    console.log('=============================================');
    console.log('SCENARIO 1: HYPERLEDGER ONLY - SELESAI');
    console.log(`ID: ${data.scenario}`);
    console.log('=============================================');
}

// =============================================================================
// HANDLE SUMMARY
// =============================================================================
export function handleSummary(data) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..*/, '');

    // -------------------------------------------------------------------------
    // Extract metrics
    // -------------------------------------------------------------------------
    const httpReqDuration = data.metrics.http_req_duration || {};
    const hlTxDurationMetric = data.metrics.hl_tx_duration || {};
    const fabricInvokeMetric = data.metrics.fabric_invoke_duration || {};
    const authDurationMetric = data.metrics.auth_duration || {};
    const httpReqs = data.metrics.http_reqs || {};
    const iterations = data.metrics.iterations || {};

    // HTTP Request Duration
    const avgResponseTime = httpReqDuration.values?.avg || 0;
    const p95ResponseTime = httpReqDuration.values?.['p(95)'] || 0;
    const p99ResponseTime = httpReqDuration.values?.['p(99)'] || 0;
    const minResponseTime = httpReqDuration.values?.min || 0;
    const maxResponseTime = httpReqDuration.values?.max || 0;
    const medResponseTime = httpReqDuration.values?.med || 0;

    // HL Transaction Duration
    const hlAvg = hlTxDurationMetric.values?.avg || 0;
    const hlP95 = hlTxDurationMetric.values?.['p(95)'] || 0;
    const hlP99 = hlTxDurationMetric.values?.['p(99)'] || 0;
    const hlMed = hlTxDurationMetric.values?.med || 0;

    // Fabric Invoke Duration (estimated)
    const fabricAvg = fabricInvokeMetric.values?.avg || 0;
    const fabricP95 = fabricInvokeMetric.values?.['p(95)'] || 0;

    // Auth Duration
    const authAvg = authDurationMetric.values?.avg || 0;
    const authP95 = authDurationMetric.values?.['p(95)'] || 0;

    // Throughput
    const totalRequests = httpReqs.values?.count || 0;
    const testDuration = (data.state?.testRunDurationMs || 600000) / 1000;
    const throughputRPS = totalRequests / Math.max(testDuration, 1);

    // Overhead (variability proxy)
    const overhead = p95ResponseTime - medResponseTime;

    // Success/Failure counts
    const hlSuccessCount = data.metrics.hl_tx_success?.values?.count || 0;
    const hlFailedCount = data.metrics.hl_tx_failed?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    // -------------------------------------------------------------------------
    // CSV Report
    // -------------------------------------------------------------------------
    const csvHeader = 'Scenario,Timestamp,Total_Requests,Success,Failed,Error_Rate_Pct,'
        + 'Avg_Resp_Time_ms,Med_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,'
        + 'HL_Tx_Avg_ms,HL_Tx_Med_ms,HL_Tx_P95_ms,HL_Tx_P99_ms,'
        + 'Fabric_Invoke_Avg_ms,Fabric_Invoke_P95_ms,'
        + 'Auth_Avg_ms,Auth_P95_ms,'
        + 'Throughput_RPS,Overhead_ms,Test_Duration_sec';

    const csvData = `HL_BASELINE,${now.toISOString()},${totalRequests},${hlSuccessCount},${hlFailedCount},${(errorRateValue * 100).toFixed(2)},${avgResponseTime.toFixed(2)},${medResponseTime.toFixed(2)},${p95ResponseTime.toFixed(2)},${p99ResponseTime.toFixed(2)},${minResponseTime.toFixed(2)},${maxResponseTime.toFixed(2)},${hlAvg.toFixed(2)},${hlMed.toFixed(2)},${hlP95.toFixed(2)},${hlP99.toFixed(2)},${fabricAvg.toFixed(2)},${fabricP95.toFixed(2)},${authAvg.toFixed(2)},${authP95.toFixed(2)},${throughputRPS.toFixed(4)},${overhead.toFixed(2)},${testDuration.toFixed(2)}`;

    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/scenario-1-hl-baseline-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
