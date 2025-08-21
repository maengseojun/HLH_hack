import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { redisPubSub } from '../redis/client';
import { REDIS_KEYS } from '../types/orderbook';
// import { verifyPrivyAuth } from '../middleware/privy-auth'; // Currently not used

export interface WSClient {
  ws: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastPing: number;
}

export class HyperIndexWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, WSClient> = new Map();
  private subscriptions: Map<string, Set<WebSocket>> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/trading'
    });

    this.initialize();
  }

  private initialize() {
    // WebSocket 연결 처리
    this.wss.on('connection', async (ws: WebSocket, _request: IncomingMessage) => {
      console.log('🔌 New WebSocket connection');
      
      // 클라이언트 등록
      const client: WSClient = {
        ws,
        subscriptions: new Set(),
        lastPing: Date.now()
      };
      
      this.clients.set(ws, client);

      // 연결 확인 메시지
      this.sendMessage(ws, {
        type: 'connection',
        data: { status: 'connected', timestamp: Date.now() }
      });

      // 메시지 처리
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (_error) {
          console.error('WebSocket message error:', _error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      // 연결 종료 처리
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });

      // 에러 처리
      ws.on('error', (error) => {
        console.error('WebSocket error:', _error);
        this.handleDisconnection(ws);
      });
    });

    // Redis Pub/Sub 구독 시작
    this.startRedisSubscriptions();

    // Keep-alive 핑 시작
    this.startKeepAlive();
  }

  /**
   * 클라이언트 메시지 처리
   */
  private async handleMessage(ws: WebSocket, message: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'auth':
        await this.handleAuth(ws, message.token);
        break;

      case 'subscribe':
        await this.handleSubscribe(ws, message.channels);
        break;

      case 'unsubscribe':
        await this.handleUnsubscribe(ws, message.channels);
        break;

      case 'ping':
        client.lastPing = Date.now();
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * 사용자 인증 처리
   */
  private async handleAuth(ws: WebSocket, token: string) {
    try {
      // Privy JWT 토큰 검증 (실제 구현에서는 더 정교한 검증 필요)
      // 여기서는 간단히 토큰 파싱만 수행
      const client = this.clients.get(ws);
      if (!client) return;

      // TODO: 실제 토큰 검증 로직 구현
      const userId = this.extractUserIdFromToken(token);
      
      if (userId) {
        client.userId = userId;
        this.sendMessage(ws, {
          type: 'auth_success',
          data: { userId, timestamp: Date.now() }
        });

        // 사용자별 채널 자동 구독
        const userChannel = REDIS_KEYS.CHANNELS.ORDERS(userId);
        await this.subscribeToChannel(ws, userChannel);
      } else {
        this.sendError(ws, 'Invalid authentication token');
      }
    } catch (_error) {
      console.error('Auth error:', _error);
      this.sendError(ws, 'Authentication failed');
    }
  }

  /**
   * 채널 구독 처리
   */
  private async handleSubscribe(ws: WebSocket, channels: string[]) {
    const client = this.clients.get(ws);
    if (!client) return;

    const subscribedChannels: string[] = [];

    for (const channel of channels) {
      if (this.isValidChannel(channel)) {
        await this.subscribeToChannel(ws, channel);
        subscribedChannels.push(channel);
      }
    }

    this.sendMessage(ws, {
      type: 'subscribed',
      data: { channels: subscribedChannels, timestamp: Date.now() }
    });
  }

  /**
   * 채널 구독 해제
   */
  private async handleUnsubscribe(ws: WebSocket, channels: string[]) {
    const client = this.clients.get(ws);
    if (!client) return;

    const unsubscribedChannels: string[] = [];

    for (const channel of channels) {
      this.unsubscribeFromChannel(ws, channel);
      unsubscribedChannels.push(channel);
    }

    this.sendMessage(ws, {
      type: 'unsubscribed',
      data: { channels: unsubscribedChannels, timestamp: Date.now() }
    });
  }

  /**
   * 특정 채널에 구독
   */
  private async subscribeToChannel(ws: WebSocket, channel: string) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.subscriptions.add(channel);

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    
    this.subscriptions.get(channel)!.add(ws);
  }

  /**
   * 채널 구독 해제
   */
  private unsubscribeFromChannel(ws: WebSocket, channel: string) {
    const client = this.clients.get(ws);
    if (!client) return;

    client.subscriptions.delete(channel);

    const channelSubscribers = this.subscriptions.get(channel);
    if (channelSubscribers) {
      channelSubscribers.delete(ws);
      
      // 구독자가 없으면 채널 정리
      if (channelSubscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  /**
   * Redis Pub/Sub 구독 시작
   */
  private startRedisSubscriptions() {
    // 오더북 업데이트 구독
    redisPubSub.psubscribe('orderbook:*', (err, count) => {
      if (err) {
        console.error('Redis subscription error:', err);
        return;
      }
      console.log(`📡 Subscribed to ${count} Redis patterns`);
    });

    // 거래 업데이트 구독
    redisPubSub.psubscribe('trades:*');
    
    // 사용자별 주문 업데이트 구독
    redisPubSub.psubscribe('orders:*');

    // Redis 메시지 처리
    redisPubSub.on('pmessage', (pattern: string, channel: string, message: string) => {
      this.broadcastToChannel(channel, JSON.parse(message));
    });
  }

  /**
   * 특정 채널의 모든 구독자에게 메시지 브로드캐스트
   */
  private broadcastToChannel(channel: string, data: any) {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) return;

    const message = {
      type: 'update',
      channel,
      data,
      timestamp: Date.now()
    };

    const messageStr = JSON.stringify(message);

    subscribers.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    });
  }

  /**
   * 특정 클라이언트에게 메시지 전송
   */
  private sendMessage(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 에러 메시지 전송
   */
  private sendError(ws: WebSocket, error: string) {
    this.sendMessage(ws, {
      type: 'error',
      data: { error, timestamp: Date.now() }
    });
  }

  /**
   * 연결 해제 처리
   */
  private handleDisconnection(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (!client) return;

    console.log(`🔌 WebSocket disconnected: ${client.userId || 'anonymous'}`);

    // 모든 구독 해제
    client.subscriptions.forEach(channel => {
      this.unsubscribeFromChannel(ws, channel);
    });

    // 클라이언트 제거
    this.clients.delete(ws);
  }

  /**
   * Keep-alive 핑 시작
   */
  private startKeepAlive() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60초

      this.clients.forEach((client, ws) => {
        if (now - client.lastPing > timeout) {
          console.log('🔌 WebSocket timeout, closing connection');
          ws.terminate();
        } else if (ws.readyState === WebSocket.OPEN) {
          // 핑 전송
          this.sendMessage(ws, { type: 'ping', timestamp: now });
        }
      });
    }, 30000); // 30초마다 체크
  }

  /**
   * 유효한 채널인지 확인
   */
  private isValidChannel(channel: string): boolean {
    const validPatterns = [
      /^orderbook:[A-Z]+-[A-Z]+$/,  // orderbook:HYPERINDEX-USDC
      /^trades:[A-Z]+-[A-Z]+$/,     // trades:HYPERINDEX-USDC
      /^orders:.+$/                  // orders:user_id
    ];

    return validPatterns.some(pattern => pattern.test(channel));
  }

  /**
   * 토큰에서 사용자 ID 추출 (간단한 구현)
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      // 실제로는 Privy JWT 검증 로직 사용
      // 여기서는 개발용 간단한 구현
      if (token === 'dev-token') {
        return '550e8400-e29b-41d4-a716-446655440000';
      }
      
      // JWT 디코딩 (실제로는 검증도 필요)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.sub || payload.userId;
    } catch (_error) {
      return null;
    }
  }

  /**
   * 연결된 클라이언트 수 조회
   */
  getConnectedClients(): number {
    return this.clients.size;
  }

  /**
   * 특정 채널의 구독자 수 조회
   */
  getChannelSubscribers(channel: string): number {
    return this.subscriptions.get(channel)?.size || 0;
  }
}