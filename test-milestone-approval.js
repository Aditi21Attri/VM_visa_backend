// Simple test script to verify milestone approval fix
const API_BASE = 'http://localhost:5000/api';

async function testMilestoneApproval() {
  console.log('Testing milestone approval fix...');
  
  try {
    // Test data - replace with actual case and milestone IDs from your database
    const caseId = '6774d47c1fb6e8a72b123456'; // Replace with actual case ID
    const milestoneIndex = 0; // First milestone
    
    const response = await fetch(`${API_BASE}/cases/${caseId}/milestones/${milestoneIndex}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        // Add your authorization header here
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      },
      body: JSON.stringify({
        // Add any required approval data
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Milestone approval successful:', result);
    } else {
      console.log('❌ Milestone approval failed:', response.status, result);
    }
    
  } catch (error) {
    console.error('❌ Error testing milestone approval:', error.message);
  }
}

async function testProposalAcceptance() {
  console.log('Testing proposal acceptance fix...');
  
  try {
    // Test data - replace with actual proposal ID from your database
    const proposalId = '6774d47c1fb6e8a72b789012'; // Replace with actual proposal ID
    
    const response = await fetch(`${API_BASE}/proposals/${proposalId}/accept`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your authorization header here
        'Authorization': 'Bearer YOUR_TOKEN_HERE'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Proposal acceptance successful:', result);
      console.log('✅ Navigation data:', result.data?.navigation);
    } else {
      console.log('❌ Proposal acceptance failed:', response.status, result);
    }
    
  } catch (error) {
    console.error('❌ Error testing proposal acceptance:', error.message);
  }
}

// Run tests
console.log('🧪 Running API tests...\n');
testMilestoneApproval();
testProposalAcceptance();

console.log('\n📝 Instructions:');
console.log('1. Replace the case ID and proposal ID with actual IDs from your database');
console.log('2. Add proper authorization headers');
console.log('3. Run: node test-milestone-approval.js');
