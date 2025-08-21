// lib/security/audit-logger.ts
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface AuditLogEntry {
  eventType: string;
  eventCategory: 'authentication' | 'authorization' | 'transaction' | 'admin' | 'security' | 'system';
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  action: string;
  outcome: 'success' | 'failure' | 'partial';
  
  // User context
  userId?: string;
  sessionId?: string;
  impersonatedBy?: string;
  
  // Request context
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  geolocation?: any;
  
  // Resource context
  resourceType?: string;
  resourceId?: string;
  
  // Event data
  eventData?: any;
  beforeState?: any;
  afterState?: any;
  changes?: any;
  
  // Technical details
  requestId?: string;
  correlationId?: string;
  apiEndpoint?: string;
  httpMethod?: string;
  responseCode?: number;
  processingTimeMs?: number;
  
  // Error details
  errorCode?: string;
  errorMessage?: string;
  stackTrace?: string;
  
  // Compliance
  retentionCategory?: 'minimal' | 'standard' | 'extended' | 'permanent';
  piiFields?: string[];
  complianceTags?: string[];
}

interface AuditQueryOptions {
  userId?: string;
  eventTypes?: string[];
  eventCategories?: string[];
  severities?: string[];
  outcomes?: string[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  resourceType?: string;
  resourceId?: string;
  limit?: number;
  offset?: number;
  includeSystemEvents?: boolean;
}

interface SecurityReport {
  reportId: string;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalEvents: number;
    criticalEvents: number;
    failedAuthentications: number;
    suspiciousTransactions: number;
    dataAccessEvents: number;
    adminActions: number;
  };
  security: {
    auditTrailComplete: boolean;
    retentionPolicyFollowed: boolean;
    systemHealth: 'healthy' | 'degraded' | 'critical';
  };
  recommendations: string[];
  generatedAt: Date;
}

export class AuditLogger {
  private static instance: AuditLogger;
  private supabase;
  private correlationId?: string;
  private requestId?: string;
  
  private readonly RETENTION_PERIODS = {
    minimal: 30,      // 30 days
    standard: 365,    // 1 year
    extended: 2555,   // 7 years
    permanent: null   // Never delete
  };

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Set request ID for request tracking
   */
  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  /**
   * Log authentication events
   */
  async logAuthentication(entry: {
    action: 'login' | 'logout' | 'password_change' | 'mfa_setup' | 'mfa_verify' | 'password_reset';
    outcome: 'success' | 'failure';
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    errorMessage?: string;
    additionalData?: any;
  }): Promise<void> {
    await this.log({
      eventType: `auth_${entry.action}`,
      eventCategory: 'authentication',
      severity: entry.outcome === 'failure' ? 'warning' : 'info',
      action: entry.action,
      outcome: entry.outcome,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      deviceFingerprint: entry.deviceFingerprint,
      errorMessage: entry.errorMessage,
      eventData: entry.additionalData,
      retentionCategory: 'extended', // Authentication logs kept for compliance
      complianceTags: ['authentication', 'security']
    });
  }

  /**
   * Log transaction events
   */
  async logTransaction(entry: {
    action: 'deposit' | 'withdrawal' | 'transfer' | 'fee_calculation';
    outcome: 'success' | 'failure' | 'partial';
    userId: string;
    transactionId?: string;
    amount?: string;
    currency?: string;
    fromAddress?: string;
    toAddress?: string;
    network?: string;
    ipAddress?: string;
    beforeState?: any;
    afterState?: any;
    errorMessage?: string;
    processingTimeMs?: number;
  }): Promise<void> {
    await this.log({
      eventType: `transaction_${entry.action}`,
      eventCategory: 'transaction',
      severity: entry.outcome === 'failure' ? 'error' : 'info',
      action: entry.action,
      outcome: entry.outcome,
      userId: entry.userId,
      resourceType: 'transaction',
      resourceId: entry.transactionId,
      ipAddress: entry.ipAddress,
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      processingTimeMs: entry.processingTimeMs,
      errorMessage: entry.errorMessage,
      eventData: {
        amount: entry.amount,
        currency: entry.currency,
        fromAddress: entry.fromAddress,
        toAddress: entry.toAddress,
        network: entry.network
      },
      retentionCategory: 'permanent', // Financial transactions kept permanently
      complianceTags: ['transaction', 'financial'],
      piiFields: entry.fromAddress || entry.toAddress ? ['eventData.fromAddress', 'eventData.toAddress'] : undefined
    });
  }

