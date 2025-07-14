#!/usr/bin/env node

/**
 * Server Restart Script
 * This script helps restart the backend server cleanly
 */

const { exec } = require('child_process');
const http = require('http');

console.log('🔄 Server Restart Script');
console.log('========================');

// Step 1: Kill existing Node processes
console.log('1. Stopping existing Node.js processes...');
exec('taskkill /F /IM node.exe 2>nul', (error, stdout, stderr) => {
  if (error && !error.message.includes('not found')) {
    console.log('⚠️ Error stopping processes:', error.message);
  } else {
    console.log('✅ Existing processes stopped');
  }
  
  // Step 2: Wait a moment for cleanup
  setTimeout(() => {
    console.log('2. Waiting for cleanup...');
    
    // Step 3: Check if port 5000 is free
    setTimeout(() => {
      console.log('3. Checking port availability...');
      checkPort(5000, (isAvailable) => {
        if (isAvailable) {
          console.log('✅ Port 5000 is available');
          startServer();
        } else {
          console.log('⚠️ Port 5000 is still in use, waiting...');
          setTimeout(() => startServer(), 2000);
        }
      });
    }, 1000);
  }, 1000);
});

function checkPort(port, callback) {
  const server = require('net').createServer();
  
  server.listen(port, (err) => {
    if (err) {
      callback(false);
    } else {
      server.once('close', () => callback(true));
      server.close();
    }
  });
  
  server.on('error', () => callback(false));
}

function startServer() {
  console.log('4. Starting server...');
  
  const serverProcess = exec('npm run dev', {
    cwd: __dirname
  });
  
  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    
    // Check if server started successfully
    if (data.includes('Server running on port')) {
      console.log('\n✅ Server started successfully!');
      console.log('🌐 Available at: http://localhost:5000');
      console.log('📊 Health check: http://localhost:5000/api/health');
    }
  });
  
  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });
  
  serverProcess.on('close', (code) => {
    console.log(`\n🛑 Server process exited with code ${code}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
}
