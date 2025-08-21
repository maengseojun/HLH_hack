// lib/monitoring/security-monitor.ts
import { createClient } from '@supabase/supabase-js';
import { auditLogger } from '../security/audit-logger';
import { FraudDetectionService } from '../security/fraud-detection';

interface SecurityMetrics {
  timestamp: Date;
  activeUsers: number;
  failedLogins: number;
  suspiciousTransactions: number;
  blockedIPs: number;
  criticalAlerts: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  fraudScore: number;
  responseTime: number;
}

interface SecurityAlert {
  id: string;
  type: 'fraud' | 'intrusion' | 'abuse' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  userId?: string;
  ipAddress?: string;
  metadata: any;
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

interface RealTimeEvent {
  eventId: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  location?: {
    country: string;
    city: string;
    lat: number;
    lon: number;
  };
  details: any;
  timestamp: Date;
}

interface DashboardData {
  metrics: SecurityMetrics;
  alerts: SecurityAlert[];
  recentEvents: RealTimeEvent[];
  threatIntelligence: {
    maliciousIPs: string[];
    suspiciousCountries: string[];
    attackPatterns: string[];
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    lastHealthCheck: Date;
  };
}

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private supabase;
  private fraudDetection: FraudDetectionService;
  private isMonitoring = false;
  private monitoringInterval?: NodeJS.Timeout;
  private websocketConnections: Set<any> = new Set();
  
  // Thresholds for alerting
  private readonly ALERT_THRESHOLDS = {
    failedLoginsPerMinute: 50,
    suspiciousTransactionsPerHour: 20,
    fraudScoreThreshold: 80,
    responseTimeThreshold: 5000, // 5 seconds
    criticalEventsPerHour: 10
  };

