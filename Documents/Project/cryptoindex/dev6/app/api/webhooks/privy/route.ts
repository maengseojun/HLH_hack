// app/api/webhooks/privy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { handlePrivyWebhook } from '@/lib/security/privy-events';
import { auditLogger } from '@/lib/security/audit-logger';
import crypto from 'crypto';

/**
 * POST /api/webhooks/privy
 * Handle Privy webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('privy-signature');
    const timestamp = request.headers.get('privy-timestamp');

    // Verify webhook signature
    if (!verifyPrivyWebhookSignature(body, signature, timestamp)) {
      console.error('❌ Invalid Privy webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const webhookEvent = JSON.parse(body);

    // Log webhook receipt
    await auditLogger.logSystem({
      action: 'privy_webhook_received',
      severity: 'info',
      outcome: 'success',
      additionalData: {
        eventType: webhookEvent.event_type,
        eventId: webhookEvent.id,
        appId: webhookEvent.app_id
      }
    });

    // Process the webhook event
    await handlePrivyWebhook(webhookEvent);

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    });

  } catch (_error) {
    console.error('❌ Privy webhook processing error:', _error);

    // Log webhook processing error
    await auditLogger.logSystem({
      action: 'privy_webhook_error',
      severity: 'error',
      outcome: 'failure',
      errorMessage: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Verify Privy webhook signature
 */
function verifyPrivyWebhookSignature(
  payload: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  try {
    if (!signature || !timestamp) {
      return false;
    }

    // In development, skip signature verification
    if (process.env.NODE_ENV === 'development') {
      console.log('🚧 Development mode: skipping webhook signature verification');
      return true;
    }

    const webhookSecret = process.env.PRIVY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('❌ PRIVY_WEBHOOK_SECRET not configured');
      return false;
    }

    // Check timestamp to prevent replay attacks (should be within 5 minutes)
    const timestampNumber = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDifference = Math.abs(currentTime - timestampNumber);

    if (timeDifference > 300) { // 5 minutes
      console.error('❌ Webhook timestamp too old');
      return false;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const actualSignature = signature.replace('v1=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex')
    );

  } catch (_error) {
    console.error('❌ Webhook signature verification failed:', _error);
    return false;
  }
}

/**
 * GET /api/webhooks/privy
 * Webhook endpoint verification for Privy
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');

  if (challenge) {
    // Respond to Privy's webhook verification challenge
    return NextResponse.json({ challenge });
  }

  return NextResponse.json({
    success: true,
    message: 'Privy webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}