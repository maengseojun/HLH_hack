// lib/auth/privy-utils.ts
import jwt from 'jsonwebtoken';

export interface PrivyUser {
  id: string;
  email?: {
    address: string;
    verified: boolean;
  };
  wallets?: Array<{
    address: string;
    type: string;
    verified: boolean;
  }>;
  createdAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  user?: PrivyUser;
  error?: string;
}

export class PrivyAuthService {
  private static instance: PrivyAuthService;
  
  static getInstance() {
    if (!this.instance) {
      this.instance = new PrivyAuthService();
    }
    return this.instance;
  }
  
  private constructor() {}
  
  /**
   * 서버에서 안전하게 사용 가능한 JWT 토큰 검증
   */
  validateToken(token: string): ValidationResult {
    if (!token) {
      return { isValid: false, error: 'No token provided' };
    }
    
    try {
      // Remove Bearer prefix if present
      const cleanToken = token.replace('Bearer ', '');
      
      // Development mode bypass
      if (process.env.NODE_ENV === 'development' && cleanToken === 'dev-token') {
        return {
          isValid: true,
          user: {
            id: 'dev-user-id',
            email: {
              address: 'dev@p2pfiat.com',
              verified: true,
            },
            createdAt: new Date().toISOString(),
          },
        };
      }
      
      // JWT 검증
      const verificationKey = process.env.PRIVY_VERIFICATION_KEY;
      if (!verificationKey) {
        return { isValid: false, error: 'Privy verification key not configured' };
      }
      
      const decoded = jwt.verify(cleanToken, verificationKey) as any;
      
      if (!decoded || !decoded.sub) {
        return { isValid: false, error: 'Invalid token payload' };
      }
      
      // Create user object from token
      const user: PrivyUser = {
        id: decoded.sub,
        email: decoded.email ? {
          address: decoded.email,
          verified: decoded.email_verified || false,
        } : undefined,
        wallets: decoded.wallets || [],
        createdAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
      };
      
      return { isValid: true, user };
      
    } catch (error) {
      console.error('Token validation failed:', error);
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Token validation failed' 
      };
    }
  }
  
  /**
   * 서버 사이드에서 안전한 사용자 정보 조회
   */
  async getUserFromToken(token: string): Promise<PrivyUser | null> {
    const validation = this.validateToken(token);
    
    if (!validation.isValid || !validation.user) {
      return null;
    }
    
    // Additional server-side user info retrieval if needed
    try {
      // Privy API 호출 (필요시)
      if (process.env.PRIVY_APP_SECRET && process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
        const response = await fetch('https://api.privy.io/api/v1/users/me', {
          headers: {
            'Authorization': `Bearer ${token.replace('Bearer ', '')}`,
            'privy-app-id': process.env.NEXT_PUBLIC_PRIVY_APP_ID,
          },
        });
        
        if (response.ok) {
          const privyUser = await response.json();
          return {
            id: privyUser.id,
            email: privyUser.email,
            wallets: privyUser.wallets,
            createdAt: privyUser.created_at,
          };
        }
      }
      
      // Fallback to token data
      return validation.user;
      
    } catch (error) {
      console.error('Failed to fetch user from Privy API:', error);
      return validation.user;
    }
  }
  
  /**
   * 관리자 권한 확인
   */
  isAdmin(user: PrivyUser): boolean {
    const adminEmails = [
      'admin@p2pfiat.com',
      'dev@p2pfiat.com',
    ];
    
    return user.email ? adminEmails.includes(user.email.address) : false;
  }
  
  /**
   * 이메일 인증 여부 확인
   */
  isEmailVerified(user: PrivyUser): boolean {
    return user.email ? user.email.verified : false;
  }
  
  /**
   * 지갑 연결 여부 확인
   */
  hasConnectedWallet(user: PrivyUser): boolean {
    return user.wallets ? user.wallets.length > 0 : false;
  }
  
  /**
   * 사용자의 주요 지갑 주소 가져오기
   */
  getPrimaryWalletAddress(user: PrivyUser): string | null {
    if (!user.wallets || user.wallets.length === 0) {
      return null;
    }
    
    // 검증된 지갑 우선
    const verifiedWallet = user.wallets.find(wallet => wallet.verified);
    if (verifiedWallet) {
      return verifiedWallet.address;
    }
    
    // 첫 번째 지갑 반환
    return user.wallets[0].address;
  }
  
  /**
   * 토큰 만료 시간 확인
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const cleanToken = token.replace('Bearer ', '');
      const decoded = jwt.decode(cleanToken) as any;
      
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * 토큰이 만료되었는지 확인
   */
  isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    
    if (!expiration) {
      return true; // 만료 시간을 알 수 없으면 만료로 간주
    }
    
    return expiration.getTime() < Date.now();
  }
}