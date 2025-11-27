const fs = require('fs');
const path = require('path');

const count = 100000;
const dataset = [];

const varieties = [
    'Kelapa Dalam', 'Kelapa Hibrida', 'Kelapa Sawit Tenera', 'Kelapa Sawit Dura',
    'Karet IRR 118', 'Karet PB 260', 'Kopi Arabika Gayo', 'Kopi Robusta Lampung',
    'Kakao Forastero', 'Kakao Criollo'
];

const commodities = [
    'Kelapa', 'Kelapa Sawit', 'Karet', 'Kopi Arabika', 'Kopi Robusta',
    'Kakao', 'Teh', 'Tebu', 'Tembakau', 'Cengkeh'
];

const origins = [
    'Bandung', 'Bogor', 'Cianjur', 'Sukabumi', 'Garut',
    'Tasikmalaya', 'Kuningan', 'Majalengka', 'Sumedang', 'Purwakarta'
];

const seedClasses = ['BS', 'BD', 'BP', 'BR'];

const producerUUIDs = [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440004',
    '550e8400-e29b-41d4-a716-446655440005'
];

console.log('Generating dataset...');

for (let i = 0; i < count; i++) {
    const varietyIndex = Math.floor(Math.random() * varieties.length);
    const variety = varieties[varietyIndex];
    const commodity = commodities[Math.min(varietyIndex, commodities.length - 1)];
    const origin = origins[Math.floor(Math.random() * origins.length)];
    const seedClass = seedClasses[Math.floor(Math.random() * seedClasses.length)];

    const harvestDate = new Date();
    harvestDate.setDate(harvestDate.getDate() - Math.floor(Math.random() * 180));

    const seedSourceNumber = `SSN-${Date.now()}-${i}`;
    const iupNumber = `IUP-${10000 + i}`;
    const producerUUID = producerUUIDs[Math.floor(Math.random() * producerUUIDs.length)];
    const seedSourceDocName = `Dokumen Sumber Benih ${seedSourceNumber}`;

    // Generate valid 46-character IPFS CIDv0
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let seedSourceIpfsCid = 'Qm';
    for (let j = 0; j < 44; j++) {
        seedSourceIpfsCid += base58Chars.charAt(Math.floor(Math.random() * base58Chars.length));
    }

    dataset.push({
        batchId: `BATCH-${i}`,
        variety,
        commodity,
        harvestDate: harvestDate.toISOString().split('T')[0],
        seedSourceNumber,
        origin,
        iupNumber,
        seedClass,
        producerUUID,
        seedSourceDocName,
        seedSourceIpfsCid
    });
}

const outputPath = path.join(__dirname, '../workload/seed-batch-dataset.json');
fs.writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
console.log(`Generated ${count} items in ${outputPath}`);
