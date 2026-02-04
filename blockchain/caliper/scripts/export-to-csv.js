#!/usr/bin/env node
/**
 * Script untuk mengkonversi Caliper HTML Report ke CSV
 * Usage: node scripts/export-to-csv.js <html-report-path> [output-csv-path]
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
    console.log('Usage: node export-to-csv.js <html-report-path> [output-csv-path]');
    console.log('Example: node export-to-csv.js reports/report-scenario-a.html reports/report-scenario-a.csv');
    process.exit(1);
}

const htmlPath = args[0];
const csvPath = args[1] || htmlPath.replace('.html', '.csv');

// Read HTML file
const htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Extract table data from HTML
function extractTableData(html) {
    const results = [];

    // Find all table rows with benchmark data
    // Caliper HTML reports have specific table structure
    const tableRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi;
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

    const rows = html.match(tableRegex) || [];

    rows.forEach(row => {
        const cells = [];
        let match;
        const tempRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

        while ((match = tempRegex.exec(row)) !== null) {
            // Clean HTML tags and whitespace
            let cellContent = match[1]
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .trim();
            cells.push(cellContent);
        }

        if (cells.length > 0) {
            results.push(cells);
        }
    });

    return results;
}

// Extract benchmark summary from Caliper HTML
function extractBenchmarkSummary(html) {
    const summaryData = [];

    // Header row for CSV
    summaryData.push([
        'Name',
        'Succ',
        'Fail',
        'Send Rate (TPS)',
        'Max Latency (s)',
        'Min Latency (s)',
        'Avg Latency (s)',
        'Throughput (TPS)'
    ]);

    // Regular expression to find benchmark round data
    // Caliper generates tables with specific structure
    const benchmarkRegex = /<tr[^>]*class="[^"]*"[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;

    let match;
    while ((match = benchmarkRegex.exec(html)) !== null) {
        const row = [];
        for (let i = 1; i <= 8; i++) {
            if (match[i]) {
                row.push(match[i].replace(/<[^>]*>/g, '').trim());
            }
        }
        if (row.length > 0 && row[0] && !row[0].includes('Name')) {
            summaryData.push(row);
        }
    }

    return summaryData;
}

// Alternative: Parse JSON data embedded in HTML (if available)
function extractJsonData(html) {
    const jsonRegex = /var\s+benchmarkData\s*=\s*(\{[\s\S]*?\});/;
    const match = html.match(jsonRegex);

    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Convert data to CSV format
function toCSV(data) {
    return data.map(row => {
        return row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
                return `"${cell.replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(',');
    }).join('\n');
}

// Main execution
console.log(`Converting ${htmlPath} to CSV...`);

try {
    // Try to extract benchmark summary
    const summaryData = extractBenchmarkSummary(htmlContent);

    if (summaryData.length > 1) {
        const csvContent = toCSV(summaryData);
        fs.writeFileSync(csvPath, csvContent);
        console.log(`✅ CSV report saved to: ${csvPath}`);
        console.log(`   Rows exported: ${summaryData.length - 1}`);
    } else {
        // Fallback: extract all table data
        const tableData = extractTableData(htmlContent);

        if (tableData.length > 0) {
            const csvContent = toCSV(tableData);
            fs.writeFileSync(csvPath, csvContent);
            console.log(`✅ CSV report saved to: ${csvPath}`);
            console.log(`   Rows exported: ${tableData.length}`);
        } else {
            console.log('⚠️  No benchmark data found in HTML report');
            console.log('   Make sure the HTML file is a valid Caliper report');
        }
    }

    // Also extract JSON if available
    const jsonData = extractJsonData(htmlContent);
    if (jsonData) {
        const jsonPath = csvPath.replace('.csv', '-raw.json');
        fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
        console.log(`✅ JSON data also saved to: ${jsonPath}`);
    }

} catch (error) {
    console.error('❌ Error converting report:', error.message);
    process.exit(1);
}
