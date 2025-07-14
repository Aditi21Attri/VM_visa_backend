import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from './models/Case';
import User from './models/User';
import VisaRequest from './models/VisaRequest';

dotenv.config();

const createSampleCases = async () => {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ MongoDB Connected');

    // Find existing users and visa requests
    const clients = await User.find({ userType: 'client' }).limit(2);
    const agents = await User.find({ userType: 'agent' }).limit(2);
    const visaRequests = await VisaRequest.find({}).limit(3);

    if (clients.length === 0 || agents.length === 0 || visaRequests.length === 0) {
      console.log('❌ Need at least 2 clients, 2 agents, and 3 visa requests. Please run seed script first.');
      return;
    }

    console.log(`Found ${clients.length} clients, ${agents.length} agents, ${visaRequests.length} visa requests`);

    // Clear existing cases
    console.log('🗑️ Clearing existing cases...');
    await Case.deleteMany({});

    console.log('🎯 Creating sample cases...');

    // Create 3 sample cases
    const casesToCreate = [
      {
        clientIndex: 0,
        agentIndex: 0,
        requestIndex: 0,
        milestones: [
          {
            title: 'Document Collection',
            description: 'Gather all required documents for visa application',
            amount: 500,
            order: 1,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Application Preparation',
            description: 'Prepare and review visa application forms',
            amount: 800,
            order: 2,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            status: 'in-progress',
            isActive: true
          },
          {
            title: 'Interview Preparation',
            description: 'Prepare client for visa interview',
            amount: 600,
            order: 3,
            dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            status: 'pending',
            isActive: false
          },
          {
            title: 'Final Review & Submission',
            description: 'Final review and submit application',
            amount: 400,
            order: 4,
            dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
            status: 'pending',
            isActive: false
          }
        ]
      },
      {
        clientIndex: 1,
        agentIndex: 1,
        requestIndex: 1,
        milestones: [
          {
            title: 'Initial Consultation',
            description: 'Assess client needs and eligibility',
            amount: 300,
            order: 1,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Document Analysis',
            description: 'Review and analyze client documents',
            amount: 700,
            order: 2,
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
            status: 'completed',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Application Filing',
            description: 'File visa application with embassy',
            amount: 1200,
            order: 3,
            dueDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000),
            status: 'pending',
            isActive: true
          }
        ]
      },
      {
        clientIndex: 0,
        agentIndex: 1,
        requestIndex: 2,
        milestones: [
          {
            title: 'Case Assessment',
            description: 'Initial case evaluation and strategy planning',
            amount: 400,
            order: 1,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Documentation Review',
            description: 'Comprehensive document review and preparation',
            amount: 900,
            order: 2,
            dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Application Processing',
            description: 'Process and submit visa application',
            amount: 1100,
            order: 3,
            dueDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000),
            status: 'in-progress',
            isActive: true
          },
          {
            title: 'Follow-up & Monitoring',
            description: 'Monitor application status and follow up',
            amount: 500,
            order: 4,
            dueDate: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000),
            status: 'pending',
            isActive: false
          }
        ]
      }
    ];

    const createdCases = [];

    for (let i = 0; i < casesToCreate.length; i++) {
      const caseData = casesToCreate[i];
      const client = clients[caseData.clientIndex];
      const agent = agents[caseData.agentIndex];
      const request = visaRequests[caseData.requestIndex];

      if (!client || !agent || !request) continue;

      // Calculate total amount and paid amount
      const totalAmount = caseData.milestones.reduce((sum: number, m: any) => sum + m.amount, 0);
      const paidAmount = caseData.milestones
        .filter((m: any) => m.status === 'approved')
        .reduce((sum: number, m: any) => sum + m.amount, 0);

      // Calculate progress
      const completedMilestones = caseData.milestones.filter((m: any) => m.status === 'approved').length;
      const progress = Math.round((completedMilestones / caseData.milestones.length) * 100);

      const newCase = new Case({
        requestId: request._id,
        clientId: client._id,
        agentId: agent._id,
        proposalId: new mongoose.Types.ObjectId(), // Generate a dummy proposal ID
        status: 'active',
        priority: request.priority || 'medium',
        milestones: caseData.milestones,
        currentMilestone: caseData.milestones.findIndex((m: any) => m.isActive),
        totalAmount,
        paidAmount,
        progress,
        startDate: new Date(),
        estimatedCompletionDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        timeline: [
          {
            action: 'case_created',
            description: 'Case has been created and assigned to agent',
            performedBy: agent._id,
            performedAt: new Date(),
            data: {
              caseId: 'placeholder'
            }
          }
        ]
      });

      const savedCase = await newCase.save();
      
      // Update the timeline with the actual case ID
      savedCase.timeline[0].data.caseId = savedCase._id;
      await savedCase.save();

      createdCases.push(savedCase);
      
      console.log(`✅ Created case: ${savedCase._id} for ${request.title}`);
    }

    console.log(`\n🎉 Successfully created ${createdCases.length} sample cases!`);
    console.log('\n📋 Case Details:');
    createdCases.forEach((c, index) => {
      console.log(`Case ${index + 1}: ${c._id}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Progress: ${c.progress}%`);
      console.log(`  Total Amount: $${c.totalAmount}`);
      console.log(`  Paid Amount: $${c.paidAmount}`);
      console.log(`  Milestones: ${c.milestones.length}`);
      console.log('');
    });

    console.log('🔗 Test URLs:');
    createdCases.forEach((c, index) => {
      console.log(`Case ${index + 1}: http://localhost:8080/case/${c._id}`);
    });

  } catch (error) {
    console.error('❌ Error creating sample cases:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 MongoDB disconnected');
  }
};

createSampleCases();
