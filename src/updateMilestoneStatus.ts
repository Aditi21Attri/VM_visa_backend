import dotenv from 'dotenv';
import { connectDB } from './config/database';
import Case from './models/Case';

// Load environment variables
dotenv.config();

const updateMilestoneStatus = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    
    // Find a case and update its milestone status
    const cases = await Case.find({}).limit(2);
    console.log(`📋 Found ${cases.length} cases`);
    
    for (const caseItem of cases) {
      console.log(`\n📁 Case: ${caseItem._id}`);
      console.log(`📊 Current milestones:`, caseItem.milestones.map((m, i) => ({
        index: i,
        title: m.title,
        status: m.status
      })));
      
      // Update first milestone to in-progress if it's pending
      if (caseItem.milestones.length > 0 && caseItem.milestones[0].status === 'pending') {
        caseItem.milestones[0].status = 'in-progress';
        console.log(`✅ Updated milestone 0 to 'in-progress'`);
      }
      
      // Update second milestone to in-progress if it exists and is pending
      if (caseItem.milestones.length > 1 && caseItem.milestones[1].status === 'pending') {
        caseItem.milestones[1].status = 'in-progress';
        console.log(`✅ Updated milestone 1 to 'in-progress'`);
      }
      
      await caseItem.save();
      console.log(`💾 Saved changes for case ${caseItem._id}`);
    }
    
    console.log('\n🎉 Milestone statuses updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating milestone statuses:', error);
    process.exit(1);
  }
};

updateMilestoneStatus();