  /**
   * Log security events
   */
  async logSecurity(entry: {
    action: 'fraud_detected' | 'suspicious_activity' | 'rate_limit_exceeded' | 'ip_blocked' | 'device_blocked';
    severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
    outcome: 'success' | 'failure' | 'partial';
    userId?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    riskScore?: number;
    riskFactors?: any[];
    blockedReason?: string;
    additionalData?: any;
  }): Promise<void> {
    await this.log({
      eventType: `security_${entry.action}`,
      eventCategory: 'security',
      severity: entry.severity,
      action: entry.action,
      outcome: entry.outcome,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      deviceFingerprint: entry.deviceFingerprint,
      eventData: {
        riskScore: entry.riskScore,
        riskFactors: entry.riskFactors,
        blockedReason: entry.blockedReason,
        ...entry.additionalData
      },
      retentionCategory: 'extended', // Security events kept for investigation
      complianceTags: ['security', 'fraud_prevention']
    });
  }

  /**
   * Log admin actions
   */
  async logAdmin(entry: {
    action: string;
    outcome: 'success' | 'failure';
    adminUserId: string;
    targetUserId?: string;
    resourceType?: string;
    resourceId?: string;
    beforeState?: any;
    afterState?: any;
    changes?: any;
    reason?: string;
    ipAddress?: string;
    errorMessage?: string;
  }): Promise<void> {
    await this.log({
      eventType: `admin_${entry.action}`,
      eventCategory: 'admin',
      severity: 'warning', // Admin actions are always significant
      action: entry.action,
      outcome: entry.outcome,
      userId: entry.targetUserId,
      impersonatedBy: entry.adminUserId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      beforeState: entry.beforeState,
      afterState: entry.afterState,
      changes: entry.changes,
      ipAddress: entry.ipAddress,
      errorMessage: entry.errorMessage,
      eventData: {
        reason: entry.reason,
        adminAction: true
      },
      retentionCategory: 'permanent', // Admin actions kept permanently
      complianceTags: ['admin', 'privileged_access']
    });
  }

  /**
   * Log system events
   */
  async logSystem(entry: {
    action: string;
    severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
    outcome: 'success' | 'failure' | 'partial';
    component?: string;
    errorMessage?: string;
    stackTrace?: string;
    processingTimeMs?: number;
    additionalData?: any;
  }): Promise<void> {
    await this.log({
      eventType: `system_${entry.action}`,
      eventCategory: 'system',
      severity: entry.severity,
      action: entry.action,
      outcome: entry.outcome,
      errorMessage: entry.errorMessage,
      stackTrace: entry.stackTrace,
      processingTimeMs: entry.processingTimeMs,
      eventData: {
        component: entry.component,
        ...entry.additionalData
      },
      retentionCategory: 'standard', // System logs kept for operations
      complianceTags: ['system', 'operations']
    });
  }

  /**
   * Log API access events
   */
  async logApiAccess(entry: {
    endpoint: string;
    method: string;
    outcome: 'success' | 'failure';
    responseCode: number;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    processingTimeMs?: number;
    requestData?: any;
    responseData?: any;
    errorMessage?: string;
  }): Promise<void> {
    await this.log({
      eventType: 'api_access',
      eventCategory: 'system',
      severity: entry.responseCode >= 500 ? 'error' : entry.responseCode >= 400 ? 'warning' : 'info',
      action: 'api_call',
      outcome: entry.outcome,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      apiEndpoint: entry.endpoint,
      httpMethod: entry.method,
      responseCode: entry.responseCode,
      processingTimeMs: entry.processingTimeMs,
      errorMessage: entry.errorMessage,
      eventData: {
        requestData: entry.requestData,
        responseData: entry.responseData
      },
      retentionCategory: 'standard',
      complianceTags: ['api', 'access']
    });
  }

