/**
 * =============================================================================
 * K6 QUERY TEST — SCENARIO 1: BASELINE (PUBLIC, TANPA AUTH)
 * =============================================================================
 *
 * Arsitektur: Client → API Gateway (tanpa middleware) → Hyperledger Fabric
 *
 * Menguji endpoint publik verify-certificate tanpa authentication.
 * Komponen: Chaincode querySeedBatch murni.
 * Tanpa:    Auth, ZTA Policy Engine, IPFS retrieval.
 *
 * Endpoint: GET /api/v1/documents/verify-certificate?batch=...
 * - Public (tanpa token)
 * - Query batch dari CouchDB
 * - Fokus pada latency chaincode Fabric murni
 * =============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// =============================================================================
// CUSTOM METRICS
// =============================================================================
const errorRate = new Rate('errors');
const querySuccess = new Counter('q1_success');
const queryFailed = new Counter('q1_failed');
const queryDuration = new Trend('q1_duration');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================
// Ramp VUs disamakan dengan scenario create (baseline):
// 30s:5 → 1m:5 → 30s:10 → 1m:10 → 30s:15 → 1m:15 → 30s:0
export const options = {
    stages: [
        { duration: '30s', target: 5 },    // Ramp up to 5 VUs
        { duration: '1m', target: 5 },     // Stay at 5 VUs
        { duration: '30s', target: 10 },   // Ramp up to 10 VUs
        { duration: '1m', target: 10 },    // Stay at 10 VUs
        { duration: '30s', target: 15 },   // Ramp up to 15 VUs
        { duration: '1m', target: 15 },    // Stay at 15 VUs
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<5000'],  // 95% of requests must complete below 5s
        'q1_duration': ['p(95)<5000'],
        'errors': ['rate<0.1'],               // Error rate less than 10%
        'http_req_failed': ['rate<0.1'],      // HTTP errors less than 10%
    },
};

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = 'https://gateway.jabarchain.me';

// =============================================================================
// TEST DATA — Batch IDs REAL dari CouchDB + Certificate Numbers
// =============================================================================
// Batch ID ini diambil langsung dari CouchDB (state ledger) setelah create test
// dijalankan — dijamin exist di Hyperledger Fabric.
// Certificate number diisi placeholder karena batch baru di-create belum
// melalui workflow sertifikasi, response akan NOT_CERTIFIED.
// Chaincode querySeedBatch tetap dieksekusi penuh untuk mencari batch.
const BATCH_IDS = [
    'BATCH-20260625-F58F20E6',
    'BATCH-20260625-EA58B7D5',
    'BATCH-20260625-B0C7838E',
    'BATCH-20260625-C9FF46D7',
    'BATCH-20260625-38111C6F',
    'BATCH-20260625-0483485D',
    'BATCH-20260625-E5385FA6',
    'BATCH-20260625-86839FCF',
    'BATCH-20260625-6AB13F8B',
    'BATCH-20260625-3C1F7827',
    'BATCH-20260625-76EB4241',
];

/**
 * Dapatkan batch ID secara round-robin untuk testing
 */
function getBatchId(iteration) {
    const idx = iteration % BATCH_IDS.length;
    return BATCH_IDS[idx];
}

// =============================================================================
// MAIN TEST SCENARIO — PUBLIC QUERY TANPA TOKEN
// =============================================================================
export default function () {
    // -------------------------------------------------------------------------
    // STEP 1: Query certificate — PUBLIC ENDPOINT, NO AUTH REQUIRED
    // -------------------------------------------------------------------------
    // Endpoint ini dirancang untuk QR code scanning oleh publik tanpa login.
    // Middleware: tidak ada protect(), tidak ada enforcePolicy()
    // Langsung: documentController.verifyCertificate → fabricService.queryChaincode
    //
    // Query params:
    //   cert  — Certificate number (dari QR code / data real BPSBP)
    //   batch — Batch ID (digenerate dinamis, sama format dengan create test)
    //
    // Response status:
    //   VALID       — Batch & cert ditemukan dan cocok
    //   NOT_FOUND   — Batch tidak ditemukan (belum di-create)
    //   NOT_CERTIFIED — Batch ada tapi belum punya sertifikat
    //   MISMATCH    — Cert number tidak cocok dengan batch
    //   EXPIRED     — Sertifikat kedaluwarsa
    //   REVOKED     — Sertifikat dicabut
    //
    // NOTE: Batch ID digenerate fresh (tidak exist di ledger karena belum
    // di-create). Chaincode querySeedBatch tetap dieksekusi penuh sehingga
    // latency yang diukur realistik — response NOT_FOUND tetap valid untuk
    // pengujian performa.
    // -------------------------------------------------------------------------
    const iteration = __ITER;
    const batchId = getBatchId(iteration);
    const queryUrl = `${API_BASE_URL}/api/v1/documents/verify-certificate` +
        `?cert=TEST-CERT&batch=${encodeURIComponent(batchId)}`;

    const params = {
        tags: { name: 'QueryScenario1_Public' },
    };

    const response = http.get(queryUrl, params);

    // Record response time
    queryDuration.add(response.timings.duration);

    // -------------------------------------------------------------------------
    // STEP 2: Validate response
    // -------------------------------------------------------------------------
    // Batch ID dari CouchDB dijamin exist. Response NOT_CERTIFIED expected
    // karena batch baru belum melalui workflow sertifikasi penuh.
    // Chaincode querySeedBatch tetap dieksekusi penuh — latency realistik.
    // -------------------------------------------------------------------------
    const checkRes = check(response, {
        'Query certificate - status 200': (r) => r.status === 200,
        'Query certificate - valid response': (r) => {
            try {
                const body = r.json();
                return body.success === true;
            } catch (e) {
                return false;
            }
        },
    });

    // Analyze response status
    if (response.status === 200) {
        try {
            const body = response.json();
            const status = body.status;

            if (status === 'VALID') {
                querySuccess.add(1);
                errorRate.add(0);
            } else if (status === 'NOT_CERTIFIED' || status === 'NOT_FOUND') {
                // NOT_CERTIFIED = batch exist tapi belum sertifikasi (expected)
                // NOT_FOUND bisa kena batch expired — tetap valid untuk performance test
                querySuccess.add(1);
                errorRate.add(0);
            } else {
                // EXPIRED, REVOKED, MISMATCH — chaincode tetap jalan penuh
                querySuccess.add(1);
                errorRate.add(0);
            }

            if (__ITER % 5 === 0) {
                console.log(`✓ Iter ${__ITER}: ${batchId} → ${body.status} (${response.timings.duration}ms)`);
            }
        } catch (e) {
            queryFailed.add(1);
            errorRate.add(1);
        }
    } else {
        queryFailed.add(1);
        errorRate.add(1);
        const errBody = response.body ? String(response.body).substring(0, 300) : 'No response body';
        console.error(`✗ Query failed: ${response.status} - ${errBody}`);
    }

    // Think time — lebih pendek karena query tanpa file upload
    sleep(Math.random() * 2 + 1); // 1-3 detik
}

