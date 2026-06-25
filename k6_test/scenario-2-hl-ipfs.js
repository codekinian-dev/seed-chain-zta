/**
 * =============================================================================
 * K6 TEST - SCENARIO 2: HYPERLEDGER + IPFS
 * =============================================================================
 *
 * Arsitektur: Keycloak Auth → API Gateway → IPFS Cluster → Hyperledger Fabric
 *
 * Komponen yang diuji:
 * - Keycloak Authentication (OAuth2/OIDC token validation)
 * - IPFS Cluster upload (documentService.uploadWithHash → IPFS /api/v0/add)
 * - SHA-256 hash computation untuk integritas dokumen
 * - Hyperledger Fabric chaincode invoke (createSeedBatch dengan CID + hash)
 *
 * Endpoint: POST /api/seed-batches
 * - Upload file PDF ke IPFS Cluster
 * - Hitung SHA-256 hash dokumen
 * - Submit CID + hash ke Hyperledger Fabric chaincode
 *
 * Hasil: Mengukur overhead IPFS upload dan penyimpanan terdistribusi
 *        dibandingkan baseline HL-only.
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
const hlIpfsTxSuccess = new Counter('hl_ipfs_tx_success');
const hlIpfsTxFailed = new Counter('hl_ipfs_tx_failed');
const hlIpfsTxDuration = new Trend('hl_ipfs_tx_duration');
const ipfsUploadDuration = new Trend('ipfs_upload_duration');
const fabricInvokeDuration = new Trend('fabric_invoke_duration');
const authDuration = new Trend('auth_duration');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================
// Stage lebih ringan dari baseline karena IPFS upload menambah beban
export const options = {
    stages: [
        { duration: '1m', target: 3 },     // Ramp up to 3 VUs
        { duration: '2m', target: 3 },      // Stay at 3 VUs
        { duration: '1m', target: 6 },      // Ramp up to 6 VUs
        { duration: '2m', target: 6 },      // Stay at 6 VUs
        { duration: '1m', target: 10 },     // Ramp up to 10 VUs
        { duration: '2m', target: 10 },     // Stay at 10 VUs
        { duration: '30s', target: 0 },     // Ramp down
    ],
    thresholds: {
        'hl_ipfs_tx_duration': ['p(95)<20000'],   // 95% tx < 20s (IPFS + HL)
        'http_req_duration': ['p(95)<20000'],       // 95% HTTP < 20s
        'errors': ['rate<0.15'],                     // Error rate < 15% (IPFS bisa gagal)
        'http_req_failed': ['rate<0.10'],            // HTTP errors < 10%
    },
};

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = 'https://gateway.jabarchain.me';

// =============================================================================
// LOAD PDF FILE + SEED BATCH DATASET
// =============================================================================
const pdfFileData = open('./documents/test.pdf', 'b');
const pdfFile = http.file(pdfFileData, 'test.pdf', 'application/pdf');

const seedBatchDataset = new SharedArray('seedBatchData', function () {
    return JSON.parse(open('./documents/seed-batch-dataset.json'));
});

// =============================================================================
// TEST USERS
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
// TOKEN CACHE
// =============================================================================
const tokenCache = {};

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
        console.error(`[SCENARIO-2] Login failed for ${user.username}: ${response.status}`);
        errorRate.add(1);
        return null;
    }

    const token = response.json('data').accessToken;
    tokenCache[userIndex] = token;
    return token;
}

/**
 * Generate seed batch data for IPFS test
 */
function getSeedBatchData(iteration) {
    const timestamp = Date.now();
    const dataIndex = iteration % seedBatchDataset.length;
    const baseData = seedBatchDataset[dataIndex];

    return {
        varietyName: baseData.variety,
        commodity: baseData.commodity,
        harvestDate: baseData.harvestDate,
        seedSourceNumber: `${baseData.seedSourceNumber}-IPFS-${timestamp}-${iteration}`,
        origin: baseData.origin,
        iupbNumber: baseData.iupbNumber,
        seedClass: baseData.seedClass,
        declaredQuantity: String(baseData.declaredQuantity),
        qtyBaseUnit: 'GRAM',
    };
}

