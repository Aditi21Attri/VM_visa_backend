import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Case from './models/Case';
import Proposal from './models/Proposal';
import VisaRequest from './models/VisaRequest';
import User from './models/User';

dotenv.config();

const createSampleCases = async () => {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ MongoDB Connected');

    // Find some existing proposals and users
    const proposals = await Proposal.find({}).populate(['requestId', 'clientId', 'agentId']);
    const clients = await User.find({ userType: 'client' });
    const agents = await User.find({ userType: 'agent' });

    if (proposals.length === 0 || clients.length === 0 || agents.length === 0) {
      console.log('❌ No proposals, clients, or agents found. Please run seed script first.');
      return;
    }

    console.log('🎯 Creating sample cases...');

    // Create 3 sample cases
    const casesToCreate = [
      {
        proposalIndex: 0,
        milestones: [
          {
            title: 'Document Collection',
            description: 'Gather all required documents for visa application',
            amount: 500,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Application Preparation',
            description: 'Prepare and review visa application forms',
            amount: 800,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
            status: 'in-progress',
            isActive: true
          },
          {
            title: 'Interview Preparation',
            description: 'Prepare client for visa interview',
            amount: 600,
            dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
            status: 'pending',
            isActive: false
          },
          {
            title: 'Final Review & Submission',
            description: 'Final review and submit application',
            amount: 400,
            dueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now
            status: 'pending',
            isActive: false
          }
        ]
      },
      {
        proposalIndex: 1,
        milestones: [
          {
            title: 'Initial Consultation',
            description: 'Assess client needs and eligibility',
            amount: 300,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Document Analysis',
            description: 'Review and analyze client documents',
            amount: 700,
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
            status: 'completed',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Application Filing',
            description: 'File visa application with embassy',
            amount: 1200,
            dueDate: new Date(Date.now() + 17 * 24 * 60 * 60 * 1000), // 17 days from now
            status: 'pending',
            isActive: true
          }
        ]
      },
      {
        proposalIndex: 2,
        milestones: [
          {
            title: 'Case Assessment',
            description: 'Initial case evaluation and strategy planning',
            amount: 400,
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Documentation Review',
            description: 'Comprehensive document review and preparation',
            amount: 900,
            dueDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
            status: 'approved',
            completedAt: new Date(),
            isActive: false
          },
          {
            title: 'Application Processing',
            description: 'Process and submit visa application',
            amount: 1100,
            dueDate: new Date(Date.now() + 19 * 24 * 60 * 60 * 1000), // 19 days from now
            status: 'in-progress',
            isActive: true
          },
          {
            title: 'Follow-up & Monitoring',
            description: 'Monitor application status and follow up',
            amount: 500,
            dueDate: new Date(Date.now() + 26 * 24 * 60 * 60 * 1000), // 26 days from now
            status: 'pending',
            isActive: false
          }
        ]
      }
    ];

    const createdCases = [];

    for (let i = 0; i < Math.min(casesToCreate.length, proposals.length); i++) {
      const caseData = casesToCreate[i];
      const proposal = proposals[caseData.proposalIndex];

      if (!proposal) continue;

      // Calculate total amount and paid amount
      const totalAmount = caseData.milestones.reduce((sum, m) => sum + m.amount, 0);
      const paidAmount = caseData.milestones
        .filter(m => m.status === 'approved')
        .reduce((sum, m) => sum + m.amount, 0);

      // Calculate progress
      const completedMilestones = caseData.milestones.filter(m => m.status === 'approved').length;
      const progress = Math.round((completedMilestones / caseData.milestones.length) * 100);

      const newCase = new Case({
        requestId: (proposal.requestId as any)._id,
        clientId: (proposal as any).clientId._id,
        agentId: (proposal.agentId as any)._id,
        proposalId: proposal._id,
        status: 'active',
        priority: (proposal.requestId as any).priority || 'medium',
        milestones: caseData.milestones,
        currentMilestone: caseData.milestones.findIndex(m => m.isActive),
        totalAmount,
        paidAmount,
        progress,
        startDate: new Date(),
        estimatedCompletionDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        timeline: [
          {
            action: 'case_created',
            description: 'Case has been created and assigned to agent',
            performedBy: (proposal.agentId as any)._id,
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
      
      console.log(`✅ Created case: ${savedCase._id} for ${(proposal.requestId as any).title}`);
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