  /**
   * Core logging method
   */
  private async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Calculate expiry date based on retention category
      const expiresAt = this.calculateExpiryDate(entry.retentionCategory || 'standard');
      
      // Prepare log entry for database
      const logEntry = {
        event_type: entry.eventType,
        event_category: entry.eventCategory,
        severity: entry.severity,
        user_id: entry.userId,
        session_id: entry.sessionId,
        impersonated_by: entry.impersonatedBy,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        device_fingerprint: entry.deviceFingerprint,
        geolocation: entry.geolocation,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        action: entry.action,
        outcome: entry.outcome,
        event_data: entry.eventData || {},
        before_state: entry.beforeState,
        after_state: entry.afterState,
        changes: entry.changes,
        request_id: entry.requestId || this.requestId,
        correlation_id: entry.correlationId || this.correlationId,
        api_endpoint: entry.apiEndpoint,
        http_method: entry.httpMethod,
        response_code: entry.responseCode,
        processing_time_ms: entry.processingTimeMs,
        error_code: entry.errorCode,
        error_message: entry.errorMessage,
        stack_trace: entry.stackTrace,
        retention_category: entry.retentionCategory || 'standard',
        pii_fields: entry.piiFields || [],
        compliance_tags: entry.complianceTags || [],
        expires_at: expiresAt?.toISOString(),
        created_at: new Date().toISOString()
      };

      // Insert into database
      const { error } = await this.supabase
        .from('security_audit_log')
        .insert(logEntry);

      if (error) {
        console.error('❌ Failed to write audit log:', _error);
        // In production, you might want to send to a fallback logging system
      }

