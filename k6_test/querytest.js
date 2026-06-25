/**
 * =============================================================================
 * K6 QUERY TEST — PUBLIC ENDPOINT (TANPA TOKEN)
 * =============================================================================
 *
 * Menguji endpoint publik verify-certificate yang bisa diakses tanpa token
 * (digunakan untuk QR code scanning verifikasi oleh publik).
 *
 * Endpoint: GET /api/v1/documents/verify-certificate
 * - Public (tanpa authentication)
 * - Menerima query params: cert (cert number) & batch (batch ID)
 * - Me-query Hyperledger Fabric via chaincode querySeedBatch
 * - Return status sertifikat (VALID/EXPIRED/REVOKED/NOT_FOUND)
 *
 * Tidak perlu login, tidak perlu token — cocok untuk publik.
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
const querySuccess = new Counter('query_success');
const queryFailed = new Counter('query_failed');
const queryDuration = new Trend('query_duration');
const queryNotFound = new Counter('query_not_found');

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
        'query_duration': ['p(95)<5000'],     // Query duration under 5s
        'errors': ['rate<0.1'],               // Error rate less than 10%
        'http_req_failed': ['rate<0.1'],      // HTTP errors less than 10%
    },
};

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = 'https://gateway.jabarchain.me';

// =============================================================================
// TEST DATA — Batch IDs + Certificate Numbers
// =============================================================================
// Data seed-batch-dataset.json untuk variety dan commodity real
// Batch ID digenerate dinamis agar formatnya real-time
const seedBatchDataset = JSON.parse(open('./documents/seed-batch-dataset.json'));

// Certificate numbers dari dataset
const CERT_DATA = [
    { cert: '525/393/SMB/BPSBP/XI/2021', variety: 'Kopi Arabika' },
    { cert: '525/395/SMB/BPSBP/XI/2021', variety: 'Nilam' },
    { cert: '525/404/SMB/BPSBP/XI/2021', variety: 'Cengkeh' },
    { cert: '525/419/SMB.PT/BPSBP/XI/2021', variety: 'Tembakau' },
    { cert: '525/400/SMB/BPSBP/XI/2021', variety: 'Kopi Arabika' },
    { cert: '525/399/SMB/BPSBP/XI/2021', variety: 'Pala' },
    { cert: '525/407/SMB/BPSBP/XI/2021', variety: 'Lada' },
    { cert: '525/406/SMB/BPSBP/XI/2021', variety: 'Vanili' },
    { cert: '525/402/SMB/BPSBP/XI/2021', variety: 'Kopi Arabika' },
    { cert: '525/409/SMB/BPSBP/XI/2021', variety: 'Kopi Arabika' },
    { cert: '525/429/SMB/BPSBP/XI/2021', variety: 'Kelapa' },
    { cert: '525/414/SMB/BPSBP/XI/2021', variety: 'Nilam' },
    { cert: '525/412/SMB/BPSBP/XI/2021', variety: 'Seraiwangi' },
    { cert: '525/416/SMB/BPSBP/XI/2021', variety: 'Vanili' },
    { cert: '525/433/SMB/BPSBP/XII/2021', variety: 'Kopi Arabika' },
    { cert: '525/427/SMB/BPSBP/XI/2021', variety: 'Aren' },
    { cert: '525/462/SMB.PT/BPSBP/XII/2021', variety: 'Cengkeh' },
];

/**
 * Generate batch ID dengan format sama seperti create test:
 * BATCH-{Date.now()}-{random 9 chars}
 */
function generateBatchId() {
    const rand = Math.random().toString(36).substr(2, 9);
    return `BATCH-${Date.now()}-${rand}`;
}

/**
 * Generate query record (batch + cert) untuk dipakai di test
 * Batch ID: digenerate fresh (tidak dijamin exist di ledger)
 * Cert:     dari data real BPSBP
 */
