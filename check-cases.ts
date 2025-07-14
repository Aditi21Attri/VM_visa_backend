import mongoose from 'mongoose';
import Case from './src/models/Case';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkCases() {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');
    
    const cases = await Case.find({});
    console.log('Total cases found:', cases.length);
    
    cases.forEach((caseItem: any, index) => {
      console.log(`${index + 1}. Case ID: ${caseItem._id}`);
      console.log(`   Client ID: ${caseItem.clientId}`);
      console.log(`   Agent ID: ${caseItem.agentId}`);
      console.log(`   Title: ${caseItem.title}`);
      console.log(`   Status: ${caseItem.status}`);
      console.log('---');
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCases();
