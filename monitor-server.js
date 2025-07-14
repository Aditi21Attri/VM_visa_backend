#!/usr/bin/env node

/**
 * Server Health Monitor
 * This script helps monitor the backend server for issues
 */

const http = require('http');
const { exec } = require('child_process');

const SERVER_URL = 'http://localhost:5000';
const CHECK_INTERVAL = 30000; // 30 seconds
const MAX_RETRIES = 3;

let retryCount = 0;
let isMonitoring = true;

console.log('🔍 Starting server health monitor...');
console.log(`📍 Monitoring: ${SERVER_URL}`);
console.log(`⏱️  Check interval: ${CHECK_INTERVAL / 1000} seconds`);
console.log('');

function checkServerHealth() {
  if (!isMonitoring) return;

  const req = http.get(`${SERVER_URL}/api/health`, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        console.log(`✅ [${new Date().toISOString()}] Server healthy - Uptime: ${Math.floor(health.uptime)}s`);
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        console.log(`⚠️ [${new Date().toISOString()}] Invalid health response: ${data}`);
      }
    });
  });

  req.on('error', (error) => {
    retryCount++;
    console.log(`❌ [${new Date().toISOString()}] Server health check failed (${retryCount}/${MAX_RETRIES}): ${error.message}`);
    
    if (retryCount >= MAX_RETRIES) {
      console.log('🚨 Server appears to be down. Checking processes...');
      checkNodeProcesses();
      retryCount = 0; // Reset after check
    }
  });

  req.setTimeout(5000, () => {
    req.destroy();
    console.log(`⏰ [${new Date().toISOString()}] Health check timeout`);
  });
}

function checkNodeProcesses() {
  exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', (error, stdout, stderr) => {
    if (error) {
      console.log('Error checking processes:', error.message);
      return;
    }
    
    const lines = stdout.split('\n').filter(line => line.includes('node.exe'));
    console.log(`📊 Found ${lines.length - 1} Node.js processes running`);
    
    if (lines.length <= 1) {
      console.log('⚠️ No Node.js processes found. Server may have crashed.');
    }
  });
}

function startMonitoring() {
  checkServerHealth(); // Initial check
  const interval = setInterval(checkServerHealth, CHECK_INTERVAL);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping health monitor...');
    isMonitoring = false;
    clearInterval(interval);
    process.exit(0);
  });
}

// Start monitoring
startMonitoring();
