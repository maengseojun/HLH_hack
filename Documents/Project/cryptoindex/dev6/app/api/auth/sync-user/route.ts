import { NextRequest, NextResponse } from 'next/server'
import { requirePrivyAuth } from '@/lib/middleware/privy-auth'
import { supabaseAdmin } from '@/lib/supabase/client'

// Chain ID to network name mapping
const CHAIN_ID_TO_NETWORK: { [key: number]: string } = {
  1: 'ethereum',
  42161: 'arbitrum',
  137: 'polygon', 
  8453: 'base',
  10: 'optimism',
  // Solana는 chain ID가 없으므로 별도 처리
}

// Helper function to get network name from chain info
function getNetworkName(chainType: string, chainId?: number): string {
  // Solana의 경우
  if (chainType === 'solana') {
    return 'solana';
  }
  
  // EVM 체인의 경우 chain ID로 매핑
  if (chainId && CHAIN_ID_TO_NETWORK[chainId]) {
    return CHAIN_ID_TO_NETWORK[chainId];
  }
  
  // chainType이 있으면 그대로 사용
  if (chainType) {
    return chainType.toLowerCase();
  }
  
  // 기본값
  return 'ethereum';
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 sync-user API called');
    
    // 인증 확인
    const authResult = await requirePrivyAuth(request)
    if (authResult instanceof NextResponse) {
      console.log('❌ Authentication failed');
      return authResult
    }

    const { user } = authResult
    console.log('✅ Authentication successful for user:', user?.id);

    // 요청 바디에서 Privy 사용자 데이터 받기
    const body = await request.json()
    const { privyUser } = body
    console.log('📥 Received privyUser:', privyUser?.id);

    if (!privyUser || !privyUser.id) {
      return NextResponse.json(
        { success: false, error: 'Missing Privy user data' },
        { status: 400 }
      )
    }

    // auth_type 결정 로직 개선
    // 이메일이 있으면 email 사용자, 없으면 wallet 사용자
    const isEmailUser = !!(privyUser.email?.address);
    const authType = isEmailUser ? 'email' : 'wallet';
    
    console.log('🔍 Auth type detection:', {
      hasEmail: !!privyUser.email?.address,
      hasPrimaryWallet: !!privyUser.wallet?.address,
      linkedAccountsCount: privyUser.linkedAccounts?.length || 0,
      detectedAuthType: authType
    });

    // Privy 사용자 데이터를 Supabase 형식으로 변환 (정리된 필드)
    const userData = {
      privy_user_id: privyUser.id,
      auth_type: authType,
      email: privyUser.email?.address || null,
      last_login: new Date().toISOString(),
      is_active: true,
    }


    // Admin 권한으로 사용자 생성/업데이트 (RLS 우회)
    console.log('💾 Attempting to upsert user data:', userData);
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert(userData, { onConflict: 'privy_user_id' })
      .select()

    if (error) {
      console.error('❌ Supabase upsert error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to sync user data', details: error.message },
        { status: 500 }
      )
    }
    
    console.log('✅ User upserted successfully:', data?.[0]?.id);

    const createdUser = data[0]

    // 모든 지갑 정보를 user_wallets 테이블에 동기화
    const walletSyncResults = []
    
    // linkedAccounts에서 모든 지갑 정보 수집 (안전한 방법)
    const allUserWallets = []
    
    console.log(`🔍 DEBUGGING linkedAccounts for user ${privyUser.id}:`);
    console.log(`linkedAccounts exists: ${!!privyUser.linkedAccounts}`);
    console.log(`linkedAccounts length: ${privyUser.linkedAccounts?.length || 0}`);
    console.log(`linkedAccounts raw data:`, JSON.stringify(privyUser.linkedAccounts, null, 2));
    
    if (privyUser.linkedAccounts && privyUser.linkedAccounts.length > 0) {
      privyUser.linkedAccounts.forEach((account, index) => {
        console.log(`Account ${index}:`, {
          type: account.type,
          address: account.address,
          chainType: account.chainType,
          chainId: account.chainId,
          walletClientType: account.walletClientType,
          connectorType: account.connectorType,
          id: account.id,
          hasAllRequiredFields: !!(account.address && account.chainType && account.walletClientType)
        });
        
        if (account.type === 'wallet') {
          // 필수 필드 확인
          if (!account.address) {
            console.log(`⚠️ Skipping wallet ${index}: Missing address`);
            return;
          }
          if (!account.chainType) {
            console.log(`⚠️ Skipping wallet ${index}: Missing chainType`);
            return;
          }
          if (!account.walletClientType) {
            console.log(`⚠️ Skipping wallet ${index}: Missing walletClientType`);
            return;
          }
          
          // 🚫 FILTER OUT NON-EVM WALLETS (SOLANA, etc.)
          if (account.chainType === 'solana' || !account.address.startsWith('0x')) {
            console.log(`🚫 Skipping non-EVM wallet ${index}: ${account.chainType} - ${account.address.slice(0, 8)}...`);
            return;
          }
          
          // 정확한 네트워크 감지 사용 (EVM only)
          const networkName = getNetworkName(account.chainType, account.chainId);
          
          allUserWallets.push({
            address: account.address,
            chainType: account.chainType,
            chainId: account.chainId,
            networkName: networkName,
            walletClientType: account.walletClientType,
            walletType: account.connectorType === 'embedded' ? 'embedded' : 'external',
            source: 'linkedAccounts',
            privyWalletId: account.id || null // embedded 지갑의 경우 ID 존재
          })
        }
      })
      
      console.log(`✅ Found ${allUserWallets.length} valid wallets for user ${privyUser.id}:`);
      allUserWallets.forEach((wallet, index) => {
        console.log(`  ${index + 1}. ${wallet.walletType} ${wallet.networkName} ${wallet.walletClientType}: ${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`);
        console.log(`     - Chain Type: ${wallet.chainType}`);
        console.log(`     - Chain ID: ${wallet.chainId || 'N/A'}`);
        console.log(`     - Network: ${wallet.networkName}`);
        console.log(`     - Type: ${wallet.walletType}`);
        console.log(`     - Provider: ${wallet.walletClientType}`);
        console.log(`     - Privy ID: ${wallet.privyWalletId || 'N/A'}`);
      });
    } else {
      console.log(`⚠️ No linkedAccounts found for user ${privyUser.id}`);
    }
    
    if (allUserWallets.length > 0) {
      // 기존 지갑들 삭제 (새로운 지갑 정보로 완전히 교체)
      await supabaseAdmin
        .from('user_wallets')
        .delete()
        .eq('user_id', createdUser.id)

      // 모든 지갑 정보 삽입
      for (let i = 0; i < allUserWallets.length; i++) {
        const wallet = allUserWallets[i]
        
        const walletData = {
          user_id: createdUser.id,
          wallet_address: wallet.address,
          wallet_provider: wallet.walletClientType || 'unknown',
          network: wallet.networkName || 'ethereum', // 개선된 네트워크 감지 사용
          wallet_type: wallet.walletType || 'external', // external 또는 embedded
          privy_wallet_id: wallet.privyWalletId || null, // embedded 지갑의 Privy ID
          is_primary: i === 0, // 첫 번째 지갑을 primary로 설정
          created_at: new Date().toISOString()
        }

        const { data: walletResult, error: walletError } = await supabaseAdmin
          .from('user_wallets')
          .insert(walletData)
          .select()

        if (walletError) {
          console.error('Wallet sync error:', walletError)
        } else {
          walletSyncResults.push(walletResult[0])
        }
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        user: createdUser,
        syncedWallets: walletSyncResults,
        allUserWallets: allUserWallets, // 디버깅용
        message: `User synced successfully with ${walletSyncResults.length} wallets`
      },
      { status: 200 }
    )

  } catch (_error) {
    console.error('❌ Unexpected error in sync-user:', _error);
    console.error('Error stack:', (_error as Error)?.stack);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: (_error as Error)?.message || String(_error) },
      { status: 500 }
    )
  }
}