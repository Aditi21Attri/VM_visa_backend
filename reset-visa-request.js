const mongoose = require('mongoose');

async function resetVisaRequestStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb+srv://aditi_attri:z8iHfhkZl0mlT5Pw@cluster0.jqsr031.mongodb.net/vm_visa_db');
    console.log('Connected to MongoDB');
    
    // Update directly using collection
    const result = await mongoose.connection.collection('visarequests').updateOne(
      { _id: new mongoose.Types.ObjectId('6873ea8969dd29919812bf41') },
      { $set: { status: 'pending' } }
    );
    console.log('Reset result:', result);
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetVisaRequestStatus();
