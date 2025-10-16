// Phase 1 Tests: Read Operations for Funding Rounds
// Test all GET functions

// Load test environment variables FIRST
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.test
dotenv.config({ path: join(__dirname, '..', '.env.test') });

console.log('🔧 Test Environment:');
console.log('  SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('  Has Service Key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('');

import {
  getAllFundingRounds,
  getActiveFundingRounds,
  getFundingRound,
  getUserInvestments,
  getInvestment,
  calculateClaimableAmount,
  getUserClaimableTokens,
  getFundingRoundStats,
} from '../src/services/fundingRound.supabase.js';

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;

function log(message: string, color: string = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function assert(condition: boolean, message: string) {
  if (condition) {
    log(`  ✅ ${message}`, GREEN);
    passCount++;
  } else {
    log(`  ❌ ${message}`, RED);
    failCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

async function testGetAllFundingRounds() {
  log('\n📋 Test 1: getAllFundingRounds()', BLUE);
  
  const rounds = await getAllFundingRounds();
  
  assert(Array.isArray(rounds), 'Returns an array');
  assert(rounds.length === 3, `Returns 3 rounds (got ${rounds.length})`);
  assert(rounds[0].name === 'seed', 'First round is seed');
  assert(rounds[1].name === 'strategic', 'Second round is strategic');
  assert(rounds[2].name === 'public', 'Third round is public');
  
  // Check structure
  const round = rounds[0];
  assert(typeof round.id === 'string', 'Has id field');
  assert(typeof round.pricePerToken === 'number', 'Has pricePerToken');
  assert(typeof round.currentRaise === 'number', 'Has currentRaise');
  assert(typeof round.status === 'string', 'Has status');
  
  log(`  📊 Rounds: ${rounds.map(r => r.name).join(', ')}`);
}

async function testGetActiveFundingRounds() {
  log('\n📋 Test 2: getActiveFundingRounds()', BLUE);
  
  const activeRounds = await getActiveFundingRounds();
  
  assert(Array.isArray(activeRounds), 'Returns an array');
  assert(activeRounds.length >= 1, `Has at least 1 active round (got ${activeRounds.length})`);
  
  // All returned rounds should have 'active' status
  activeRounds.forEach(round => {
    assert(round.status === 'active', `Round ${round.name} has active status`);
  });
  
  log(`  📊 Active rounds: ${activeRounds.map(r => r.name).join(', ')}`);
}

async function testGetFundingRound() {
  log('\n📋 Test 3: getFundingRound()', BLUE);
  
  // First get all rounds to get a valid ID
  const rounds = await getAllFundingRounds();
  const seedRound = rounds.find(r => r.name === 'seed');
  
  assert(!!seedRound, 'Seed round exists');
  
  if (seedRound) {
    const round = await getFundingRound(seedRound.id);
    
    assert(round.id === seedRound.id, 'Returns correct round');
    assert(round.name === 'seed', 'Has correct name');
    assert(round.pricePerToken === 0.01, 'Has correct price');
    assert(round.discountPercent === 70, 'Has correct discount');
    
    log(`  📊 Round: ${round.name}, Price: $${round.pricePerToken}, Discount: ${round.discountPercent}%`);
  }
  
  // Test not found - Use valid UUID format that doesn't exist
  try {
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000'; // Valid UUID format
    await getFundingRound(nonExistentUuid);
    assert(false, 'Should throw error for non-existent ID');
  } catch (error: any) {
    log(`  🔍 Error caught: status=${error.status}, message="${error.message}"`, YELLOW);
    assert(error.status === 404, `Returns 404 for non-existent ID (got ${error.status})`);
  }
}

async function testGetUserInvestments() {
  log('\n📋 Test 4: getUserInvestments()', BLUE);
  
  // Test with a user that has no investments (valid UUID format)
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const investments = await getUserInvestments(testUserId);
  
  assert(Array.isArray(investments), 'Returns an array');
  assert(investments.length === 0, 'Returns empty array for user with no investments');
  
  log(`  📊 User ${testUserId}: ${investments.length} investments`);
}

async function testGetInvestment() {
  log('\n📋 Test 5: getInvestment()', BLUE);
  
  // Test not found (no investments yet) - Use valid UUID format
  try {
    const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
    await getInvestment(nonExistentUuid);
    assert(false, 'Should throw error for non-existent ID');
  } catch (error: any) {
    log(`  🔍 Error caught: status=${error.status}, message="${error.message}"`, YELLOW);
    assert(error.status === 404, `Returns 404 for non-existent ID (got ${error.status})`);
  }
  
  log(`  📊 Correctly handles missing investments`);
}

async function testCalculateClaimableAmount() {
  log('\n📋 Test 6: calculateClaimableAmount() - Pure Function', BLUE);
  
  const now = Date.now();
  
  // Test case 1: Before cliff
  const investmentBeforeCliff = {
    id: 'test-1',
    userId: 'user-1',
    roundId: 'round-1',
    roundName: 'seed',
    investmentAmount: 1000,
    tokenAmount: 100000,
    pricePerToken: 0.01,
    timestamp: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    vestingSchedule: {
      totalAmount: 100000,
      startTime: now - 30 * 24 * 60 * 60 * 1000,
      cliffEndTime: now + 30 * 24 * 60 * 60 * 1000, // Cliff in future
      endTime: now + 365 * 24 * 60 * 60 * 1000,
      claimedAmount: 0,
    },
    claimedAmount: 0,
    remainingAmount: 100000,
  };
  
  const claimableBeforeCliff = calculateClaimableAmount(investmentBeforeCliff);
  assert(claimableBeforeCliff === 0, 'Before cliff: 0 claimable');
  
  // Test case 2: After vesting end
  const investmentAfterVesting = {
    ...investmentBeforeCliff,
    vestingSchedule: {
      ...investmentBeforeCliff.vestingSchedule,
      cliffEndTime: now - 365 * 24 * 60 * 60 * 1000,
      endTime: now - 1 * 24 * 60 * 60 * 1000, // Ended yesterday
    },
  };
  
  const claimableAfterVesting = calculateClaimableAmount(investmentAfterVesting);
  assert(claimableAfterVesting === 100000, 'After vesting end: All claimable');
  
  // Test case 3: During vesting (50% progress)
  const halfwayPoint = now;
  const investmentDuringVesting = {
    ...investmentBeforeCliff,
    vestingSchedule: {
      totalAmount: 100000,
      startTime: now - 180 * 24 * 60 * 60 * 1000, // 180 days ago
      cliffEndTime: now - 90 * 24 * 60 * 60 * 1000, // Cliff passed 90 days ago
      endTime: now + 90 * 24 * 60 * 60 * 1000, // Ends in 90 days (50% done)
      claimedAmount: 0,
    },
  };
  
  const claimableDuringVesting = calculateClaimableAmount(investmentDuringVesting);
  assert(claimableDuringVesting > 40000 && claimableDuringVesting < 60000, 
    `During vesting (~50%): ${claimableDuringVesting.toFixed(0)} tokens (~50k expected)`);
  
  log(`  📊 Pure function tests passed (Before cliff: 0, After: 100k, During: ${claimableDuringVesting.toFixed(0)})`);
}

async function testGetUserClaimableTokens() {
  log('\n📋 Test 7: getUserClaimableTokens()', BLUE);
  
  // Test with user that has no investments (valid UUID)
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const claimable = await getUserClaimableTokens(testUserId);
  
  assert(typeof claimable.total === 'number', 'Returns total');
  assert(Array.isArray(claimable.byInvestment), 'Returns byInvestment array');
  assert(claimable.total === 0, 'Total is 0 for user with no investments');
  assert(claimable.byInvestment.length === 0, 'byInvestment is empty');
  
  log(`  📊 User ${testUserId}: ${claimable.total} claimable tokens`);
}

async function testGetFundingRoundStats() {
  log('\n📋 Test 8: getFundingRoundStats()', BLUE);
  
  const stats = await getFundingRoundStats();
  
  assert(typeof stats.totalRounds === 'number', 'Has totalRounds');
  assert(typeof stats.activeRounds === 'number', 'Has activeRounds');
  assert(typeof stats.completedRounds === 'number', 'Has completedRounds');
  assert(typeof stats.totalRaised === 'number', 'Has totalRaised');
  assert(typeof stats.totalTarget === 'number', 'Has totalTarget');
  assert(typeof stats.progress === 'number', 'Has progress');
  assert(Array.isArray(stats.rounds), 'Has rounds array');
  
  assert(stats.totalRounds === 3, 'Total 3 rounds');
  assert(stats.totalTarget === 7500000, 'Total target is 7.5M (500k + 2M + 5M)');
  assert(stats.totalRaised === 0, 'Total raised is 0 (no investments yet)');
  assert(stats.progress === 0, 'Progress is 0%');
  
  log(`  📊 Stats: ${stats.totalRounds} rounds, ${stats.activeRounds} active, $${stats.totalRaised.toLocaleString()} raised`);
}

// ============================================================================
// Run All Tests
// ============================================================================

async function runAllTests() {
  log('\n' + '='.repeat(60), YELLOW);
  log('🧪 Phase 1 Test Suite: Read Operations', YELLOW);
  log('='.repeat(60), YELLOW);
  
  try {
    await testGetAllFundingRounds();
    await testGetActiveFundingRounds();
    await testGetFundingRound();
    await testGetUserInvestments();
    await testGetInvestment();
    await testCalculateClaimableAmount();
    await testGetUserClaimableTokens();
    await testGetFundingRoundStats();
    
    log('\n' + '='.repeat(60), YELLOW);
    log(`✅ Test Summary: ${passCount} passed, ${failCount} failed`, passCount === (passCount + failCount) ? GREEN : RED);
    log('='.repeat(60), YELLOW);
    
    if (failCount === 0) {
      log('\n🎉 All Phase 1 tests passed! Ready for Phase 3.', GREEN);
      process.exit(0);
    } else {
      log('\n❌ Some tests failed. Fix issues before continuing.', RED);
      process.exit(1);
    }
    
  } catch (error) {
    log('\n❌ Test suite failed with error:', RED);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runAllTests();