  // Rate limiting windows
  private readonly RATE_LIMITS = {
    loginAttempts: { window: 900000, limit: 5 },      // 15 minutes, 5 attempts
    transactionRequests: { window: 3600000, limit: 100 }, // 1 hour, 100 requests
    apiCalls: { window: 60000, limit: 1000 }         // 1 minute, 1000 calls
  };

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.fraudDetection = FraudDetectionService.getInstance();
  }

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Start real-time security monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      console.log('⚠️ Security monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting security monitoring...');

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.runMonitoringCycle().catch(error => {
        console.error('❌ Monitoring cycle failed:', _error);
      });
    }, 30000); // Every 30 seconds

    // Set up real-time event listeners
    this.setupRealtimeListeners();

    // Run initial monitoring
    this.runMonitoringCycle().catch(error => {
      console.error('❌ Initial monitoring failed:', _error);
    });

    console.log('✅ Security monitoring started');
  }

  /**
   * Stop security monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ Security monitoring is not running');
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    console.log('⏹️ Security monitoring stopped');
  }

  /**
   * Get current dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    try {
      const [metrics, alerts, events, threatIntel, systemHealth] = await Promise.all([
        this.getCurrentMetrics(),
        this.getActiveAlerts(),
        this.getRecentEvents(),
        this.getThreatIntelligence(),
        this.getSystemHealthStatus()
      ]);

      return {
        metrics,
        alerts,
        recentEvents: events,
        threatIntelligence: threatIntel,
        systemHealth
      };
    } catch (_error) {
      console.error('❌ Failed to get dashboard data:', _error);
      throw _error;
    }
  }

  /**
   * Create security alert
   */
  async createAlert(alert: Omit<SecurityAlert, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
    try {
      const alertId = crypto.randomUUID();
      const now = new Date();

      const { error } = await this.supabase
        .from('security_incidents')
        .insert({
          id: alertId,
          user_id: alert.userId,
          incident_type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          evidence: {
            ipAddress: alert.ipAddress,
            ...alert.metadata
          },
          status: 'open',
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        });

      if (error) {
        throw new Error(`Failed to create alert: ${(_error as Error)?.message || String(_error)}`);
      }

      // Log the alert creation
      await auditLogger.logSecurity({
        action: 'alert_created',
        severity: alert.severity,
        outcome: 'success',
        userId: alert.userId,
        ipAddress: alert.ipAddress,
        additionalData: {
          alertId,
          alertType: alert.type,
          title: alert.title
        }
      });

      // Broadcast to connected clients
      this.broadcastEvent({
        eventId: crypto.randomUUID(),
        eventType: 'security_alert_created',
        severity: alert.severity,
        userId: alert.userId,
        ipAddress: alert.ipAddress,
        details: alert,
        timestamp: now
      });

      console.log(`🚨 Security alert created: ${alertId} (${alert.severity})`);
      return alertId;
    } catch (_error) {
      console.error('❌ Failed to create security alert:', _error);
      throw _error;
    }
  }

  /**
   * Check rate limits for user/IP
   */
  async checkRateLimit(
    key: string,
    limitType: keyof typeof this.RATE_LIMITS,
    userId?: string,
    ipAddress?: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
    try {
      const limit = this.RATE_LIMITS[limitType];
      const windowStart = new Date(Date.now() - limit.window);
      const resetTime = new Date(Date.now() + limit.window);

      // Get current count
      const { data: currentRecord, error } = await this.supabase
        .from('rate_limiting')
        .select('*')
        .eq('rate_limit_key', key)
        .eq('rate_limit_type', limitType)
        .gte('window_start', windowStart.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error is OK
        throw new Error(`Rate limit check failed: ${(_error as Error)?.message || String(_error)}`);
      }

      if (!currentRecord) {
        // First request in window
        await this.supabase
          .from('rate_limiting')
          .insert({
            rate_limit_key: key,
            rate_limit_type: limitType,
            request_count: 1,
            max_requests: limit.limit,
            window_start: windowStart.toISOString(),
            window_duration_seconds: limit.window / 1000,
            ip_address: ipAddress,
            expires_at: resetTime.toISOString()
          });

        return {
          allowed: true,
          remaining: limit.limit - 1,
          resetTime
        };
      }

      // Check if limit exceeded
      if (currentRecord.request_count >= limit.limit) {
        // Log rate limit exceeded
        await auditLogger.logSecurity({
          action: 'rate_limit_exceeded',
          severity: 'warning',
          outcome: 'success',
          userId,
          ipAddress,
          additionalData: {
            limitType,
            requestCount: currentRecord.request_count,
            maxRequests: limit.limit
          }
        });

        return {
          allowed: false,
          remaining: 0,
          resetTime
        };
      }

      // Increment counter
      await this.supabase
        .from('rate_limiting')
        .update({
          request_count: currentRecord.request_count + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentRecord.id);

      return {
        allowed: true,
        remaining: limit.limit - currentRecord.request_count - 1,
        resetTime
      };
    } catch (_error) {
      console.error('❌ Rate limit check failed:', _error);
      // Fail open - allow request but log error
      return {
        allowed: true,
        remaining: 0,
        resetTime: new Date()
      };
    }
  }

  /**
   * Analyze real-time transaction for security threats
   */
  async analyzeTransactionSecurity(
    userId: string,
    transactionData: any,
    ipAddress: string,
    userAgent: string
  ): Promise<{
    allowed: boolean;
    riskScore: number;
    alerts: string[];
    requiresReview: boolean;
  }> {
    try {
      // Run fraud detection
      const fraudAnalysis = await this.fraudDetection.analyzeTransaction(userId, {
        ...transactionData,
        ipAddress,
        userAgent
      });

      const alerts: string[] = [];
      let requiresReview = false;

      // Check for high-risk patterns
      if (fraudAnalysis.riskScore >= this.ALERT_THRESHOLDS.fraudScoreThreshold) {
        alerts.push('High fraud risk detected');
        requiresReview = true;

        // Create security alert
        await this.createAlert({
          type: 'fraud',
          severity: fraudAnalysis.riskScore >= 95 ? 'critical' : 'high',
          title: 'High-risk transaction detected',
          description: `Transaction flagged with risk score: ${fraudAnalysis.riskScore}`,
          userId,
          ipAddress,
          metadata: {
            transactionData,
            fraudAnalysis,
            riskFactors: fraudAnalysis.riskFactors
          }
        });
      }

      // Check transaction velocity
      const velocityCheck = await this.checkTransactionVelocity(userId);
      if (velocityCheck.suspicious) {
        alerts.push('Suspicious transaction velocity');
        requiresReview = true;
      }

      // Check IP reputation
      const ipReputation = await this.checkIpReputation(ipAddress);
      if (ipReputation.malicious) {
        alerts.push('Transaction from malicious IP');
        requiresReview = true;
        
        await this.createAlert({
          type: 'intrusion',
          severity: 'high',
          title: 'Transaction from malicious IP',
          description: `Transaction attempted from known malicious IP: ${ipAddress}`,
          userId,
          ipAddress,
          metadata: {
            ipReputation,
            transactionData
          }
        });
      }

      // Log security analysis
      await auditLogger.logSecurity({
        action: 'transaction_security_analysis',
        severity: requiresReview ? 'warning' : 'info',
        outcome: 'success',
        userId,
        ipAddress,
        riskScore: fraudAnalysis.riskScore,
        riskFactors: fraudAnalysis.riskFactors,
        additionalData: {
          allowed: fraudAnalysis.recommendation !== 'block',
          requiresReview,
          alerts
        }
      });

      return {
        allowed: fraudAnalysis.recommendation !== 'block',
        riskScore: fraudAnalysis.riskScore,
        alerts,
        requiresReview
      };
    } catch (_error) {
      console.error('❌ Transaction security analysis failed:', _error);
      
      // Fail safely - allow transaction but flag for review
      return {
        allowed: true,
        riskScore: 50,
        alerts: ['Security analysis failed - manual review required'],
        requiresReview: true
      };
    }
  }

  /**
   * Run monitoring cycle
   */
  private async runMonitoringCycle(): Promise<void> {
    try {
      // Get current metrics
      const metrics = await this.getCurrentMetrics();
      
      // Check for threshold violations
      await this.checkThresholds(metrics);
      
      // Clean up expired data
      await this.cleanupExpiredData();
      
      // Update threat intelligence
      await this.updateThreatIntelligence();
      
      // Broadcast metrics to connected clients
      this.broadcastEvent({
        eventId: crypto.randomUUID(),
        eventType: 'metrics_update',
        severity: 'low',
        details: metrics,
        timestamp: new Date()
      });
      
    } catch (_error) {
      console.error('❌ Monitoring cycle failed:', _error);
    }
  }

  /**
   * Get current security metrics
   */
  private async getCurrentMetrics(): Promise<SecurityMetrics> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      const [
        activeUsersResult,
        failedLoginsResult,
        suspiciousTransactionsResult,
        criticalAlertsResult,
        systemHealthResult
      ] = await Promise.all([
        this.getActiveUsersCount(),
        this.getFailedLoginsCount(oneMinuteAgo),
        this.getSuspiciousTransactionsCount(oneHourAgo),
        this.getCriticalAlertsCount(oneHourAgo),
        this.getSystemHealth()
      ]);

      return {
        timestamp: now,
        activeUsers: activeUsersResult,
        failedLogins: failedLoginsResult,
        suspiciousTransactions: suspiciousTransactionsResult,
        blockedIPs: await this.getBlockedIPsCount(),
        criticalAlerts: criticalAlertsResult,
        systemHealth: systemHealthResult.status,
        fraudScore: await this.getAverageFraudScore(),
        responseTime: systemHealthResult.responseTime
      };
    } catch (_error) {
      console.error('❌ Failed to get current metrics:', _error);
      return {
        timestamp: new Date(),
        activeUsers: 0,
        failedLogins: 0,
        suspiciousTransactions: 0,
        blockedIPs: 0,
        criticalAlerts: 0,
        systemHealth: 'critical',
        fraudScore: 0,
        responseTime: 0
      };
    }
  }

  /**
   * Check thresholds and create alerts
   */
  private async checkThresholds(metrics: SecurityMetrics): Promise<void> {
    // Check failed logins threshold
    if (metrics.failedLogins > this.ALERT_THRESHOLDS.failedLoginsPerMinute) {
      await this.createAlert({
        type: 'abuse',
        severity: 'high',
        title: 'High number of failed logins',
        description: `${metrics.failedLogins} failed logins detected in the last minute`,
        metadata: {
          failedLogins: metrics.failedLogins,
          threshold: this.ALERT_THRESHOLDS.failedLoginsPerMinute
        }
      });
    }

    // Check suspicious transactions threshold
    if (metrics.suspiciousTransactions > this.ALERT_THRESHOLDS.suspiciousTransactionsPerHour) {
      await this.createAlert({
        type: 'fraud',
        severity: 'medium',
        title: 'High number of suspicious transactions',
        description: `${metrics.suspiciousTransactions} suspicious transactions detected in the last hour`,
        metadata: {
          suspiciousTransactions: metrics.suspiciousTransactions,
          threshold: this.ALERT_THRESHOLDS.suspiciousTransactionsPerHour
        }
      });
    }

    // Check system health
    if (metrics.systemHealth === 'critical') {
      await this.createAlert({
        type: 'system',
        severity: 'critical',
        title: 'System health critical',
        description: 'System health has degraded to critical level',
        metadata: {
          systemHealth: metrics.systemHealth,
          responseTime: metrics.responseTime
        }
      });
    }
  }

  // Helper methods for metrics collection
  private async getActiveUsersCount(): Promise<number> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const { count } = await this.supabase
      .from('security_audit_log')
      .select('user_id', { count: 'exact' })
      .gte('created_at', fifteenMinutesAgo.toISOString())
      .not('user_id', 'is', null);

    return count || 0;
  }

  private async getFailedLoginsCount(since: Date): Promise<number> {
    const { count } = await this.supabase
      .from('security_audit_log')
      .select('*', { count: 'exact' })
      .eq('event_category', 'authentication')
      .eq('outcome', 'failure')
      .gte('created_at', since.toISOString());

    return count || 0;
  }

  private async getSuspiciousTransactionsCount(since: Date): Promise<number> {
    const { count } = await this.supabase
      .from('fraud_analysis_logs')
      .select('*', { count: 'exact' })
      .gte('risk_score', 70)
      .gte('created_at', since.toISOString());

    return count || 0;
  }

  private async getCriticalAlertsCount(since: Date): Promise<number> {
    const { count } = await this.supabase
      .from('security_incidents')
      .select('*', { count: 'exact' })
      .eq('severity', 'critical')
      .eq('status', 'open')
      .gte('created_at', since.toISOString());

    return count || 0;
  }

  private async getBlockedIPsCount(): Promise<number> {
    const { count } = await this.supabase
      .from('ip_address_tracking')
      .select('*', { count: 'exact' })
      .eq('is_malicious', true);

    return count || 0;
  }

  private async getSystemHealth(): Promise<{ status: 'healthy' | 'degraded' | 'critical'; responseTime: number }> {
    const startTime = Date.now();
    
    try {
      // Test database connectivity
      await this.supabase.from('users').select('id').limit(1);
      const responseTime = Date.now() - startTime;
      
      let status: 'healthy' | 'degraded' | 'critical';
      if (responseTime < 1000) {
        status = 'healthy';
      } else if (responseTime < 3000) {
        status = 'degraded';
      } else {
        status = 'critical';
      }
      
      return { status, responseTime };
    } catch (_error) {
      return { status: 'critical', responseTime: Date.now() - startTime };
    }
  }

  private async getAverageFraudScore(): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { data } = await this.supabase
      .from('fraud_analysis_logs')
      .select('risk_score')
      .gte('created_at', oneHourAgo.toISOString());

    if (!data || data.length === 0) return 0;
    
    const total = data.reduce((sum, item) => sum + item.risk_score, 0);
    return Math.round(total / data.length);
  }

  private async getActiveAlerts(): Promise<SecurityAlert[]> {
    const { data, error } = await this.supabase
      .from('security_incidents')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Failed to get active alerts:', _error);
      return [];
    }

    return (data || []).map(incident => ({
      id: incident.id,
      type: incident.incident_type,
      severity: incident.severity,
      title: incident.title,
      description: incident.description,
      userId: incident.user_id,
      ipAddress: incident.evidence?.ipAddress,
      metadata: incident.evidence || {},
      status: incident.status,
      createdAt: new Date(incident.created_at),
      updatedAt: new Date(incident.updated_at),
      resolvedAt: incident.resolved_at ? new Date(incident.resolved_at) : undefined
    }));
  }

  private async getRecentEvents(): Promise<RealTimeEvent[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { data, error } = await this.supabase
      .from('security_audit_log')
      .select('*')
      .in('severity', ['warning', 'error', 'critical'])
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Failed to get recent events:', _error);
      return [];
    }

    return (data || []).map(log => ({
      eventId: log.id,
      eventType: log.event_type,
      severity: log.severity,
      userId: log.user_id,
      ipAddress: log.ip_address,
      details: {
        action: log.action,
        outcome: log.outcome,
        eventData: log.event_data,
        errorMessage: log.error_message
      },
      timestamp: new Date(log.created_at)
    }));
  }

  private async getThreatIntelligence(): Promise<{
    maliciousIPs: string[];
    suspiciousCountries: string[];
    attackPatterns: string[];
  }> {
    try {
      const [maliciousIPs, suspiciousCountries, attackPatterns] = await Promise.all([
        this.getMaliciousIPs(),
        this.getSuspiciousCountries(),
        this.getAttackPatterns()
      ]);

      return {
        maliciousIPs,
        suspiciousCountries,
        attackPatterns
      };
    } catch (_error) {
      console.error('❌ Failed to get threat intelligence:', _error);
      return {
        maliciousIPs: [],
        suspiciousCountries: [],
        attackPatterns: []
      };
    }
  }

  private async getSystemHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    lastHealthCheck: Date;
  }> {
    // Check various system health indicators
    const healthChecks = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkAPIHealth(),
      this.checkServiceHealth()
    ]);
    
    const failedChecks = healthChecks.filter(check => !check.healthy).length;
    const status = failedChecks === 0 ? 'healthy' : 
                  failedChecks === 1 ? 'degraded' : 'critical';
    
    return {
      status,
      uptime: process.uptime(),
      lastHealthCheck: new Date()
    };
  }

  private async checkDatabaseHealth(): Promise<{ healthy: boolean; responseTime: number }> {
    const startTime = Date.now();
    try {
      await this.supabase.from('users').select('id').limit(1);
      const responseTime = Date.now() - startTime;
      return { healthy: responseTime < 5000, responseTime };
    } catch (_error) {
      return { healthy: false, responseTime: Date.now() - startTime };
    }
  }

  private async checkAPIHealth(): Promise<{ healthy: boolean }> {
    // Basic API health check
    return { healthy: true };
  }

  private async checkServiceHealth(): Promise<{ healthy: boolean }> {
    // Check if monitoring service is running properly
    return { healthy: this.isMonitoring };
  }

  private async checkTransactionVelocity(userId: string): Promise<{ suspicious: boolean; count: number }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const { count } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString());

    return {
      suspicious: (count || 0) > 20, // More than 20 transactions per hour
      count: count || 0
    };
  }

  private async checkIpReputation(ipAddress: string): Promise<{ malicious: boolean; score: number }> {
    const { data } = await this.supabase
      .from('ip_address_tracking')
      .select('is_malicious, risk_score')
      .eq('ip_address', ipAddress)
      .single();

    if (!data) {
      // New IP - assume safe but monitor
      return { malicious: false, score: 0 };
    }

    return {
      malicious: data.is_malicious,
      score: data.risk_score || 0
    };
  }

  private async getMaliciousIPs(): Promise<string[]> {
    const { data } = await this.supabase
      .from('ip_address_tracking')
      .select('ip_address')
      .eq('is_malicious', true)
      .limit(100);

    return (data || []).map(item => item.ip_address);
  }

  private async getSuspiciousCountries(): Promise<string[]> {
    const { data } = await this.supabase
      .from('ip_address_tracking')
      .select('country')
      .gte('risk_score', 70)
      .not('country', 'is', null)
      .limit(20);

    const countryCounts = (data || []).reduce((acc, item) => {
      acc[item.country] = (acc[item.country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(countryCounts)
      .sort((a, b) => countryCounts[b] - countryCounts[a])
      .slice(0, 10);
  }

  private async getAttackPatterns(): Promise<string[]> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data } = await this.supabase
      .from('security_audit_log')
      .select('event_type')
      .eq('outcome', 'failure')
      .gte('created_at', oneWeekAgo.toISOString());

    const patternCounts = (data || []).reduce((acc, item) => {
      acc[item.event_type] = (acc[item.event_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(patternCounts)
      .sort((a, b) => patternCounts[b] - patternCounts[a])
      .slice(0, 10);
  }

  private async cleanupExpiredData(): Promise<void> {
    try {
      // Clean up expired rate limits
      await this.supabase.rpc('cleanup_expired_rate_limits');
      
      // Clean up old audit logs (if configured)
      await this.supabase.rpc('cleanup_expired_audit_logs');
      
    } catch (_error) {
      console.error('❌ Failed to cleanup expired data:', _error);
    }
  }

  private async updateThreatIntelligence(): Promise<void> {
    try {
      // This would integrate with external threat intelligence feeds
      // For now, we'll just update our internal tracking
      console.log('🔄 Updating threat intelligence...');
    } catch (_error) {
      console.error('❌ Failed to update threat intelligence:', _error);
    }
  }

  private setupRealtimeListeners(): void {
    // Set up real-time subscriptions for critical events
    this.supabase
      .channel('security_events')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_incidents'
      }, (payload) => {
        this.handleRealtimeSecurityIncident(payload.new);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'fraud_analysis_logs'
      }, (payload) => {
        this.handleRealtimeFraudAnalysis(payload.new);
      })
      .subscribe();
  }

  private handleRealtimeSecurityIncident(incident: any): void {
    const event: RealTimeEvent = {
      eventId: crypto.randomUUID(),
      eventType: 'security_incident',
      severity: incident.severity,
      userId: incident.user_id,
      ipAddress: incident.evidence?.ipAddress,
      details: incident,
      timestamp: new Date(incident.created_at)
    };

    this.broadcastEvent(event);
  }

  private handleRealtimeFraudAnalysis(analysis: any): void {
    if (analysis.risk_score >= 80) {
      const event: RealTimeEvent = {
        eventId: crypto.randomUUID(),
        eventType: 'high_risk_transaction',
        severity: analysis.risk_score >= 95 ? 'critical' : 'high',
        userId: analysis.user_id,
        details: analysis,
        timestamp: new Date(analysis.created_at)
      };

      this.broadcastEvent(event);
    }
  }

  private broadcastEvent(event: RealTimeEvent): void {
    // Broadcast to all connected WebSocket clients
    this.websocketConnections.forEach(connection => {
      try {
        connection.send(JSON.stringify({
          type: 'security_event',
          data: event
        }));
      } catch (_error) {
        console.error('❌ Failed to broadcast event:', _error);
        // Remove dead connections
        this.websocketConnections.delete(connection);
      }
    });
  }

  /**
   * Add WebSocket connection for real-time updates
   */
  addWebSocketConnection(connection: any): void {
    this.websocketConnections.add(connection);
    
    connection.on('close', () => {
      this.websocketConnections.delete(connection);
    });
  }
}

// Export utility functions
export const securityMonitor = SecurityMonitor.getInstance();

export const startSecurityMonitoring = () => {
  securityMonitor.start();
};

export const stopSecurityMonitoring = () => {
  securityMonitor.stop();
};

export const checkRateLimit = (key: string, limitType: any, userId?: string, ipAddress?: string) => {
  return securityMonitor.checkRateLimit(key, limitType, userId, ipAddress);
};

export const analyzeTransactionSecurity = (userId: string, transactionData: any, ipAddress: string, userAgent: string) => {
  return securityMonitor.analyzeTransactionSecurity(userId, transactionData, ipAddress, userAgent);
};

// Auto-start monitoring in production
if (process.env.NODE_ENV === 'production') {
  setTimeout(() => {
    startSecurityMonitoring();
    console.log('🚀 Security monitoring auto-started in production');
  }, 10000); // Wait 10 seconds for app to initialize
}