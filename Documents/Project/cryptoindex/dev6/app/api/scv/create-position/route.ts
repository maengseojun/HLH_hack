// app/api/scv/create-position/route.ts
/**
 * Create SCV Position API
 * Uses HyperEVM-centered approach with LayerZero for external chains
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPrivyAuth } from '@/lib/middleware/privy-auth';
import HyperVMSCVManager from '@/lib/scv/hypervm-scv-manager';

interface CreatePositionRequest {
  indexId: string;
  usdcAmount: number;
  userWalletAddress: string;
  slippageTolerance?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyPrivyAuth(request);
    if (!authResult.isAuthenticated) {
      return authResult.response;
    }

    const body: CreatePositionRequest = await request.json();
    const { indexId, usdcAmount, userWalletAddress, slippageTolerance = 1 } = body;

    // Validation
    if (!indexId || !usdcAmount || !userWalletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: indexId, usdcAmount, userWalletAddress' },
        { status: 400 }
      );
    }

    if (usdcAmount < 10) {
      return NextResponse.json(
        { error: 'Minimum investment is 10 USDC' },
        { status: 400 }
      );
    }

    if (usdcAmount > 100000) {
      return NextResponse.json(
        { error: 'Maximum investment is 100,000 USDC' },
        { status: 400 }
      );
    }

    // Initialize HyperVM SCV Manager
    const scvManager = new HyperVMSCVManager(
      process.env.HYPERVM_TESTNET_RPC,
      process.env.PRIVATE_KEY
    );

    // Health check first
    const health = await scvManager.healthCheck();
    if (!health.overall) {
      console.error('SCV Manager health check failed:', health);
      return NextResponse.json(
        { 
          error: 'System temporarily unavailable',
          details: health
        },
        { status: 503 }
      );
    }

    console.log('Creating SCV position:', {
      userId: authResult.user.id,
      indexId,
      usdcAmount,
      userWalletAddress
    });

    // Create the position
    const result = await scvManager.createHyperSCVPosition(
      authResult.user.id,
      indexId,
      usdcAmount,
      userWalletAddress
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        positionId: result.positionId,
        transactions: result.transactions,
        message: 'SCV position created successfully',
        details: {
          indexId,
          investmentAmount: usdcAmount,
          estimatedGasFee: '~$2-5 for cross-chain operations',
          expectedExecutionTime: '1-5 minutes for full position setup'
        }
      });
    } else {
      return NextResponse.json(
        { 
          error: 'Failed to create SCV position',
          details: result
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Create SCV position error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get available indices
    const scvManager = new HyperVMSCVManager();
    const indices = scvManager.getAvailableIndices();

    return NextResponse.json({
      success: true,
      indices: indices.map(index => ({
        id: index.id,
        name: index.name,
        symbol: index.symbol,
        description: index.description,
        tokens: index.tokens.map(token => ({
          symbol: token.symbol,
          name: token.name,
          chain: token.chain,
          allocation: token.allocation,
          isHyperCore: token.isHyperCore
        })),
        totalTokens: index.tokens.length,
        hypercoreTokens: index.tokens.filter(t => t.isHyperCore).length,
        externalChains: [...new Set(index.tokens.filter(t => !t.isHyperCore).map(t => t.chain))]
      }))
    });

  } catch (error) {
    console.error('Get available indices error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available indices' },
      { status: 500 }
    );
  }
}