const mongoose = require('mongoose');

async function debugCases() {
  try {
    await mongoose.connect('mongodb+srv://aditiattri21:5ciutIwW6t9bYU9W@vmvisa.jqsr031.mongodb.net/');
    console.log('Connected to MongoDB');
    
    // Get the cases collection directly
    const db = mongoose.connection.db;
    const casesCollection = db.collection('cases');
    
    console.log('\n=== CASES DEBUG ===');
    const cases = await casesCollection.find({}).toArray();
    console.log('Total cases found:', cases.length);
    
    cases.forEach((c, index) => {
      console.log(`\nCase ${index + 1}:`);
      console.log('  ID:', c._id.toString());
      console.log('  Client ID:', c.clientId);
      console.log('  Agent ID:', c.agentId);
      console.log('  Status:', c.status);
      console.log('  Progress:', c.progress);
      console.log('  Total Amount:', c.totalAmount);
      console.log('  Milestones:', c.milestones ? c.milestones.length : 0);
    });
    
    // Also check if we can find cases with the known user IDs
    console.log('\n=== CASES BY USER ===');
    const johnSmithCases = await casesCollection.find({ clientId: '6874ba88a16b1a129e10906c' }).toArray();
    console.log('John Smith cases:', johnSmithCases.length);
    
    const emilyRodriguezCases = await casesCollection.find({ agentId: '6874ba88a16b1a129e10906f' }).toArray();
    console.log('Emily Rodriguez cases:', emilyRodriguezCases.length);
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugCases();
