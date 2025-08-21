// app/api/withdrawal/monitor/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requirePrivyAuth } from '@/lib/middleware/privy-auth';
import { 
  WithdrawalMonitoringService,
  startWithdrawalMonitoring,
  stopWithdrawalMonitoring,
  getWithdrawalMonitoringStats,
  forceCheckWithdrawal
} from '@/lib/monitoring/withdrawal-monitoring';

// GET endpoint for monitoring status and stats
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const transactionId = searchParams.get('transactionId');

    switch (action) {
      case 'status':
        return await handleGetMonitoringStatus();
      
      case 'stats':
        return await handleGetMonitoringStats();
      
      case 'force-check':
        if (!transactionId) {
          return NextResponse.json(
            { error: 'Transaction ID is required for force check' },
            { status: 400 }
          );
        }
        return await handleForceCheck(transactionId);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Withdrawal monitoring GET error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST endpoint for monitoring control
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await requirePrivyAuth(request);
    if ('status' in authResult) {
      return authResult;
    }

    const body = await request.json();
    const { action, config } = body;

    // Only allow admin users to control monitoring
    if (authResult.user.email !== 'admin@p2pfiat.com') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    switch (action) {
      case 'start':
        return await handleStartMonitoring();
      
      case 'stop':
        return await handleStopMonitoring();
      
      case 'update-config':
        return await handleUpdateConfig(config);
      
      case 'get-config':
        return await handleGetConfig();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (_error) {
    console.error('❌ Withdrawal monitoring POST error:', _error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetMonitoringStatus() {
  try {
    const stats = await getWithdrawalMonitoringStats();
    
    return NextResponse.json({
      success: true,
      monitoring: {
        isRunning: stats.isRunning,
        status: stats.isRunning ? 'active' : 'stopped',
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (_error) {
    console.error('❌ Failed to get monitoring status:', _error);
    return NextResponse.json(
      { error: 'Failed to get monitoring status' },
      { status: 500 }
    );
  }
}

async function handleGetMonitoringStats() {
  try {
    const stats = await getWithdrawalMonitoringStats();
    
    return NextResponse.json({
      success: true,
      statistics: stats
    });
  } catch (_error) {
    console.error('❌ Failed to get monitoring stats:', _error);
    return NextResponse.json(
      { error: 'Failed to get monitoring statistics' },
      { status: 500 }
    );
  }
}

async function handleForceCheck(transactionId: string) {
  try {
    const result = await forceCheckWithdrawal(transactionId);
    
    return NextResponse.json({
      success: result.success,
      forceCheck: {
        transactionId,
        status: result.status,
        error: result.error,
        checkedAt: new Date().toISOString()
      }
    });
  } catch (_error) {
    console.error('❌ Force check failed:', _error);
    return NextResponse.json(
      { error: 'Force check failed' },
      { status: 500 }
    );
  }
}

async function handleStartMonitoring() {
  try {
    startWithdrawalMonitoring();
    
    return NextResponse.json({
      success: true,
      message: 'Withdrawal monitoring started successfully',
      startedAt: new Date().toISOString()
    });
  } catch (_error) {
    console.error('❌ Failed to start monitoring:', _error);
    return NextResponse.json(
      { error: 'Failed to start monitoring' },
      { status: 500 }
    );
  }
}

async function handleStopMonitoring() {
  try {
    stopWithdrawalMonitoring();
    
    return NextResponse.json({
      success: true,
      message: 'Withdrawal monitoring stopped successfully',
      stoppedAt: new Date().toISOString()
    });
  } catch (_error) {
    console.error('❌ Failed to stop monitoring:', _error);
    return NextResponse.json(
      { error: 'Failed to stop monitoring' },
      { status: 500 }
    );
  }
}

async function handleUpdateConfig(config: any) {
  try {
    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Invalid configuration provided' },
        { status: 400 }
      );
    }

    const monitoringService = WithdrawalMonitoringService.getInstance();
    monitoringService.updateConfig(config);
    
    return NextResponse.json({
      success: true,
      message: 'Monitoring configuration updated successfully',
      config: monitoringService.getConfig(),
      updatedAt: new Date().toISOString()
    });
  } catch (_error) {
    console.error('❌ Failed to update config:', _error);
    return NextResponse.json(
      { error: 'Failed to update monitoring configuration' },
      { status: 500 }
    );
  }
}

async function handleGetConfig() {
  try {
    const monitoringService = WithdrawalMonitoringService.getInstance();
    const config = monitoringService.getConfig();
    
    return NextResponse.json({
      success: true,
      config
    });
  } catch (_error) {
    console.error('❌ Failed to get config:', _error);
    return NextResponse.json(
      { error: 'Failed to get monitoring configuration' },
      { status: 500 }
    );
  }
}