require('dotenv').config();
const mongoose = require('mongoose');

async function resetVisaStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const result = await mongoose.connection.db.collection('visarequests').updateOne(
      {_id: new mongoose.Types.ObjectId('6873ea8969dd29919812bf41')}, 
      {$set: {status: 'pending'}}
    );
    
    console.log('Update result:', result);
    console.log('Visa request status reset to pending');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetVisaStatus();
