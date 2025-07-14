console.log('Starting VM Visa Backend...');

try {
  require('dotenv').config();
  console.log('Environment loaded successfully');
  console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Present' : 'Missing');
  console.log('JWT Secret:', process.env.JWT_SECRET ? 'Present' : 'Missing');
  console.log('Port:', process.env.PORT);
} catch (error) {
  console.error('Error loading environment:', error);
}

try {
  const express = require('express');
  console.log('Express loaded successfully');
  
  const app = express();
  const PORT = process.env.PORT || 5000;
  
  app.get('/test', (req, res) => {
    res.json({ message: 'Test endpoint working!' });
  });
  
  app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
  });
  
} catch (error) {
  console.error('Error starting server:', error);
}
