
import mongoose from 'mongoose';
import { paginationPlugin } from './src/utils/plugins/pagination.plugin.js';

const testSchema = new mongoose.Schema({
  name: String,
  priceTrends: [Object]
});
testSchema.plugin(paginationPlugin);

const TestModel = mongoose.model('TestPagination', testSchema);

async function runTest() {
  console.log('--- START TEST ---');
  
  const mockFind = {
    select: (proj) => {
      console.log('Mongoose select() was called with:', JSON.stringify(proj));
      return mockFind;
    },
    populate: () => mockFind,
    sort: () => mockFind,
    skip: () => mockFind,
    limit: () => mockFind,
    lean: () => mockFind,
    exec: () => Promise.resolve([])
  };

  TestModel.find = () => mockFind;
  TestModel.countDocuments = () => Promise.resolve(0);

  console.log('Executing paginate with projection { priceTrends: 0 }...');
  await TestModel.paginate({}, { projection: { priceTrends: 0 } });
  
  console.log('--- END TEST ---');
}

runTest().catch(console.error);
