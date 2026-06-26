/**
 * =============================================================================
 * THROUGHPUT CEILING — QUERY 1: PUBLIC (BASELINE)
 * =============================================================================
 *
 * Endpoint: GET /api/v1/documents/verify-certificate
 * Tanpa auth. Tanpa sleep. constant-arrival-rate.
 * =============================================================================
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const errorRate = new Rate('errors');
const TARGET_RATE = __ENV.RATE ? parseInt(__ENV.RATE) : 5;

export const options = {
    scenarios: {
        throughput_test: {
            executor: 'constant-arrival-rate',
            rate: TARGET_RATE,
            timeUnit: '1s',
            duration: '2m',
            preAllocatedVUs: 20,
            maxVUs: 100,
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<3000'],
        'http_req_failed': ['rate<0.05'],
    },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://gateway.jabarchain.me';

const BATCH_IDS = [
    'BATCH-20260625-F58F20E6', 'BATCH-20260625-EA58B7D5',
    'BATCH-20260625-B0C7838E', 'BATCH-20260625-C9FF46D7',
    'BATCH-20260625-38111C6F', 'BATCH-20260625-0483485D',
    'BATCH-20260625-E5385FA6', 'BATCH-20260625-86839FCF',
    'BATCH-20260625-6AB13F8B', 'BATCH-20260625-3C1F7827',
    'BATCH-20260625-76EB4241',
];

export default function () {
    const batchId = BATCH_IDS[__ITER % BATCH_IDS.length];
    const url = `${API_BASE_URL}/api/v1/documents/verify-certificate?cert=TEST-CERT&batch=${batchId}`;

    const response = http.get(url, { tags: { name: 'TP_Q1_Public' } });

    if (response.status === 200) {
        errorRate.add(0);
    } else {
        errorRate.add(1);
    }
    // TANPA SLEEP
}

export function setup() {
    console.log(`=== TP-QUERY-1 PUBLIC | Rate=${TARGET_RATE} req/s | Duration=2m ===`);
}

export function handleSummary(data) {
    const now = new Date();
    const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..*/, '');
    const r = data.metrics.http_req_duration || {};
    const h = data.metrics.http_reqs || {};
    const d = (data.state?.testRunDurationMs || 120000) / 1000;
    const throughput = (h.values?.rate || 0);

    const csv = `Scenario,Target_Rate,Actual_RPS,Avg_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Error_Rate,Total_Requests,Test_Duration_sec\nTP_QUERY1_PUBLIC,${TARGET_RATE},${throughput.toFixed(4)},${(r.values?.avg||0).toFixed(2)},${(r.values?.['p(95)']||0).toFixed(2)},${(r.values?.['p(99)']||0).toFixed(2)},${(r.values?.min||0).toFixed(2)},${(r.values?.max||0).toFixed(2)},${(data.metrics.errors?.values?.rate||0).toFixed(4)},${h.values?.count||0},${d.toFixed(2)}`;

    return {
        [`reports/tp-query-1-public-rate-${TARGET_RATE}-${ts}.csv`]: csv,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
