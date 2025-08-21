#!/usr/bin/env npx ts-node

import { SecurityTestRunner, QuickTestScenarios } from '../tests_real/SecurityTestRunner';
import { program } from 'commander';

// CLI interface for running different test scenarios
program
  .name('security-test-runner')
  .description('HyperIndex Security and Performance Test Suite')
  .version('1.0.0');

program
  .command('basic')
  .description('Run basic security tests (5 minutes, 500 users, 10K TPS)')
  .action(async () => {
    try {
      await QuickTestScenarios.runBasicSecurityTest();
    } catch (error) {
      console.error('Basic test failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('stress')
  .description('Run full stress test (20 minutes, 5K users, 25K TPS)')
  .action(async () => {
    try {
      await QuickTestScenarios.runFullStressTest();
    } catch (error) {
      console.error('Stress test failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('production')
  .description('Run production readiness test (10 minutes, 2K users, 20K TPS)')
  .action(async () => {
    try {
      await QuickTestScenarios.runProductionReadinessTest();
    } catch (error) {
      console.error('Production test failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('custom')
  .description('Run custom test configuration')
  .option('-d, --duration <minutes>', 'Test duration in minutes', '10')
  .option('-u, --users <count>', 'Number of users', '1000')
  .option('-t, --tps <target>', 'Target TPS', '20000')
  .option('-a, --attackers <percentage>', 'Attacker percentage', '15')
  .option('--security-only', 'Run only security tests (skip simulation)')
  .option('--simulation-only', 'Run only simulation (skip security tests)')
  .action(async (options) => {
    try {
      const config = {
        runSecurityTests: !options.simulationOnly,
        runSimulation: !options.securityOnly,
        simulationDuration: parseInt(options.duration) * 60 * 1000,
        userCount: parseInt(options.users),
        targetTPS: parseInt(options.tps),
        attackerRatio: parseInt(options.attackers),
        tokenPairs: ['ETH/USDC', 'BTC/USDC', 'MATIC/USDC', 'ETH/BTC']
      };
      
      console.log('🎛️  Custom Configuration:');
      console.log(`   Duration: ${options.duration} minutes`);
      console.log(`   Users: ${options.users}`);
      console.log(`   Target TPS: ${options.tps}`);
      console.log(`   Attackers: ${options.attackers}%`);
      console.log(`   Security Tests: ${config.runSecurityTests ? 'Yes' : 'No'}`);
      console.log(`   Simulation: ${config.runSimulation ? 'Yes' : 'No'}`);
      console.log('');
      
      const runner = new SecurityTestRunner(config);
      await runner.runAllTests();
    } catch (error) {
      console.error('Custom test failed:', error.message);
      process.exit(1);
    }
  });

// Special command for the exact scenario requested
program
  .command('exploit-analysis')
  .description('Run comprehensive exploit analysis (30+ attack scenarios + 10min simulation)')
  .action(async () => {
    try {
      console.log('🎯 Running Comprehensive Exploit Analysis');
      console.log('   • 30+ security attack scenarios');
      console.log('   • 10-minute trading simulation');
      console.log('   • Realistic attack patterns');
      console.log('   • Detailed performance metrics');
      console.log('');
      
      const runner = new SecurityTestRunner({
        runSecurityTests: true,
        runSimulation: true,
        simulationDuration: 10 * 60 * 1000, // Exactly 10 minutes
        userCount: 1000,
        targetTPS: 20000,
        attackerRatio: 20, // 20% attackers for comprehensive testing
        tokenPairs: ['ETH/USDC', 'BTC/USDC', 'MATIC/USDC', 'ETH/BTC'],
        generateReport: true,
        exportCSV: true,
        outputDir: './test-results/exploit-analysis'
      });
      
      await runner.runAllTests();
      
      console.log('\n🎉 Exploit Analysis Complete!');
      console.log('📁 Results saved in ./test-results/exploit-analysis/');
      console.log('📊 CSV data available for further analysis');
      
    } catch (error) {
      console.error('Exploit analysis failed:', error.message);
      process.exit(1);
    }
  });

// Help and examples
program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log('📚 HyperIndex Security Test Examples:');
    console.log('');
    console.log('Basic quick test (recommended for development):');
    console.log('  npm run test:security basic');
    console.log('');
    console.log('Production readiness check:');
    console.log('  npm run test:security production');
    console.log('');
    console.log('Full stress test for max performance validation:');
    console.log('  npm run test:security stress');
    console.log('');
    console.log('Comprehensive exploit analysis (as requested):');
    console.log('  npm run test:security exploit-analysis');
    console.log('');
    console.log('Custom test with specific parameters:');
    console.log('  npm run test:security custom -d 15 -u 2000 -t 25000 -a 25');
    console.log('');
    console.log('Security tests only (no simulation):');
    console.log('  npm run test:security custom --security-only');
    console.log('');
    console.log('Simulation only (no security tests):');
    console.log('  npm run test:security custom --simulation-only -d 5');
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}