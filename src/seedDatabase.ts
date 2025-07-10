import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/database';

// Load environment variables
dotenv.config();

// Import all models
import User from './models/User';
import VisaRequest from './models/VisaRequest';
import Proposal from './models/Proposal';
import { Message } from './models/Message';
import Notification from './models/Notification';
import Review from './models/Review';
import Document from './models/Document';
import EscrowTransaction from './models/Escrow';

// Helper function to hash passwords
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

// Sample data generation
const generateSampleData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await VisaRequest.deleteMany({});
    await Proposal.deleteMany({});
    await Message.deleteMany({});
    await Notification.deleteMany({});
    await Review.deleteMany({});
    await Document.deleteMany({});
    await EscrowTransaction.deleteMany({});

    // Create Users
    console.log('👥 Creating users...');
    // Don't hash password manually - let the User model pre-save hook handle it
    const plainPassword = 'password123';
    
    const users = await User.create([
      // Clients
      {
        name: 'John Smith',
        email: 'john.smith@email.com',
        password: plainPassword,
        userType: 'client',
        bio: 'Software engineer looking to immigrate to Canada',
        location: 'New York, USA',
        phone: '+1-555-0101',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        password: plainPassword,
        userType: 'client',
        bio: 'Medical professional seeking work visa in Australia',
        location: 'London, UK',
        phone: '+44-20-7946-0958',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Michael Chen',
        email: 'michael.chen@email.com',
        password: plainPassword,
        userType: 'client',
        bio: 'Graduate student applying for permanent residence',
        location: 'Toronto, Canada',
        phone: '+1-416-555-0123',
        isVerified: true,
        isActive: true
      },
      
      // Agents
      {
        name: 'Emily Rodriguez',
        email: 'emily.rodriguez@vmvisa.com',
        password: plainPassword,
        userType: 'agent',
        bio: 'Certified immigration consultant with 8+ years experience. Specializing in work permits and permanent residence applications.',
        location: 'Vancouver, Canada',
        phone: '+1-604-555-0201',
        isVerified: true,
        isActive: true
      },
      {
        name: 'David Thompson',
        email: 'david.thompson@vmvisa.com',
        password: plainPassword,
        userType: 'agent',
        bio: 'Immigration lawyer specializing in business immigration and investor visas. Licensed in Canada and Australia.',
        location: 'Sydney, Australia',
        phone: '+61-2-9555-0301',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Priya Patel',
        email: 'priya.patel@vmvisa.com',
        password: plainPassword,
        userType: 'agent',
        bio: 'Family immigration specialist with expertise in spousal sponsorship and student visas.',
        location: 'Mumbai, India',
        phone: '+91-22-2555-0401',
        isVerified: true,
        isActive: true
      },
      
      // Organizations
      {
        name: 'Global Immigration Services',
        email: 'contact@globalimmigration.com',
        password: plainPassword,
        userType: 'organization',
        bio: 'Leading immigration consulting firm with offices in 15 countries. Serving clients worldwide since 2010.',
        location: 'Toronto, Canada',
        phone: '+1-416-555-0501',
        isVerified: true,
        isActive: true
      },
      {
        name: 'Asia Pacific Immigration',
        email: 'info@apimmigration.com',
        password: plainPassword,
        userType: 'organization',
        bio: 'Specialized immigration services for Asia-Pacific region with focus on skilled worker programs.',
        location: 'Singapore',
        phone: '+65-6555-0601',
        isVerified: true,
        isActive: true
      },
      
      // Admin
      {
        name: 'VM Visa Admin',
        email: 'admin@vmvisa.com',
        password: plainPassword,
        userType: 'admin',
        bio: 'System administrator',
        location: 'Global',
        phone: '+1-555-000-0001',
        isVerified: true,
        isActive: true
      }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // Get user IDs for referencing
    const clients = users.filter(u => u.userType === 'client');
    const agents = users.filter(u => u.userType === 'agent');
    const organizations = users.filter(u => u.userType === 'organization');

    // Create Visa Requests
    console.log('📋 Creating visa requests...');
    const visaRequests = await VisaRequest.create([
      {
        userId: clients[0]._id,
        title: 'Express Entry - Software Developer',
        visaType: 'permanent-residence',
        country: 'Canada',
        description: 'I am a software engineer with 5 years of experience looking to apply for Canadian permanent residence through Express Entry. I have a computer science degree and work experience in fintech.',
        budget: '2500-5000',
        timeline: '3-6-months',
        priority: 'high',
        status: 'pending',
        requirements: [
          'Language test results (IELTS/CELPIP)',
          'Educational credential assessment',
          'Work experience letters',
          'Police clearance certificates',
          'Medical examination'
        ]
      },
      {
        userId: clients[1]._id,
        title: 'Skilled Independent Visa - Doctor',
        visaType: 'work-permit',
        country: 'Australia',
        description: 'Medical doctor seeking skilled migration to Australia. I have MBBS degree and 3 years of clinical experience in emergency medicine.',
        budget: '5000-10000',
        timeline: '2-3-months',
        priority: 'urgent',
        status: 'in-progress',
        assignedAgentId: agents[1]._id,
        requirements: [
          'Medical degree verification',
          'English proficiency test',
          'Skills assessment by relevant authority',
          'Health and character checks'
        ]
      },
      {
        userId: clients[2]._id,
        title: 'Study Permit Extension',
        visaType: 'student-visa',
        country: 'Canada',
        description: 'Currently studying Masters in Engineering at University of Toronto. Need to extend study permit for thesis completion.',
        budget: '500-1000',
        timeline: '1-month',
        priority: 'medium',
        status: 'pending',
        requirements: [
          'Current study permit',
          'Letter from university',
          'Financial support documents',
          'Academic transcripts'
        ]
      },
      {
        userId: clients[0]._id,
        title: 'Visitor Visa for Parents',
        visaType: 'visitor-visa',
        country: 'Canada',
        description: 'Applying for visitor visa for my parents to attend my graduation ceremony. They are retired and want to stay for 3 months.',
        budget: '1000-2500',
        timeline: '2-weeks',
        priority: 'high',
        status: 'pending',
        requirements: [
          'Invitation letter',
          'Financial support proof',
          'Travel itinerary',
          "Parent's bank statements",
          'Employment letter'
        ]
      },
      {
        userId: clients[1]._id,
        title: 'Business Investment Visa',
        visaType: 'business-visa',
        country: 'Australia',
        description: 'Looking to establish a medical practice in Australia under business investment category. Have sufficient capital and business plan.',
        budget: 'above-10000',
        timeline: '3-6-months',
        priority: 'medium',
        status: 'completed',
        assignedAgentId: agents[1]._id,
        requirements: [
          'Business plan',
          'Financial statements',
          'Investment proof',
          'Professional qualifications',
          'Character assessment'
        ]
      }
    ]);

    console.log(`✅ Created ${visaRequests.length} visa requests`);

    // Create Proposals
    console.log('💼 Creating proposals...');
    const proposals = await Proposal.create([
      {
        requestId: visaRequests[0]._id,
        agentId: agents[0]._id,
        budget: 3500,
        timeline: '3-6-months',
        coverLetter: 'I have successfully helped over 200 clients with Express Entry applications. My expertise in software developer applications will ensure your success.',
        proposalText: 'I will handle your complete Express Entry application including document preparation, profile optimization, and application submission. My services include comprehensive review of your work experience, education credentials, and language test results.',
        status: 'pending',
        milestones: [
          {
            title: 'Document Review & Profile Creation',
            description: 'Review all documents and create Express Entry profile',
            amount: 1000,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            deliverables: ['Express Entry profile', 'Document checklist', 'Initial assessment']
          },
          {
            title: 'Application Preparation',
            description: 'Prepare and submit complete application',
            amount: 1500,
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            deliverables: ['Complete application package', 'Supporting documents', 'Submission confirmation']
          },
          {
            title: 'Follow-up & Support',
            description: 'Monitor application status and provide updates',
            amount: 1000,
            dueDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
            deliverables: ['Status updates', 'Additional document requests handling', 'Interview preparation if needed']
          }
        ]
      },
      {
        requestId: visaRequests[0]._id,
        agentId: agents[2]._id,
        budget: 2800,
        timeline: '3-6-months',
        coverLetter: 'As a family immigration specialist, I understand the importance of reuniting families. I offer personalized service with regular updates.',
        proposalText: 'My approach focuses on thorough document preparation and proactive communication. I will ensure your Express Entry application is optimized for maximum points.',
        status: 'pending',
        milestones: [
          {
            title: 'Initial Consultation & Assessment',
            description: 'Comprehensive eligibility assessment and strategy planning',
            amount: 800,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            deliverables: ['Eligibility report', 'Strategy document', 'Timeline plan']
          },
          {
            title: 'Application Submission',
            description: 'Complete application preparation and submission',
            amount: 2000,
            dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            deliverables: ['Submitted application', 'Receipt confirmation', 'Document portfolio']
          }
        ]
      },
      {
        requestId: visaRequests[1]._id,
        agentId: agents[1]._id,
        budget: 7500,
        timeline: '2-3-months',
        coverLetter: 'I specialize in medical professional immigration to Australia. I am familiar with the skills assessment process and requirements.',
        proposalText: 'My comprehensive service includes skills assessment guidance, application preparation, and ongoing support throughout the process.',
        status: 'accepted',
        milestones: [
          {
            title: 'Skills Assessment Preparation',
            description: 'Prepare and submit skills assessment application',
            amount: 2500,
            dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            deliverables: ['Skills assessment application', 'Supporting documents', 'Submission receipt']
          },
          {
            title: 'Main Application',
            description: 'Prepare and submit main visa application',
            amount: 3500,
            dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            deliverables: ['Complete visa application', 'Health examinations scheduled', 'Character documents']
          },
          {
            title: 'Case Management',
            description: 'Monitor application and provide updates',
            amount: 1500,
            dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            deliverables: ['Regular status updates', 'Additional requirements handling', 'Final outcome notification']
          }
        ]
      },
      {
        requestId: visaRequests[3]._id,
        agentId: agents[0]._id,
        budget: 1500,
        timeline: '2-weeks',
        coverLetter: "I have extensive experience with visitor visa applications. I will ensure your parents' application is complete and compelling.",
        proposalText: "Quick and efficient processing of visitor visa applications with high success rate. I will prepare a strong case for your parents' visit.",
        status: 'pending',
        milestones: [
          {
            title: 'Application Preparation',
            description: 'Prepare complete visitor visa application package',
            amount: 1500,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            deliverables: ['Completed applications', 'Supporting documents', 'Invitation letter', 'Submission']
          }
        ]
      }
    ]);

    console.log(`✅ Created ${proposals.length} proposals`);

    // Create Messages
    console.log('💬 Creating messages...');
    const messages = await Message.create([
      {
        senderId: clients[0]._id,
        receiverId: agents[0]._id,
        content: 'Hi Emily, I saw your proposal for my Express Entry application. I have a few questions about the timeline.',
        messageType: 'text',
        isRead: true,
        conversationId: `${clients[0]._id}_${agents[0]._id}`,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        senderId: agents[0]._id,
        receiverId: clients[0]._id,
        content: "Hello John! I'd be happy to answer your questions. The 4-5 month timeline includes all processing steps. What specific aspects would you like to discuss?",
        messageType: 'text',
        isRead: true,
        conversationId: `${clients[0]._id}_${agents[0]._id}`,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000)
      },
      {
        senderId: clients[0]._id,
        receiverId: agents[0]._id,
        content: "I'm particularly concerned about the language test requirements. Do you help with IELTS preparation?",
        messageType: 'text',
        isRead: false,
        conversationId: `${clients[0]._id}_${agents[0]._id}`,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        senderId: agents[1]._id,
        receiverId: clients[1]._id,
        content: "Great news! Your skills assessment has been approved. We can now proceed with the main visa application. I've prepared the next set of documents for your review.",
        messageType: 'text',
        isRead: true,
        conversationId: `${clients[1]._id}_${agents[1]._id}`,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        senderId: clients[1]._id,
        receiverId: agents[1]._id,
        content: "That's wonderful news! Thank you for your excellent work. When do you expect we can submit the main application?",
        messageType: 'text',
        isRead: true,
        conversationId: `${clients[1]._id}_${agents[1]._id}`,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000)
      }
    ]);

    console.log(`✅ Created ${messages.length} messages`);

    // Create Notifications
    console.log('🔔 Creating notifications...');
    const notifications = await Notification.create([
      {
        recipient: clients[0]._id,
        title: 'New Proposal Received',
        message: 'Emily Rodriguez has submitted a proposal for your Express Entry application',
        type: 'proposal',
        isRead: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        recipient: clients[0]._id,
        title: 'New Message',
        message: 'You have a new message from Emily Rodriguez',
        type: 'message',
        isRead: true,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        recipient: clients[1]._id,
        title: 'Application Update',
        message: 'Your skills assessment has been approved!',
        type: 'system',
        isRead: false,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        recipient: agents[0]._id,
        title: 'New Client Message',
        message: 'John Smith sent you a message about Express Entry timeline',
        type: 'message',
        isRead: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        recipient: agents[1]._id,
        title: 'Milestone Completed',
        message: 'Skills assessment milestone completed for Sarah Johnson',
        type: 'status_update',
        isRead: true,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ]);

    console.log(`✅ Created ${notifications.length} notifications`);

    // Create Reviews
    console.log('⭐ Creating reviews...');
    const reviews = await Review.create([
      {
        reviewer: clients[1]._id,
        reviewee: agents[1]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[4]._id
        },
        rating: 5,
        title: 'Outstanding Business Visa Service',
        comment: 'David provided exceptional service throughout my business visa application. His expertise in Australian immigration law was evident, and he guided me through every step with professionalism and care. Highly recommended!',
        aspects: {
          communication: 5,
          expertise: 5,
          timeliness: 5,
          professionalism: 5,
          value: 5
        },
        isPublic: true,
        isVerified: true,
        helpfulVotes: 8,
        tags: ['business-visa', 'australia', 'professional'],
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        reviewer: clients[1]._id,
        reviewee: agents[1]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[1]._id
        },
        rating: 5,
        title: 'Excellent Skilled Visa Guidance',
        comment: 'Outstanding service! David made the complex Australian visa process much easier to understand. Regular updates and prompt responses to all my questions.',
        aspects: {
          communication: 5,
          expertise: 5,
          timeliness: 4,
          professionalism: 5,
          value: 5
        },
        isPublic: true,
        isVerified: true,
        helpfulVotes: 12,
        tags: ['skilled-visa', 'australia', 'responsive'],
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        reviewer: clients[0]._id,
        reviewee: agents[0]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[0]._id
        },
        rating: 4,
        title: 'Good Express Entry Service',
        comment: 'Emily was very knowledgeable about Express Entry process. Good communication and thorough document review. Would work with her again.',
        aspects: {
          communication: 4,
          expertise: 5,
          timeliness: 4,
          professionalism: 4,
          value: 4
        },
        isPublic: true,
        isVerified: false,
        helpfulVotes: 3,
        tags: ['express-entry', 'canada'],
        createdAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000)
      }
    ]);

    console.log(`✅ Created ${reviews.length} reviews`);

    // Create Documents
    console.log('📄 Creating documents...');
    const documents = await Document.create([
      {
        filename: 'passport_john_smith.pdf',
        originalName: 'My Passport Copy.pdf',
        mimetype: 'application/pdf',
        size: 2048576,
        path: '/uploads/documents/passport_john_smith.pdf',
        uploadedBy: clients[0]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[0]._id
        },
        category: 'passport',
        status: 'verified',
        verifiedBy: agents[0]._id,
        verificationDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        isPublic: false,
        tags: ['passport', 'identity'],
        metadata: {
          pages: 2,
          country: 'USA',
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 5)
        }
      },
      {
        filename: 'degree_certificate.pdf',
        originalName: 'Computer Science Degree.pdf',
        mimetype: 'application/pdf',
        size: 1536789,
        path: '/uploads/documents/degree_certificate.pdf',
        uploadedBy: clients[0]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[0]._id
        },
        category: 'educational',
        status: 'verified',
        verifiedBy: agents[0]._id,
        verificationDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        isPublic: false,
        tags: ['education', 'degree', 'computer-science'],
        metadata: {
          pages: 1,
          language: 'English',
          country: 'USA'
        }
      },
      {
        filename: 'medical_certificate.pdf',
        originalName: 'Medical Degree - MBBS.pdf',
        mimetype: 'application/pdf',
        size: 2891034,
        path: '/uploads/documents/medical_certificate.pdf',
        uploadedBy: clients[1]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[1]._id
        },
        category: 'educational',
        status: 'pending',
        isPublic: false,
        tags: ['medical', 'degree', 'mbbs'],
        metadata: {
          pages: 3,
          language: 'English',
          country: 'UK'
        }
      },
      {
        filename: 'ielts_result.pdf',
        originalName: 'IELTS Academic Test Report.pdf',
        mimetype: 'application/pdf',
        size: 412567,
        path: '/uploads/documents/ielts_result.pdf',
        uploadedBy: clients[0]._id,
        relatedTo: {
          type: 'visa_request',
          id: visaRequests[0]._id
        },
        category: 'other',
        status: 'verified',
        verifiedBy: agents[0]._id,
        verificationDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        isPublic: false,
        tags: ['language', 'ielts', 'english'],
        metadata: {
          pages: 1,
          language: 'English',
          expiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
        }
      }
    ]);

    console.log(`✅ Created ${documents.length} documents`);

    // Create Escrow Transactions (commenting out for now due to complex schema)
    // console.log('💰 Creating escrow transactions...');
    // TODO: Fix escrow transaction creation
    console.log('💰 Skipping escrow transactions for now...');

    console.log('✅ Database seeding completed successfully!');
    /*
    const escrowTransactions = await EscrowTransaction.create([
      // Escrow transaction data commented out for now
      // TODO: Fix field names and enum values to match Escrow model schema
    ]);
    */

    // console.log(`✅ Created ${escrowTransactions.length} escrow transactions`);

    // Update proposal counts in visa requests
    console.log('🔄 Updating proposal counts...');
    await VisaRequest.findByIdAndUpdate(visaRequests[0]._id, { proposalCount: 2 });
    await VisaRequest.findByIdAndUpdate(visaRequests[1]._id, { proposalCount: 1 });
    await VisaRequest.findByIdAndUpdate(visaRequests[3]._id, { proposalCount: 1 });

    // Update escrow IDs in visa requests (commented out since escrow is disabled)
    // await VisaRequest.findByIdAndUpdate(visaRequests[1]._id, { escrowId: escrowTransactions[0]._id });
    // await VisaRequest.findByIdAndUpdate(visaRequests[4]._id, { escrowId: escrowTransactions[1]._id });

    console.log('🎉 Database seeding completed successfully!');
    
    // Print summary
    console.log('\n📊 SUMMARY:');
    console.log(`👥 Users: ${users.length} (${clients.length} clients, ${agents.length} agents, ${organizations.length} organizations, 1 admin)`);
    console.log(`📋 Visa Requests: ${visaRequests.length}`);
    console.log(`💼 Proposals: ${proposals.length}`);
    console.log(`💬 Messages: ${messages.length}`);
    console.log(`🔔 Notifications: ${notifications.length}`);
    console.log(`⭐ Reviews: ${reviews.length}`);
    console.log(`📄 Documents: ${documents.length}`);
    console.log(`💰 Escrow Transactions: 0 (skipped)`);;
    
    console.log('\n🔑 TEST CREDENTIALS:');
    console.log('Client: john.smith@email.com / password123');
    console.log('Agent: emily.rodriguez@vmvisa.com / password123');
    console.log('Organization: contact@globalimmigration.com / password123');
    console.log('Admin: admin@vmvisa.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
};

// Main execution
const seedDatabase = async () => {
  try {
    await connectDB();
    await generateSampleData();
    console.log('✅ Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

export { generateSampleData };
