#!/usr/bin/env node
/**
 * Simple test to verify Supabase connection
 * Run with: node scripts/test-simple.js
 */

console.log('🧪 Testing Supabase Connection...\n');

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment Check:');
console.log('SUPABASE_URL:', supabaseUrl || '❌ NOT SET');
console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ SET' : '❌ NOT SET');
console.log('');

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Supabase credentials not configured in .env file');
  console.log('');
  console.log('Please add these to your .env file:');
  console.log('SUPABASE_URL=http://localhost:54321');
  console.log('SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU');
  process.exit(1);
}

// Try to connect using fetch
async function testConnection() {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/indices?select=id,symbol,name&limit=5`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!response.ok) {
      console.log('❌ API request failed:', response.status, response.statusText);
      const text = await response.text();
      console.log('Response:', text);
      process.exit(1);
    }
    
    const data = await response.json();
    
    console.log('✅ Successfully connected to Supabase!');
    console.log('');
    console.log(`Found ${data.length} indices:`);
    data.forEach((index, i) => {
      console.log(`  ${i + 1}. ${index.symbol} - ${index.name}`);
    });
    console.log('');
    console.log('🎉 Migration test successful!');
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('');
    console.log('Is Supabase running? Try: supabase status');
    process.exit(1);
  }
}

testConnection();
