import dotenv from 'dotenv';
import { connectDB } from './config/database';
import Case from './models/Case';
import User from './models/User';

// Load environment variables
dotenv.config();

const createTestCase = async () => {
  try {
    console.log('🔄 Connecting to database...');
    await connectDB();
    
    // Find a client and agent
    const client = await User.findOne({ userType: 'client' });
    const agent = await User.findOne({ userType: 'agent' });
    
    if (!client || !agent) {
      console.error('❌ Could not find client or agent');
      return;
    }
    
    console.log(`👤 Client: ${client.name} (${client._id})`);
    console.log(`👨‍💼 Agent: ${agent.name} (${agent._id})`);
    
    // Create a new case with milestones
    const testCase = new Case({
      clientId: client._id,
      agentId: agent._id,
      title: 'Test Case for Milestone Approval',
      description: 'This is a test case to verify milestone approval functionality',
      visaType: 'Student Visa',
      priority: 'medium',
      status: 'active',
      totalAmount: 1000,
      currency: 'USD',
      milestones: [
        {
          title: 'Initial Consultation & Assessment',
          description: 'Initial consultation and document assessment',
          amount: 250,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
          status: 'approved', // Already approved
          isActive: false,
          approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          agentNotes: 'Initial consultation completed successfully',
          submittedFiles: []
        },
        {
          title: 'Document Collection & Review',
          description: 'Collect and review all required documents',
          amount: 250,
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
          status: 'in-progress', // Ready for approval
          isActive: true,
          agentNotes: 'Documents are being collected and reviewed',
          submittedFiles: ['passport_copy.pdf', 'transcripts.pdf']
        },
        {
          title: 'Application Processing & Submission',
          description: 'Process and submit visa application',
          amount: 350,
          dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
          status: 'completed', // Ready for approval
          isActive: false,
          agentNotes: 'Application has been processed and submitted successfully',
          submittedFiles: ['application_form.pdf', 'supporting_docs.pdf']
        },
        {
          title: 'Final Review & Approval',
          description: 'Final review and approval process',
          amount: 150,
          dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
          status: 'pending',
          isActive: false,
          agentNotes: '',
          submittedFiles: []
        }
      ],
      timeline: [
        {
          action: 'case_created',
          description: 'Case created for milestone approval testing',
          performedBy: agent._id,
          performedAt: new Date(),
          data: {}
        }
      ],
      currentMilestone: 2 // Second milestone is active
    });
    
    const savedCase = await testCase.save();
    console.log(`✅ Created test case: ${savedCase._id}`);
    console.log('📊 Milestones:');
    savedCase.milestones.forEach((milestone, index) => {
      console.log(`  ${index}: ${milestone.title} - Status: ${milestone.status}`);
    });
    
    console.log('\n🎯 Testing Instructions:');
    console.log(`1. Login as client: ${client.email} / password123`);
    console.log(`2. Navigate to case: ${savedCase._id}`);
    console.log(`3. Try to approve milestone 1 (in-progress) and milestone 2 (completed)`);
    console.log(`4. These should work without 403 errors`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test case:', error);
    process.exit(1);
  }
};

createTestCase();
