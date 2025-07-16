#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 VM Visa Backend - Build Verification\n');

// Check if package.json exists
if (!fs.existsSync('package.json')) {
  console.error('❌ package.json not found. Run this script from the backend directory.');
  process.exit(1);
}

console.log('✅ package.json found');

// Check if node_modules exists
if (!fs.existsSync('node_modules')) {
  console.log('📦 Installing dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed');
  } catch (error) {
    console.error('❌ Failed to install dependencies');
    process.exit(1);
  }
} else {
  console.log('✅ node_modules found');
}

// Check TypeScript compilation
console.log('🔨 Building TypeScript...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful');
} catch (error) {
  console.error('❌ TypeScript compilation failed');
  process.exit(1);
}

// Check if dist folder was created
if (!fs.existsSync('dist')) {
  console.error('❌ dist folder not created after build');
  process.exit(1);
}

// Check if main entry point exists
const distIndexPath = path.join('dist', 'index.js');
if (!fs.existsSync(distIndexPath)) {
  console.error('❌ dist/index.js not found');
  process.exit(1);
}

console.log('✅ dist/index.js found');

// Count compiled files
const distFiles = fs.readdirSync('dist', { recursive: true })
  .filter(file => file.endsWith('.js')).length;

console.log(`✅ ${distFiles} JavaScript files compiled`);

// Check environment variables template
if (fs.existsSync('.env.example')) {
  console.log('✅ .env.example found');
} else {
  console.log('⚠️  .env.example not found - consider creating one for deployment');
}

// Final verification - try to load the compiled file
console.log('🚀 Verifying compiled code...');
try {
  // Don't actually run it, just check if it can be required
  const mainModule = require(path.resolve(distIndexPath));
  console.log('✅ Compiled code can be loaded');
} catch (error) {
  console.error('❌ Error loading compiled code:', error.message);
  process.exit(1);
}

console.log('\n🎉 Build verification complete!');
console.log('\n📋 Next steps for Render deployment:');
console.log('1. Push your code to GitHub');
console.log('2. Create a new Web Service on Render');
console.log('3. Set environment variables');
console.log('4. Deploy!');
console.log('\nSee DEPLOYMENT_GUIDE.md for detailed instructions.');