      // For critical events, also log to external system
      if (entry.severity === 'critical') {
        await this.logToCriticalSystem(logEntry);
      }

    } catch (_error) {
      console.error('❌ Audit logging failed:', _error);
      // Never throw errors from audit logging to avoid breaking application flow
    }
  }

  /**
   * Query audit logs with advanced filtering
   */
  async queryLogs(options: AuditQueryOptions): Promise<{
    logs: any[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = this.supabase
        .from('security_audit_log')
        .select('*', { count: 'exact' });

      // Apply filters
      if (options.userId) {
        query = query.eq('user_id', options.userId);
      }

      if (options.eventTypes && options.eventTypes.length > 0) {
        query = query.in('event_type', options.eventTypes);
      }

      if (options.eventCategories && options.eventCategories.length > 0) {
        query = query.in('event_category', options.eventCategories);
      }

      if (options.severities && options.severities.length > 0) {
        query = query.in('severity', options.severities);
      }

      if (options.outcomes && options.outcomes.length > 0) {
        query = query.in('outcome', options.outcomes);
      }

      if (options.startDate) {
        query = query.gte('created_at', options.startDate.toISOString());
      }

      if (options.endDate) {
        query = query.lte('created_at', options.endDate.toISOString());
      }

      if (options.ipAddress) {
        query = query.eq('ip_address', options.ipAddress);
      }

      if (options.resourceType) {
        query = query.eq('resource_type', options.resourceType);
      }

      if (options.resourceId) {
        query = query.eq('resource_id', options.resourceId);
      }

      if (!options.includeSystemEvents) {
        query = query.neq('event_category', 'system');
      }

      // Apply pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data: logs, error, count } = await query;

      if (error) {
        throw new Error(`Failed to query audit logs: ${(_error as Error)?.message || String(_error)}`);
      }

      return {
        logs: logs || [],
        total: count || 0,
        hasMore: (count || 0) > offset + limit
      };

    } catch (_error) {
      console.error('❌ Failed to query audit logs:', _error);
      return {
        logs: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<SecurityReport> {
    try {
      // Query logs for the period
      const { logs, total } = await this.queryLogs({
        startDate,
        endDate,
        userId,
        limit: 10000,
        includeSystemEvents: true
      });

      // Calculate metrics
      const metrics = {
        totalEvents: total,
        criticalEvents: logs.filter(log => log.severity === 'critical').length,
        failedAuthentications: logs.filter(log => 
          log.event_category === 'authentication' && log.outcome === 'failure'
        ).length,
        suspiciousTransactions: logs.filter(log => 
          log.event_category === 'transaction' && log.event_data?.riskScore > 70
        ).length,
        dataAccessEvents: logs.filter(log => 
          log.action?.includes('read') || log.action?.includes('access')
        ).length,
        adminActions: logs.filter(log => log.event_category === 'admin').length
      };

      // Check security status
      const security = {
        auditTrailComplete: this.checkAuditTrailCompleteness(logs, startDate, endDate),
        retentionPolicyFollowed: await this.checkRetentionPolicy(),
        systemHealth: this.determineSystemHealth(metrics) as 'healthy' | 'degraded' | 'critical'
      };

      // Generate recommendations
      const recommendations = this.generateRecommendations(metrics, security, logs);

      return {
        reportId: crypto.randomUUID(),
        period: { start: startDate, end: endDate },
        metrics,
        security,
        recommendations,
        generatedAt: new Date()
      };

    } catch (_error) {
      console.error('❌ Failed to generate security report:', _error);
      throw _error;
    }
  }

  /**
   * Clean up expired logs
   */
  async cleanupExpiredLogs(): Promise<{
    deleted: number;
    errors: string[];
  }> {
    try {
      const result = await this.supabase.rpc('cleanup_expired_audit_logs');
      
      return {
        deleted: result.data || 0,
        errors: []
      };
    } catch (_error) {
      console.error('❌ Failed to cleanup expired logs:', _error);
      return {
        deleted: 0,
        errors: [error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error']
      };
    }
  }

  /**
   * Export logs for external analysis
   */
  async exportLogs(
    options: AuditQueryOptions,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const { logs } = await this.queryLogs({ ...options, limit: 10000 });

      if (format === 'json') {
        return JSON.stringify(logs, null, 2);
      } else {
        return this.convertToCsv(logs);
      }
    } catch (_error) {
      console.error('❌ Failed to export logs:', _error);
      throw _error;
    }
  }

  // Private helper methods
  private calculateExpiryDate(retentionCategory: string): Date | null {
    const retentionDays = this.RETENTION_PERIODS[retentionCategory as keyof typeof this.RETENTION_PERIODS];
    
    if (retentionDays === null) {
      return null; // Permanent retention
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + retentionDays);
    return expiryDate;
  }

  private async logToCriticalSystem(logEntry: any): Promise<void> {
    try {
      // Log to external critical logging system (e.g., AWS CloudWatch, Datadog)
      if (process.env.CRITICAL_LOGS_ENDPOINT) {
        await fetch(process.env.CRITICAL_LOGS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRITICAL_LOGS_API_KEY}`
          },
          body: JSON.stringify({
            source: 'p2pfiat-platform',
            level: 'critical',
            timestamp: new Date().toISOString(),
            message: logEntry.event_type,
            data: logEntry
          })
        });
      }
    } catch (_error) {
      console.error('❌ Failed to log to critical system:', _error);
    }
  }

  private determineSystemHealth(metrics: any): string {
    // Determine system health based on metrics
    let healthScore = 100;
    
    // Reduce score based on issues
    if (metrics.criticalEvents > 10) healthScore -= 30;
    if (metrics.failedAuthentications > 100) healthScore -= 20;
    if (metrics.suspiciousTransactions > 50) healthScore -= 25;
    
    if (healthScore >= 80) return 'healthy';
    if (healthScore >= 60) return 'degraded';
    return 'critical';
  }

  private checkAuditTrailCompleteness(logs: any[], startDate: Date, endDate: Date): boolean {
    // Check for gaps in audit trail
    const sortedLogs = logs.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Check for significant gaps (more than 1 hour without any logs during business hours)
    for (let i = 1; i < sortedLogs.length; i++) {
      const prevTime = new Date(sortedLogs[i - 1].created_at);
      const currentTime = new Date(sortedLogs[i].created_at);
      const gap = currentTime.getTime() - prevTime.getTime();
      
      // If gap is more than 4 hours during what should be active time
      if (gap > 4 * 60 * 60 * 1000) {
        return false;
      }
    }

    return true;
  }

  private async checkRetentionPolicy(): Promise<boolean> {
    try {
      // Check if expired logs are being properly cleaned up
      const { data: expiredLogs, error } = await this.supabase
        .from('security_audit_log')
        .select('id')
        .lt('expires_at', new Date().toISOString())
        .limit(1);

      if (error) {
        return false;
      }

      // If there are expired logs that haven't been cleaned up, policy is not being followed
      return !expiredLogs || expiredLogs.length === 0;
    } catch (_error) {
      return false;
    }
  }

  private generateRecommendations(
    metrics: any,
    security: any,
    logs: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.criticalEvents > 10) {
      recommendations.push('High number of critical events detected. Review security incidents.');
    }

    if (metrics.failedAuthentications > 100) {
      recommendations.push('High number of failed authentications. Consider implementing additional security measures.');
    }

    if (!security.auditTrailComplete) {
      recommendations.push('Gaps in audit trail detected. Investigate logging system reliability.');
    }

    if (!security.retentionPolicyFollowed) {
      recommendations.push('Expired logs found. Execute cleanup procedures more frequently.');
    }

    if (security.systemHealth === 'critical') {
      recommendations.push('System health is critical. Immediate attention required.');
    } else if (security.systemHealth === 'degraded') {
      recommendations.push('System health is degraded. Monitor closely and address issues.');
    }

    if (metrics.suspiciousTransactions > 50) {
      recommendations.push('High number of suspicious transactions. Review fraud detection rules.');
    }

    return recommendations;
  }

  private convertToCsv(logs: any[]): string {
    if (logs.length === 0) {
      return '';
    }

    // CSV headers
    const headers = [
      'created_at', 'event_type', 'event_category', 'severity', 'action', 'outcome',
      'user_id', 'ip_address', 'resource_type', 'resource_id', 'error_message'
    ];

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = headers.map(header => {
        const value = log[header] || '';
        // Escape CSV special characters
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }
}

// Export utility functions
export const auditLogger = AuditLogger.getInstance();

export const logAuthentication = (entry: Parameters<AuditLogger['logAuthentication']>[0]) => {
  return auditLogger.logAuthentication(entry);
};

export const logTransaction = (entry: Parameters<AuditLogger['logTransaction']>[0]) => {
  return auditLogger.logTransaction(entry);
};

export const logSecurity = (entry: Parameters<AuditLogger['logSecurity']>[0]) => {
  return auditLogger.logSecurity(entry);
};

export const logAdmin = (entry: Parameters<AuditLogger['logAdmin']>[0]) => {
  return auditLogger.logAdmin(entry);
};

export const logSystem = (entry: Parameters<AuditLogger['logSystem']>[0]) => {
  return auditLogger.logSystem(entry);
};

export const logApiAccess = (entry: Parameters<AuditLogger['logApiAccess']>[0]) => {
  return auditLogger.logApiAccess(entry);
};

// Middleware helper for automatic API logging
export const createAuditMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  auditLogger.setRequestId(requestId);
  
  res.on('finish', () => {
    const processingTime = Date.now() - startTime;
    
    auditLogger.logApiAccess({
      endpoint: req.url,
      method: req.method,
      outcome: res.statusCode < 400 ? 'success' : 'failure',
      responseCode: res.statusCode,
      userId: req.user?.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      processingTimeMs: processingTime
    });
  });
  
  next();
};

// Constants
export const AUDIT_CATEGORIES = {
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  TRANSACTION: 'transaction',
  ADMIN: 'admin',
  SECURITY: 'security',
  SYSTEM: 'system'
} as const;

export const AUDIT_SEVERITIES = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
} as const;

export const RETENTION_CATEGORIES = {
  MINIMAL: 'minimal',
  STANDARD: 'standard',
  EXTENDED: 'extended',
  PERMANENT: 'permanent'
} as const;