// =============================================================================
// SETUP
// =============================================================================
export function setup() {
    console.log('=============================================');
    console.log('QUERY SCENARIO 1: PUBLIC (BASELINE)');
    console.log('=============================================');
    console.log('Arsitektur: Client → QueryChaincode (tanpa middleware)');
    console.log('Endpoint:   GET /api/v1/documents/verify-certificate');
    console.log('Auth:       NONE');
    console.log('Komponen:   Chaincode Fabric murni');
    console.log('Tanpa:      Auth, ZTA, IPFS');
    console.log('Target:     Max 15 VUs, ~5 menit');
    console.log(`Batch:      ${BATCH_IDS.length} ID dari CouchDB`);
    console.log('=============================================');

    return { testType: 'PUBLIC_QUERY' };
}

// =============================================================================
// TEARDOWN
// =============================================================================
export function teardown(data) {
    console.log('=============================================');
    console.log('K6 QUERY TEST — SELESAI');
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
    const queryDurationMetric = data.metrics.q1_duration || {};
    const httpReqs = data.metrics.http_reqs || {};

    // Calculate metrics
    const avgResponseTime = httpReqDuration.values?.avg || 0;
    const p95ResponseTime = httpReqDuration.values?.['p(95)'] || 0;
    const p99ResponseTime = httpReqDuration.values?.['p(99)'] || 0;
    const minResponseTime = httpReqDuration.values?.min || 0;
    const maxResponseTime = httpReqDuration.values?.max || 0;
    const medResponseTime = httpReqDuration.values?.med || 0;

    // Throughput
    const totalRequests = httpReqs.values?.count || 0;
    const testDuration = (data.state?.testRunDurationMs || 300000) / 1000;
    const throughputRPS = totalRequests / Math.max(testDuration, 1);
    const overhead = p95ResponseTime - medResponseTime;

    // Query specific metrics
    const queryAvg = queryDurationMetric.values?.avg || 0;
    const queryP95 = queryDurationMetric.values?.['p(95)'] || 0;

    // Get counts
    const querySuccessCount = data.metrics.q1_success?.values?.count || 0;
    const queryFailedCount = data.metrics.q1_failed?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    // CSV Report
    const csvHeader = 'Timestamp,Test_Type,Total_Requests,Success_Count,Failed_Count,NotFound_Count,Error_Rate_Pct,Avg_Response_Time_ms,Med_Response_Time_ms,P95_Response_Time_ms,P99_Response_Time_ms,Min_Response_Time_ms,Max_Response_Time_ms,Throughput_RPS,Overhead_ms,Query_Avg_ms,Query_P95_ms,Test_Duration_sec';
    const csvData = `${now.toISOString()},PublicQueryCertificate,${totalRequests},${querySuccessCount},${queryFailedCount},${queryNotFoundCount},${(errorRateValue * 100).toFixed(2)},${avgResponseTime.toFixed(2)},${medResponseTime.toFixed(2)},${p95ResponseTime.toFixed(2)},${p99ResponseTime.toFixed(2)},${minResponseTime.toFixed(2)},${maxResponseTime.toFixed(2)},${throughputRPS.toFixed(4)},${overhead.toFixed(2)},${queryAvg.toFixed(2)},${queryP95.toFixed(2)},${testDuration.toFixed(2)}`;
    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/query-q1-public-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