function getQueryRecord(iteration) {
    const idx = iteration % CERT_DATA.length;
    const record = CERT_DATA[idx];

    return {
        batch: generateBatchId(),
        cert: record.cert,
        variety: record.variety,
    };
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
    const record = getQueryRecord(iteration);
    const queryUrl = `${API_BASE_URL}/api/v1/documents/verify-certificate` +
        `?cert=${encodeURIComponent(record.cert)}&batch=${encodeURIComponent(record.batch)}`;

    const params = {
        tags: { name: 'QueryPublicCertificate' },
    };

    const response = http.get(queryUrl, params);

    // Record response time
    queryDuration.add(response.timings.duration);

    // -------------------------------------------------------------------------
    // STEP 2: Validate response
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
            } else if (status === 'NOT_FOUND') {
                // Batch belum di-create — ini wajar karena batch ID digenerate baru
                queryNotFound.add(1);
                errorRate.add(0);
            } else if (status === 'NOT_CERTIFIED') {
                // Batch ada tapi belum disertifikasi — tetap chaincode jalan
                querySuccess.add(1);
                errorRate.add(0);
            } else {
                // EXPIRED, REVOKED, MISMATCH — masih chaincode jalan penuh
                querySuccess.add(1);
                errorRate.add(0);
            }

            if (__ITER % 10 === 0) {
                console.log(`✓ Iter ${__ITER}: batch=${record.batch} cert=${record.cert} → ${status} (${response.timings.duration}ms)`);
            }
        } catch (e) {
            queryFailed.add(1);
            errorRate.add(1);
        }
    } else {
        queryFailed.add(1);
        errorRate.add(1);
        const errBody = response.body ? String(response.body).substring(0, 300) : 'No response body';
        console.error(`✗ Query failed for ${record.batch}: ${response.status} - ${errBody}`);
    }

    // Think time — lebih pendek karena query tanpa file upload
    sleep(Math.random() * 2 + 1); // 1-3 detik
}

// =============================================================================
// SETUP
// =============================================================================
export function setup() {
    console.log('=============================================');
    console.log('K6 QUERY TEST — PUBLIC ENDPOINT');
    console.log('=============================================');
    console.log('Endpoint: GET /api/v1/documents/verify-certificate');
    console.log('Auth:     NONE (public — untuk QR code verification)');
    console.log('Target:   Max 15 VUs, ~5 menit');
    console.log(`Data:     ${CERT_DATA.length} certificate records (real BPSBP)`);
    console.log('BatchID:  Generated dinamis (format real-time)');
    console.log('Note:     NOT_FOUND expected — chaincode tetap dieksekusi');
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
    const queryDurationMetric = data.metrics.query_duration || {};
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
    const querySuccessCount = data.metrics.query_success?.values?.count || 0;
    const queryFailedCount = data.metrics.query_failed?.values?.count || 0;
    const queryNotFoundCount = data.metrics.query_not_found?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    // CSV Report
    const csvHeader = 'Timestamp,Test_Type,Total_Requests,Success_Count,Failed_Count,NotFound_Count,Error_Rate_Pct,Avg_Response_Time_ms,Med_Response_Time_ms,P95_Response_Time_ms,P99_Response_Time_ms,Min_Response_Time_ms,Max_Response_Time_ms,Throughput_RPS,Overhead_ms,Query_Avg_ms,Query_P95_ms,Test_Duration_sec';
    const csvData = `${now.toISOString()},PublicQueryCertificate,${totalRequests},${querySuccessCount},${queryFailedCount},${queryNotFoundCount},${(errorRateValue * 100).toFixed(2)},${avgResponseTime.toFixed(2)},${medResponseTime.toFixed(2)},${p95ResponseTime.toFixed(2)},${p99ResponseTime.toFixed(2)},${minResponseTime.toFixed(2)},${maxResponseTime.toFixed(2)},${throughputRPS.toFixed(4)},${overhead.toFixed(2)},${queryAvg.toFixed(2)},${queryP95.toFixed(2)},${testDuration.toFixed(2)}`;
    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/query-report-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