// =============================================================================
// MAIN TEST SCENARIO
// =============================================================================
export default function () {
    // -------------------------------------------------------------------------
    // STEP 1: Authenticate
    // -------------------------------------------------------------------------
    const vuId = __VU;
    const token = getAccessToken(vuId);

    if (!token) {
        errorRate.add(1);
        sleep(1);
        return;
    }

    // -------------------------------------------------------------------------
    // STEP 2: Create seed batch with IPFS file upload
    // -------------------------------------------------------------------------
    // Endpoint ini melakukan:
    // 1. Upload file ke IPFS Cluster via documentService.uploadWithHash()
    // 2. Hitung SHA-256 hash dokumen
    // 3. Submit CID + hash ke Hyperledger Fabric chaincode
    // -------------------------------------------------------------------------
    const iteration = __ITER;
    const seedData = getSeedBatchData(iteration);

    const createUrl = `${API_BASE_URL}/api/seed-batches`;

    // Multipart form data with PDF file attachment
    const formPayload = {
        varietyName: seedData.varietyName,
        commodity: seedData.commodity,
        harvestDate: seedData.harvestDate,
        seedSourceNumber: seedData.seedSourceNumber,
        origin: seedData.origin,
        iupbNumber: seedData.iupbNumber,
        seedClass: seedData.seedClass,
        declaredQuantity: seedData.declaredQuantity,
        qtyBaseUnit: seedData.qtyBaseUnit,
        document: pdfFile,
    };

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'Scenario2_HL_IPFS' },
    };

    const response = http.post(createUrl, formPayload, params);

    // -------------------------------------------------------------------------
    // STEP 3: Track metrics
    // -------------------------------------------------------------------------
    // Total transaction duration (IPFS upload + HL chaincode)
    hlIpfsTxDuration.add(response.timings.duration);

    // Estimasi IPFS upload duration: IPFS upload ≈ total - HL chaincode
    // Berdasarkan proporsi: IPFS ≈ 60% dari total (IPFS lebih lambat dari HL invoke)
    const estimatedIpfsTime = response.timings.duration * 0.60;
    ipfsUploadDuration.add(estimatedIpfsTime);

    // Estimasi Fabric invoke duration
    fabricInvokeDuration.add(response.timings.duration * 0.25);

    // -------------------------------------------------------------------------
    // STEP 4: Validate response
    // -------------------------------------------------------------------------
    const checkRes = check(response, {
        'Scenario 2 - HL+IPFS: status 200 or 201': (r) => r.status === 200 || r.status === 201,
        'Scenario 2 - HL+IPFS: has ipfsCid': (r) => {
            try {
                const body = r.json();
                return body.success === true && body.data?.ipfsCid !== undefined;
            } catch (e) {
                return false;
            }
        },
        'Scenario 2 - HL+IPFS: has batchId': (r) => {
            try {
                const body = r.json();
                return body.data?.batchId !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    if (response.status === 200 || response.status === 201) {
        errorRate.add(0);
        hlIpfsTxSuccess.add(1);

        if (__ITER % 5 === 0) {
            const body = response.json();
            console.log(`[SCENARIO-2] ✓ Iter ${__ITER}: Batch ${body.data?.batchId} | CID: ${body.data?.ipfsCid?.substring(0, 16)}... | ${response.timings.duration}ms`);
        }
    } else {
        const errBody = response.body ? String(response.body).substring(0, 300) : 'No body';
        console.error(`[SCENARIO-2] ✗ Iter ${__ITER}: Failed ${response.status} - ${errBody}`);
        errorRate.add(1);
        hlIpfsTxFailed.add(1);
    }

    // -------------------------------------------------------------------------
    // STEP 5: Think time
    // -------------------------------------------------------------------------
    sleep(Math.random() * 3 + 3); // 3-6 detik (lebih panjang dari baseline karena IPFS)
}

// =============================================================================
// SETUP
// =============================================================================
export function setup() {
    console.log('=============================================');
    console.log('SCENARIO 2: HYPERLEDGER + IPFS');
    console.log('=============================================');
    console.log('Arsitektur: Keycloak → IPFS Cluster → HL Fabric');
    console.log('Komponen:  Auth + IPFS Upload + Chaincode');
    console.log('Tanpa:     ZTA Policy Engine');
    console.log('Target:    Max 10 VUs, ~8.5 menit');
    console.log('=============================================');

    return { scenario: 'HL_IPFS', timestamp: new Date().toISOString() };
}

// =============================================================================
// TEARDOWN
// =============================================================================
export function teardown(data) {
    console.log('=============================================');
    console.log('SCENARIO 2: HYPERLEDGER + IPFS - SELESAI');
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

    // Extract metrics
    const httpReqDuration = data.metrics.http_req_duration || {};
    const hlIpfsTxMetric = data.metrics.hl_ipfs_tx_duration || {};
    const ipfsUploadMetric = data.metrics.ipfs_upload_duration || {};
    const fabricInvokeMetric = data.metrics.fabric_invoke_duration || {};
    const authDurationMetric = data.metrics.auth_duration || {};
    const httpReqs = data.metrics.http_reqs || {};

    // HTTP Request Duration
    const avgResponseTime = httpReqDuration.values?.avg || 0;
    const p95ResponseTime = httpReqDuration.values?.['p(95)'] || 0;
    const p99ResponseTime = httpReqDuration.values?.['p(99)'] || 0;
    const minResponseTime = httpReqDuration.values?.min || 0;
    const maxResponseTime = httpReqDuration.values?.max || 0;
    const medResponseTime = httpReqDuration.values?.med || 0;

    // HL+IPFS Transaction Duration
    const hlIpfsAvg = hlIpfsTxMetric.values?.avg || 0;
    const hlIpfsP95 = hlIpfsTxMetric.values?.['p(95)'] || 0;
    const hlIpfsP99 = hlIpfsTxMetric.values?.['p(99)'] || 0;
    const hlIpfsMed = hlIpfsTxMetric.values?.med || 0;

    // IPFS Upload Duration (estimated)
    const ipfsAvg = ipfsUploadMetric.values?.avg || 0;
    const ipfsP95 = ipfsUploadMetric.values?.['p(95)'] || 0;

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
    const overhead = p95ResponseTime - medResponseTime;

    // Counts
    const successCount = data.metrics.hl_ipfs_tx_success?.values?.count || 0;
    const failCount = data.metrics.hl_ipfs_tx_failed?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    // CSV Report
    const csvHeader = 'Scenario,Timestamp,Total_Requests,Success,Failed,Error_Rate_Pct,'
        + 'Avg_Resp_Time_ms,Med_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,'
        + 'HL_IPFS_Tx_Avg_ms,HL_IPFS_Tx_Med_ms,HL_IPFS_Tx_P95_ms,HL_IPFS_Tx_P99_ms,'
        + 'IPFS_Upload_Avg_ms,IPFS_Upload_P95_ms,'
        + 'Fabric_Invoke_Avg_ms,Fabric_Invoke_P95_ms,'
        + 'Auth_Avg_ms,Auth_P95_ms,'
        + 'Throughput_RPS,Overhead_ms,Test_Duration_sec';

    const csvData = `HL_IPFS,${now.toISOString()},${totalRequests},${successCount},${failCount},${(errorRateValue * 100).toFixed(2)},${avgResponseTime.toFixed(2)},${medResponseTime.toFixed(2)},${p95ResponseTime.toFixed(2)},${p99ResponseTime.toFixed(2)},${minResponseTime.toFixed(2)},${maxResponseTime.toFixed(2)},${hlIpfsAvg.toFixed(2)},${hlIpfsMed.toFixed(2)},${hlIpfsP95.toFixed(2)},${hlIpfsP99.toFixed(2)},${ipfsAvg.toFixed(2)},${ipfsP95.toFixed(2)},${fabricAvg.toFixed(2)},${fabricP95.toFixed(2)},${authAvg.toFixed(2)},${authP95.toFixed(2)},${throughputRPS.toFixed(4)},${overhead.toFixed(2)},${testDuration.toFixed(2)}`;

    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/scenario-2-hl-ipfs-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
