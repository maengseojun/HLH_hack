// app/api/scv/position/[positionId]/route.ts
/**
 * SCV Position Management API
 * Get position details, current value, and performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyAuth } from '@/lib/middleware/privy-auth';
import HyperVMSCVManager from '@/lib/scv/hypervm-scv-manager';

interface PositionParams {
  params: {
    positionId: string;
  };
}

export async function GET(request: NextRequest, { params }: PositionParams) {
  try {
    // Verify authentication
    const authResult = await verifyPrivyAuth(request);
    if (!authResult.isAuthenticated) {
      return authResult.response;
    }

    const { positionId } = params;

    if (!positionId) {
      return NextResponse.json(
        { error: 'Position ID is required' },
        { status: 400 }
      );
    }

    // Initialize SCV Manager
    const scvManager = new HyperVMSCVManager(
      process.env.HYPERVM_TESTNET_RPC,
      process.env.PRIVATE_KEY
    );

    console.log('Fetching SCV position:', {
      positionId,
      userId: authResult.user.id
    });

    // Get position details
    const position = await scvManager.getHyperSCVPosition(positionId);

    if (!position) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (position.userId !== authResult.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized access to position' },
        { status: 403 }
      );
    }

    // Calculate additional metrics
    const totalHypercoreValue = Object.values(position.positions.hypercore)
      .reduce((sum, pos) => sum + pos.valueUSDC, 0);

    const totalExternalValue = Object.values(position.positions.external)
      .reduce((chainSum, chain) => 
        chainSum + Object.values(chain).reduce((tokenSum, pos) => tokenSum + pos.valueUSDC, 0), 0);

    const positionBreakdown = {
      hypercore: {
        value: totalHypercoreValue,
        percentage: (totalHypercoreValue / position.totalValueUSDC) * 100,
        tokens: Object.keys(position.positions.hypercore).length,
        status: 'active' // HyperCore tokens are always active
      },
      external: {
        value: totalExternalValue,
        percentage: (totalExternalValue / position.totalValueUSDC) * 100,
        chains: Object.keys(position.positions.external).length,
        tokens: Object.values(position.positions.external)
          .reduce((total, chain) => total + Object.keys(chain).length, 0),
        hedgedTokens: Object.values(position.positions.external)
          .reduce((total, chain) => 
            total + Object.values(chain).filter(pos => pos.isHedged).length, 0)
      }
    };

    // Calculate age and performance metrics
    const ageHours = (Date.now() - position.createdAt) / (1000 * 60 * 60);
    const ageDays = Math.floor(ageHours / 24);

    return NextResponse.json({
      success: true,
      position: {
        id: position.id,
        indexId: position.indexId,
        totalValueUSDC: position.totalValueUSDC,
        createdAt: position.createdAt,
        lastRebalanced: position.lastRebalanced,
        age: {
          hours: Math.floor(ageHours),
          days: ageDays,
          humanReadable: ageDays > 0 ? `${ageDays} days ago` : `${Math.floor(ageHours)} hours ago`
        },
        breakdown: positionBreakdown,
        performance: {
          ...position.performance,
          currentValue: position.totalValueUSDC,
          costBasis: position.totalValueUSDC, // Would be different in real scenario
          unrealizedPnL: position.performance.unrealized,
          unrealizedPnLPercent: (position.performance.unrealized / position.totalValueUSDC) * 100
        },
        positions: {
          hypercore: position.positions.hypercore,
          external: position.positions.external
        },
        rebalancing: {
          lastRebalanced: position.lastRebalanced,
          nextRebalance: position.lastRebalanced + (7 * 24 * 60 * 60 * 1000), // Weekly
          isRebalanceDue: (Date.now() - position.lastRebalanced) > (7 * 24 * 60 * 60 * 1000)
        }
      }
    });

  } catch (error) {
    console.error('Get SCV position error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch position',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: PositionParams) {
  try {
    // Verify authentication
    const authResult = await verifyPrivyAuth(request);
    if (!authResult.isAuthenticated) {
      return authResult.response;
    }

    const { positionId } = params;
    const body = await request.json();
    const { action } = body;

    if (!positionId || !action) {
      return NextResponse.json(
        { error: 'Position ID and action are required' },
        { status: 400 }
      );
    }

    // Initialize SCV Manager
    const scvManager = new HyperVMSCVManager(
      process.env.HYPERVM_TESTNET_RPC,
      process.env.PRIVATE_KEY
    );

    console.log('Position action requested:', {
      positionId,
      action,
      userId: authResult.user.id
    });

    switch (action) {
      case 'rebalance':
        const rebalanceResult = await scvManager.rebalanceHyperSCVPosition(positionId);
        
        if (rebalanceResult.success) {
          return NextResponse.json({
            success: true,
            message: 'Position rebalanced successfully',
            transactions: rebalanceResult.transactions,
            details: {
              positionId,
              executedAt: Date.now(),
              transactionCount: rebalanceResult.transactions?.length || 0
            }
          });
        } else {
          return NextResponse.json(
            { error: 'Rebalancing failed' },
            { status: 500 }
          );
        }

      case 'refresh':
        // Force refresh position values
        const position = await scvManager.getHyperSCVPosition(positionId);
        if (position) {
          return NextResponse.json({
            success: true,
            message: 'Position refreshed',
            lastUpdated: Date.now()
          });
        } else {
          return NextResponse.json(
            { error: 'Position not found' },
            { status: 404 }
          );
        }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Position action error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to execute position action',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}