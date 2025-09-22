import { createRemoteJWKSet, jwtVerify } from 'jose';

interface PrivyJWTPayload {
  iat: number;
  exp: number;
  aud: string;
  iss: string;
  sub: string;
  sid: string;
  [key: string]: any;
}

interface VerificationResult {
  isValid: boolean;
  payload?: PrivyJWTPayload;
  error?: string;
}

class PrivyJWTVerifier {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private issuer: string;
  private audience: string;

  constructor() {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    if (!appId) {
      throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is required');
    }

    this.issuer = 'privy.io';
    this.audience = appId;
    this.jwks = createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks`)
    );
  }

  async verifyToken(token: string): Promise<VerificationResult> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });

      return {
        isValid: true,
        payload: payload as PrivyJWTPayload,
      };
    } catch (error) {
      console.error('JWT verification failed:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  extractUserIdFromToken(token: string): string | null {
    try {
      // Simple base64 decode of JWT payload (without verification)
      const [, payload] = token.split('.');
      const decoded = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf-8')
      );
      return decoded.sub || null;
    } catch {
      return null;
    }
  }
}

// Singleton instance
let verifierInstance: PrivyJWTVerifier | null = null;

export function getPrivyJWTVerifier(): PrivyJWTVerifier {
  if (!verifierInstance) {
    verifierInstance = new PrivyJWTVerifier();
  }
  return verifierInstance;
}

export async function verifyPrivyToken(token: string): Promise<VerificationResult> {
  const verifier = getPrivyJWTVerifier();
  return verifier.verifyToken(token);
}

export function extractPrivyUserId(token: string): string | null {
  const verifier = getPrivyJWTVerifier();
  return verifier.extractUserIdFromToken(token);
}