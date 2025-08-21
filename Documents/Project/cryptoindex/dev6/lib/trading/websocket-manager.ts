// lib/trading/websocket-manager.ts
/**
 * WebSocket Manager for Real-time Trading Updates
 * Provides real-time updates for prices, orders, balances, and portfolio
 */

interface WebSocketMessage {
  type: 'price_update' | 'order_update' | 'balance_update' | 'portfolio_update' | 'trade_executed';
  data: any;
  timestamp: number;
  userId?: string;
  tokenAddress?: string;
}

interface SubscriptionFilter {
  userId?: string;
  tokenAddress?: string;
  type: string[];
}

interface WebSocketConnection {
  id: string;
  userId: string;
  socket: any; // WebSocket instance
  subscriptions: SubscriptionFilter[];
  lastPing: number;
  isActive: boolean;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private connections: Map<string, WebSocketConnection> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // type -> connectionIds
  private heartbeatInterval: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    this.startHeartbeat();
  }

  static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Add WebSocket connection
   */
  addConnection(connectionId: string, userId: string, socket: any): void {
    const connection: WebSocketConnection = {
      id: connectionId,
      userId,
      socket,
      subscriptions: [],
      lastPing: Date.now(),
      isActive: true
    };

    this.connections.set(connectionId, connection);
    console.log(`✅ WebSocket connected: ${connectionId} (user: ${userId})`);

    // Set up socket event handlers
    socket.on('message', (message: string) => {
      this.handleMessage(connectionId, message);
    });

    socket.on('close', () => {
      this.removeConnection(connectionId);
    });

    socket.on('error', (error: Error) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, _error);
      this.removeConnection(connectionId);
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connection_established',
      data: { connectionId, userId },
      timestamp: Date.now()
    });
  }

  /**
   * Remove WebSocket connection
   */
  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Remove from all subscriptions
      for (const [type, connectionIds] of this.subscriptions.entries()) {
        connectionIds.delete(connectionId);
        if (connectionIds.size === 0) {
          this.subscriptions.delete(type);
        }
      }

      this.connections.delete(connectionId);
      console.log(`🔌 WebSocket disconnected: ${connectionId}`);
    }
  }

  /**
   * Subscribe to updates
   */
  subscribe(
    connectionId: string,
    filter: SubscriptionFilter
  ): { success: boolean; error?: string } {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    // Add subscription to connection
    connection.subscriptions.push(filter);

    // Add to global subscription map
    for (const type of filter.type) {
      if (!this.subscriptions.has(type)) {
        this.subscriptions.set(type, new Set());
      }
      this.subscriptions.get(type)!.add(connectionId);
    }

    console.log(`📡 Subscription added: ${connectionId} -> ${filter.type.join(', ')}`);
    return { success: true };
  }

  /**
   * Unsubscribe from updates
   */
  unsubscribe(
    connectionId: string,
    types: string[]
  ): { success: boolean; error?: string } {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    // Remove from connection subscriptions
    connection.subscriptions = connection.subscriptions.filter(
      sub => !types.some(type => sub.type.includes(type))
    );

    // Remove from global subscription map
    for (const type of types) {
      const connectionIds = this.subscriptions.get(type);
      if (connectionIds) {
        connectionIds.delete(connectionId);
        if (connectionIds.size === 0) {
          this.subscriptions.delete(type);
        }
      }
    }

    console.log(`📡 Unsubscribed: ${connectionId} from ${types.join(', ')}`);
    return { success: true };
  }

  /**
   * Broadcast price update
   */
  broadcastPriceUpdate(tokenAddress: string, price: string, change24h?: string): void {
    const message: WebSocketMessage = {
      type: 'price_update',
      data: {
        tokenAddress,
        price,
        change24h,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      tokenAddress
    };

    this.broadcast('price_update', message, { tokenAddress });
  }

  /**
   * Broadcast order update
   */
  broadcastOrderUpdate(userId: string, orderData: any): void {
    const message: WebSocketMessage = {
      type: 'order_update',
      data: {
        order: orderData,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      userId,
      tokenAddress: orderData.tokenAddress
    };

    this.broadcast('order_update', message, { userId });
  }

  /**
   * Broadcast balance update
   */
  broadcastBalanceUpdate(userId: string, tokenAddress: string, balanceData: any): void {
    const message: WebSocketMessage = {
      type: 'balance_update',
      data: {
        tokenAddress,
        balance: balanceData,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      userId,
      tokenAddress
    };

    this.broadcast('balance_update', message, { userId, tokenAddress });
  }

  /**
   * Broadcast portfolio update
   */
  broadcastPortfolioUpdate(userId: string, portfolioData: any): void {
    const message: WebSocketMessage = {
      type: 'portfolio_update',
      data: {
        portfolio: portfolioData,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      userId
    };

    this.broadcast('portfolio_update', message, { userId });
  }

  /**
   * Broadcast trade executed
   */
  broadcastTradeExecuted(tokenAddress: string, tradeData: any): void {
    const message: WebSocketMessage = {
      type: 'trade_executed',
      data: {
        trade: tradeData,
        timestamp: Date.now()
      },
      timestamp: Date.now(),
      tokenAddress
    };

    this.broadcast('trade_executed', message, { tokenAddress });
  }

  /**
   * Get connection stats
   */
  getConnectionStats(): {
    totalConnections: number;
    activeConnections: number;
    subscriptionTypes: string[];
    connectionsPerType: Record<string, number>;
  } {
    const activeConnections = Array.from(this.connections.values()).filter(conn => conn.isActive);
    
    const connectionsPerType: Record<string, number> = {};
    for (const [type, connectionIds] of this.subscriptions.entries()) {
      connectionsPerType[type] = connectionIds.size;
    }

    return {
      totalConnections: this.connections.size,
      activeConnections: activeConnections.length,
      subscriptionTypes: Array.from(this.subscriptions.keys()),
      connectionsPerType
    };
  }

  /**
   * Close all connections
   */
  closeAllConnections(): void {
    for (const connection of this.connections.values()) {
      try {
        connection.socket.close();
      } catch (_error) {
        // Ignore close errors
      }
    }
    
    this.connections.clear();
    this.subscriptions.clear();
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Private: Broadcast message to subscribers
   */
  private broadcast(
    type: string,
    message: WebSocketMessage,
    filter?: { userId?: string; tokenAddress?: string }
  ): void {
    const connectionIds = this.subscriptions.get(type);
    if (!connectionIds || connectionIds.size === 0) {
      return;
    }

    let sentCount = 0;
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (!connection || !connection.isActive) {
        continue;
      }

      // Check if message matches connection's subscription filters
      const shouldSend = connection.subscriptions.some(sub => {
        if (!sub.type.includes(type)) return false;
        
        if (filter?.userId && sub.userId && sub.userId !== filter.userId) {
          return false;
        }
        
        if (filter?.tokenAddress && sub.tokenAddress && sub.tokenAddress !== filter.tokenAddress) {
          return false;
        }
        
        return true;
      });

      if (shouldSend) {
        this.sendToConnection(connectionId, message);
        sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`📤 Broadcasted ${type} to ${sentCount} connections`);
    }
  }

  /**
   * Private: Send message to specific connection
   */
  private sendToConnection(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isActive) {
      return;
    }

    try {
      connection.socket.send(JSON.stringify(message));
    } catch (_error) {
      console.error(`❌ Failed to send message to ${connectionId}:`, _error);
      this.removeConnection(connectionId);
    }
  }

  /**
   * Private: Handle incoming message
   */
  private handleMessage(connectionId: string, rawMessage: string): void {
    try {
      const message = JSON.parse(rawMessage);
      
      switch (message.type) {
        case 'ping':
          this.handlePing(connectionId);
          break;
          
        case 'subscribe': {
          const subResult = this.subscribe(connectionId, message.data);
          this.sendToConnection(connectionId, {
            type: 'subscription_response',
            data: subResult,
            timestamp: Date.now()
          });
          break;
        }
          
        case 'unsubscribe': {
          const unsubResult = this.unsubscribe(connectionId, message.data.types);
          this.sendToConnection(connectionId, {
            type: 'unsubscription_response',
            data: unsubResult,
            timestamp: Date.now()
          });
          break;
        }
          
        default:
          console.warn(`⚠️ Unknown message type: ${message.type}`);
      }
    } catch (_error) {
      console.error(`❌ Failed to parse message from ${connectionId}:`, _error);
    }
  }

  /**
   * Private: Handle ping message
   */
  private handlePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = Date.now();
      this.sendToConnection(connectionId, {
        type: 'pong',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Private: Start heartbeat to check connection health
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleThreshold = 60000; // 1 minute

      for (const [connectionId, connection] of this.connections.entries()) {
        if (now - connection.lastPing > staleThreshold) {
          console.log(`💔 Removing stale connection: ${connectionId}`);
          this.removeConnection(connectionId);
        }
      }
    }, 30000); // Check every 30 seconds
  }
}

export default WebSocketManager;