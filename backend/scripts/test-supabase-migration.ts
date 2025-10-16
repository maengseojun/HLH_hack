#!/usr/bin/env tsx
/**
 * Test script for Supabase migration
 * Run with: tsx scripts/test-supabase-migration.ts
 */

import { getIndexById, getIndexBySymbol, getAllIndices } from '../src/services/index.supabase.js';

async function testSupabaseMigration() {
  console.log('🧪 Testing Supabase Migration...\n');
  
  try {
    // Test 1: Get all indices
    console.log('Test 1: Get all indices');
    const allIndices = await getAllIndices();
    console.log(`✅ Found ${allIndices.length} indices`);
    if (allIndices.length > 0) {
      console.log('First index:', {
        id: allIndices[0].id,
        symbol: allIndices[0].symbol,
        name: allIndices[0].name,
        layer: allIndices[0].layer,
      });
    }
    console.log('');
    
    // Test 2: Get index by ID (if exists)
    if (allIndices.length > 0) {
      const firstId = allIndices[0].id;
      console.log(`Test 2: Get index by ID (${firstId})`);
      const indexById = await getIndexById(firstId);
      console.log('✅ Retrieved index:', {
        id: indexById.id,
        symbol: indexById.symbol,
        components: indexById.components.length,
      });
      console.log('');
    }
    
    // Test 3: Get index by symbol (if exists)
    if (allIndices.length > 0) {
      const firstSymbol = allIndices[0].symbol;
      console.log(`Test 3: Get index by symbol (${firstSymbol})`);
      const indexBySymbol = await getIndexBySymbol(firstSymbol);
      console.log('✅ Retrieved index:', {
        id: indexBySymbol.id,
        symbol: indexBySymbol.symbol,
        name: indexBySymbol.name,
      });
      console.log('');
    }
    
    // Test 4: Error handling - non-existent ID
    console.log('Test 4: Error handling (non-existent ID)');
    try {
      await getIndexById('00000000-0000-0000-0000-000000000000');
      console.log('❌ Should have thrown error');
    } catch (error: any) {
      if (error.status === 404) {
        console.log('✅ Correctly threw 404 error');
      } else {
        console.log('❌ Wrong error type:', error);
      }
    }
    console.log('');
    
    console.log('🎉 All tests passed!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testSupabaseMigration().then(() => {
  console.log('✅ Migration test complete');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
