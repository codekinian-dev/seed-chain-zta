const shim = require('fabric-shim');
const { SeedBatchContract } = require('../lib/seedBatchContract');
const { SeedBatchContractZTA } = require('../lib/seedBatchContractZTA');

const server = shim.server(new SeedBatchContractZTA(), {
    ccid: process.env.CHAINCODE_ID || 'seedbatch:1.0',
    address: process.env.CHAINCODE_ADDRESS || '0.0.0.0:9999'
});

server.start();

console.log(`Chaincode server started at ${process.env.CHAINCODE_ADDRESS || '0.0.0.0:9999'}`);
