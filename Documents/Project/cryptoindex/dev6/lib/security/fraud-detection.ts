// lib/security/fraud-detection.ts
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface UserBehaviorPattern {
  userId: string;
  averageTransactionAmount: number;
  typicalTransactionHours: number[];
  frequentDestinations: string[];
  averageTimeBetweenTransactions: number;
  preferredNetworks: string[];
  deviceFingerprints: string[];
  ipAddressHistory: string[];
  geolocationHistory: string[];
  riskScore: number;
  lastUpdated: Date;
}

interface TransactionAnalysis {
  transactionId: string;
  riskScore: number;
  riskFactors: RiskFactor[];
  recommendation: 'approve' | 'review' | 'block';
  confidence: number;
  mlPrediction?: number;
}

interface RiskFactor {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  weight: number;
  value: any;
}

interface FraudDetectionConfig {
  mlModelEndpoint?: string;
  riskThresholds: {
    approve: number;    // 0-30
    review: number;     // 31-70
    block: number;      // 71-100
  };
  featureWeights: {
    amountDeviation: number;
    timeDeviation: number;
    locationDeviation: number;
    deviceDeviation: number;
    velocityCheck: number;
    patternBreak: number;
  };
  enabled: boolean;
}

export class FraudDetectionService {
  private static instance: FraudDetectionService;
  private supabase;
  private config: FraudDetectionConfig;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.config = {
      mlModelEndpoint: process.env.FRAUD_ML_ENDPOINT,
      riskThresholds: {
        approve: 30,
        review: 70,
        block: 100
      },
      featureWeights: {
        amountDeviation: 0.25,
        timeDeviation: 0.15,
        locationDeviation: 0.20,
        deviceDeviation: 0.15,
        velocityCheck: 0.15,
        patternBreak: 0.10
      },
      enabled: true
    };
  }

  static getInstance(): FraudDetectionService {
    if (!FraudDetectionService.instance) {
      FraudDetectionService.instance = new FraudDetectionService();
    }
    return FraudDetectionService.instance;
  }

  /**
   * Analyze transaction for fraud risk
   */
  async analyzeTransaction(
    userId: string,
    transactionData: {
      amount: number;
      destinationAddress: string;
      network: string;
      userAgent: string;
      ipAddress: string;
      deviceFingerprint?: string;
    }
  ): Promise<TransactionAnalysis> {
    try {
      if (!this.config.enabled) {
        return {
          transactionId: crypto.randomUUID(),
          riskScore: 0,
          riskFactors: [],
          recommendation: 'approve',
          confidence: 1.0
        };
      }

      // Get user behavior pattern
      const userPattern = await this.getUserBehaviorPattern(userId);
      
      // Analyze various risk factors
      const riskFactors: RiskFactor[] = [];
      
      // 1. Amount deviation analysis
      const amountRisk = this.analyzeAmountDeviation(transactionData.amount, userPattern);
      if (amountRisk.severity !== 'low') riskFactors.push(amountRisk);

      // 2. Time pattern analysis
      const timeRisk = this.analyzeTimePattern(userPattern);
      if (timeRisk.severity !== 'low') riskFactors.push(timeRisk);

      // 3. Geolocation analysis
      const locationRisk = await this.analyzeGeolocation(transactionData.ipAddress, userPattern);
      if (locationRisk.severity !== 'low') riskFactors.push(locationRisk);

      // 4. Device fingerprint analysis
      const deviceRisk = this.analyzeDeviceFingerprint(transactionData.deviceFingerprint, userPattern);
      if (deviceRisk.severity !== 'low') riskFactors.push(deviceRisk);

      // 5. Transaction velocity analysis
      const velocityRisk = await this.analyzeTransactionVelocity(userId);
      if (velocityRisk.severity !== 'low') riskFactors.push(velocityRisk);

      // 6. Destination address analysis
      const destinationRisk = this.analyzeDestinationAddress(transactionData.destinationAddress, userPattern);
      if (destinationRisk.severity !== 'low') riskFactors.push(destinationRisk);

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(riskFactors);
      
      // Get ML prediction if available
      const mlPrediction = await this.getMlPrediction(userId, transactionData, userPattern);
      
      // Combine rule-based and ML scores
      const finalScore = this.combineScores(riskScore, mlPrediction);
      
      // Determine recommendation
      const recommendation = this.getRecommendation(finalScore);
      
      // Log fraud analysis
      await this.logFraudAnalysis(userId, {
        riskScore: finalScore,
        riskFactors,
        recommendation,
        mlPrediction,
        transactionData
      });

      return {
        transactionId: crypto.randomUUID(),
        riskScore: finalScore,
        riskFactors,
        recommendation,
        confidence: this.calculateConfidence(riskFactors),
        mlPrediction
      };
    } catch (_error) {
      console.error('❌ Fraud analysis failed:', _error);
      
      // Fail safely - allow transaction but log error
      return {
        transactionId: crypto.randomUUID(),
        riskScore: 50, // Medium risk when analysis fails
        riskFactors: [{
          type: 'analysis_failure',
          severity: 'medium',
          description: 'Fraud analysis failed - manual review recommended',
          weight: 1.0,
          value: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'
        }],
        recommendation: 'review',
        confidence: 0.0
      };
    }
  }

  /**
   * Update user behavior pattern based on new transaction
   */
  async updateUserBehaviorPattern(
    userId: string,
    transactionData: {
      amount: number;
      timestamp: Date;
      destinationAddress: string;
      network: string;
      ipAddress: string;
      deviceFingerprint?: string;
      userAgent: string;
    }
  ): Promise<void> {
    try {
      // Get current pattern
      const currentPattern = await this.getUserBehaviorPattern(userId);
      
      // Update with new transaction data
      const updatedPattern = this.calculateUpdatedPattern(currentPattern, transactionData);
      
      // Save updated pattern
      await this.saveUserBehaviorPattern(userId, updatedPattern);
      
      console.log(`✅ Updated behavior pattern for user: ${userId}`);
    } catch (_error) {
      console.error('❌ Failed to update user behavior pattern:', _error);
    }
  }

  /**
   * Get user behavior pattern
   */
  private async getUserBehaviorPattern(userId: string): Promise<UserBehaviorPattern> {
    try {
      // Try to get existing pattern
      const { data: existingPattern, error } = await this.supabase
        .from('user_behavior_patterns')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingPattern && !error) {
        return {
          userId: existingPattern.user_id,
          averageTransactionAmount: existingPattern.avg_transaction_amount,
          typicalTransactionHours: existingPattern.typical_hours || [],
          frequentDestinations: existingPattern.frequent_destinations || [],
          averageTimeBetweenTransactions: existingPattern.avg_time_between_txn,
          preferredNetworks: existingPattern.preferred_networks || [],
          deviceFingerprints: existingPattern.device_fingerprints || [],
          ipAddressHistory: existingPattern.ip_history || [],
          geolocationHistory: existingPattern.geolocation_history || [],
          riskScore: existingPattern.risk_score || 0,
          lastUpdated: new Date(existingPattern.updated_at)
        };
      }

      // If no existing pattern, create from transaction history
      return await this.buildInitialBehaviorPattern(userId);
    } catch (_error) {
      console.error('❌ Failed to get user behavior pattern:', _error);
      return this.getDefaultBehaviorPattern(userId);
    }
  }

  /**
   * Build initial behavior pattern from transaction history
   */
  private async buildInitialBehaviorPattern(userId: string): Promise<UserBehaviorPattern> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !transactions || transactions.length === 0) {
        return this.getDefaultBehaviorPattern(userId);
      }

      const amounts = transactions.map(tx => parseFloat(tx.amount));
      const hours = transactions.map(tx => new Date(tx.created_at).getHours());
      const destinations = transactions
        .map(tx => tx.metadata?.destination_address)
        .filter(Boolean);
      const networks = transactions.map(tx => tx.network);

      const pattern: UserBehaviorPattern = {
        userId,
        averageTransactionAmount: amounts.length > 0 ? amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length : 0,
        typicalTransactionHours: this.getMostFrequentHours(hours),
        frequentDestinations: this.getMostFrequentValues(destinations, 5),
        averageTimeBetweenTransactions: this.calculateAverageTimeBetween(transactions),
        preferredNetworks: this.getMostFrequentValues(networks, 3),
        deviceFingerprints: [],
        ipAddressHistory: [],
        geolocationHistory: [],
        riskScore: 0,
        lastUpdated: new Date()
      };

      // Save the initial pattern
      await this.saveUserBehaviorPattern(userId, pattern);
      
      return pattern;
    } catch (_error) {
      console.error('❌ Failed to build initial behavior pattern:', _error);
      return this.getDefaultBehaviorPattern(userId);
    }
  }

  /**
   * Analyze amount deviation from user's typical behavior
   */
  private analyzeAmountDeviation(amount: number, pattern: UserBehaviorPattern): RiskFactor {
    const deviation = Math.abs(amount - pattern.averageTransactionAmount) / pattern.averageTransactionAmount;
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    let description: string;
    
    if (deviation > 10) {
      severity = 'critical';
      description = `Transaction amount ${amount} is ${(deviation * 100).toFixed(0)}% higher than typical amount`;
    } else if (deviation > 5) {
      severity = 'high';
      description = `Transaction amount ${amount} is ${(deviation * 100).toFixed(0)}% above typical amount`;
    } else if (deviation > 2) {
      severity = 'medium';
      description = `Transaction amount ${amount} is moderately above typical amount`;
    } else {
      severity = 'low';
      description = 'Transaction amount within normal range';
    }

    return {
      type: 'amount_deviation',
      severity,
      description,
      weight: this.config.featureWeights.amountDeviation,
      value: { amount, average: pattern.averageTransactionAmount, deviation }
    };
  }

  /**
   * Analyze time pattern deviation
   */
  private analyzeTimePattern(pattern: UserBehaviorPattern): RiskFactor {
    const currentHour = new Date().getHours();
    const isTypicalHour = (pattern.typicalTransactionHours || []).includes(currentHour);
    
    const nearestTypicalHour = (pattern.typicalTransactionHours || []).length > 0 
      ? pattern.typicalTransactionHours.reduce((closest, hour) => {
          const diff = Math.abs(hour - currentHour);
          const closestDiff = Math.abs(closest - currentHour);
          return diff < closestDiff ? hour : closest;
        }, pattern.typicalTransactionHours[0])
      : 12;
    
    const hourDeviation = Math.abs(currentHour - nearestTypicalHour);
    
    let severity: 'low' | 'medium' | 'high' | 'critical';
    let description: string;
    
    if (!isTypicalHour && hourDeviation > 6) {
      severity = 'high';
      description = `Transaction at unusual time (${currentHour}:00). Typical hours: ${(pattern.typicalTransactionHours || []).join(', ')}`;
    } else if (!isTypicalHour && hourDeviation > 3) {
      severity = 'medium';
      description = `Transaction slightly outside typical hours`;
    } else {
      severity = 'low';
      description = 'Transaction at typical time';
    }

    return {
      type: 'time_deviation',
      severity,
      description,
      weight: this.config.featureWeights.timeDeviation,
      value: { currentHour, typicalHours: pattern.typicalTransactionHours, deviation: hourDeviation }
    };
  }

  /**
   * Analyze geolocation deviation
   */
  private async analyzeGeolocation(ipAddress: string, pattern: UserBehaviorPattern): Promise<RiskFactor> {
    try {
      // Get geolocation for current IP
      const currentLocation = await this.getGeolocation(ipAddress);
      
      if (!currentLocation) {
        return {
          type: 'geolocation_unknown',
          severity: 'medium',
          description: 'Unable to determine location from IP address',
          weight: this.config.featureWeights.locationDeviation,
          value: { ipAddress }
        };
      }

      // Check against historical locations
      const isKnownLocation = (pattern.geolocationHistory || []).some(location => {
        const [lat, lon] = location.split(',').map(Number);
        const distance = this.calculateDistance(
          currentLocation.lat, currentLocation.lon,
          lat, lon
        );
        return distance < 100; // Within 100km
      });

      if (!isKnownLocation && (pattern.geolocationHistory || []).length > 0) {
        const nearestLocation = this.findNearestLocation(currentLocation, pattern.geolocationHistory || []);
        const distance = nearestLocation.distance;
        
        let severity: 'low' | 'medium' | 'high' | 'critical';
        let description: string;
        
        if (distance > 1000) {
          severity = 'critical';
          description = `Transaction from new location ${distance.toFixed(0)}km from nearest known location`;
        } else if (distance > 500) {
          severity = 'high';
          description = `Transaction from distant location ${distance.toFixed(0)}km away`;
        } else if (distance > 100) {
          severity = 'medium';
          description = `Transaction from moderately distant location`;
        } else {
          severity = 'low';
          description = 'Transaction from known location area';
        }

        return {
          type: 'geolocation_deviation',
          severity,
          description,
          weight: this.config.featureWeights.locationDeviation,
          value: { currentLocation, distance, nearestLocation: nearestLocation.location }
        };
      }

      return {
        type: 'geolocation_known',
        severity: 'low',
        description: 'Transaction from known location',
        weight: this.config.featureWeights.locationDeviation,
        value: { currentLocation }
      };
    } catch (_error) {
      console.error('❌ Geolocation analysis failed:', _error);
      return {
        type: 'geolocation_error',
        severity: 'medium',
        description: 'Geolocation analysis failed',
        weight: this.config.featureWeights.locationDeviation,
        value: { error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error' }
      };
    }
  }

  /**
   * Analyze device fingerprint
   */
  private analyzeDeviceFingerprint(deviceFingerprint: string | undefined, pattern: UserBehaviorPattern): RiskFactor {
    if (!deviceFingerprint) {
      return {
        type: 'device_fingerprint_missing',
        severity: 'medium',
        description: 'Device fingerprint not available',
        weight: this.config.featureWeights.deviceDeviation,
        value: null
      };
    }

    const isKnownDevice = (pattern.deviceFingerprints || []).includes(deviceFingerprint);
    
    if (!isKnownDevice) {
      return {
        type: 'device_unknown',
        severity: (pattern.deviceFingerprints || []).length > 0 ? 'high' : 'medium',
        description: 'Transaction from unknown device',
        weight: this.config.featureWeights.deviceDeviation,
        value: { deviceFingerprint, knownDevices: (pattern.deviceFingerprints || []).length }
      };
    }

    return {
      type: 'device_known',
      severity: 'low',
      description: 'Transaction from known device',
      weight: this.config.featureWeights.deviceDeviation,
      value: { deviceFingerprint }
    };
  }

  /**
   * Analyze transaction velocity
   */
  private async analyzeTransactionVelocity(userId: string): Promise<RiskFactor> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [hourlyCount, dailyCount] = await Promise.all([
        this.getTransactionCount(userId, oneHourAgo),
        this.getTransactionCount(userId, oneDayAgo)
      ]);

      let severity: 'low' | 'medium' | 'high' | 'critical';
      let description: string;

      if (hourlyCount >= 10) {
        severity = 'critical';
        description = `Extremely high velocity: ${hourlyCount} transactions in last hour`;
      } else if (hourlyCount >= 5 || dailyCount >= 50) {
        severity = 'high';
        description = `High velocity: ${hourlyCount} transactions in last hour, ${dailyCount} in last day`;
      } else if (hourlyCount >= 3 || dailyCount >= 20) {
        severity = 'medium';
        description = `Moderate velocity: ${hourlyCount} transactions in last hour, ${dailyCount} in last day`;
      } else {
        severity = 'low';
        description = 'Normal transaction velocity';
      }

      return {
        type: 'transaction_velocity',
        severity,
        description,
        weight: this.config.featureWeights.velocityCheck,
        value: { hourlyCount, dailyCount }
      };
    } catch (_error) {
      console.error('❌ Velocity analysis failed:', _error);
      return {
        type: 'velocity_analysis_error',
        severity: 'medium',
        description: 'Velocity analysis failed',
        weight: this.config.featureWeights.velocityCheck,
        value: { error: error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error' }
      };
    }
  }

  /**
   * Analyze destination address
   */
  private analyzeDestinationAddress(destinationAddress: string, pattern: UserBehaviorPattern): RiskFactor {
    const isFrequentDestination = (pattern.frequentDestinations || []).includes(destinationAddress);
    
    if (!isFrequentDestination) {
      return {
        type: 'destination_new',
        severity: (pattern.frequentDestinations || []).length > 0 ? 'medium' : 'low',
        description: 'Transaction to new destination address',
        weight: this.config.featureWeights.patternBreak,
        value: { 
          destinationAddress: `${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}`,
          knownDestinations: (pattern.frequentDestinations || []).length 
        }
      };
    }

    return {
      type: 'destination_known',
      severity: 'low',
      description: 'Transaction to known destination',
      weight: this.config.featureWeights.patternBreak,
      value: { destinationAddress: `${destinationAddress.slice(0, 6)}...${destinationAddress.slice(-4)}` }
    };
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(riskFactors: RiskFactor[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const factor of riskFactors) {
      const severityScore = this.getSeverityScore(factor.severity);
      totalScore += severityScore * factor.weight;
      totalWeight += factor.weight;
    }

    // Normalize to 0-100 scale
    const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
    return Math.min(100, Math.max(0, normalizedScore));
  }

  /**
   * Get ML prediction if available
   */
  private async getMlPrediction(
    userId: string,
    transactionData: any,
    userPattern: UserBehaviorPattern
  ): Promise<number | undefined> {
    if (!this.config.mlModelEndpoint) {
      return undefined;
    }

    try {
      const features = this.extractFeatures(userId, transactionData, userPattern);
      
      const response = await fetch(this.config.mlModelEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.ML_API_KEY}`
        },
        body: JSON.stringify({ features }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`ML API responded with ${response.status}`);
      }

      const result = await response.json();
      return result.fraud_probability * 100; // Convert to 0-100 scale
    } catch (_error) {
      console.error('❌ ML prediction failed:', _error);
      return undefined;
    }
  }

  /**
   * Extract features for ML model
   */
  private extractFeatures(userId: string, transactionData: any, userPattern: UserBehaviorPattern): any {
    return {
      user_id_hash: crypto.createHash('sha256').update(userId).digest('hex'),
      transaction_amount: transactionData.amount,
      amount_deviation: Math.abs(transactionData.amount - userPattern.averageTransactionAmount) / userPattern.averageTransactionAmount,
      transaction_hour: new Date().getHours(),
      is_typical_hour: (userPattern.typicalTransactionHours || []).includes(new Date().getHours()),
      destination_is_known: (userPattern.frequentDestinations || []).includes(transactionData.destinationAddress),
      network: transactionData.network,
      user_transaction_count: (userPattern.frequentDestinations || []).length, // Proxy for experience
      avg_transaction_amount: userPattern.averageTransactionAmount,
      days_since_last_transaction: this.calculateDaysSinceLastTransaction(userPattern),
      risk_score_history: userPattern.riskScore
    };
  }

  /**
   * Combine rule-based and ML scores
   */
  private combineScores(ruleBasedScore: number, mlScore?: number): number {
    if (mlScore === undefined) {
      return ruleBasedScore;
    }

    // Weight: 60% rule-based, 40% ML
    return Math.round(ruleBasedScore * 0.6 + mlScore * 0.4);
  }

  /**
   * Get recommendation based on score
   */
  private getRecommendation(score: number): 'approve' | 'review' | 'block' {
    if (score <= this.config.riskThresholds.approve) {
      return 'approve';
    } else if (score <= this.config.riskThresholds.review) {
      return 'review';
    } else {
      return 'block';
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(riskFactors: RiskFactor[]): number {
    const factorCount = riskFactors.length;
    const highSeverityCount = riskFactors.filter(f => f.severity === 'high' || f.severity === 'critical').length;
    
    // Higher confidence with more factors and higher severity
    const baseConfidence = Math.min(0.9, 0.5 + (factorCount * 0.1));
    const severityBonus = highSeverityCount * 0.1;
    
    return Math.min(1.0, baseConfidence + severityBonus);
  }

  // Helper methods...
  private getSeverityScore(severity: 'low' | 'medium' | 'high' | 'critical'): number {
    switch (severity) {
      case 'low': return 10;
      case 'medium': return 40;
      case 'high': return 70;
      case 'critical': return 95;
    }
  }

  private getDefaultBehaviorPattern(userId: string): UserBehaviorPattern {
    return {
      userId,
      averageTransactionAmount: 100,
      typicalTransactionHours: [9, 10, 11, 14, 15, 16, 19, 20],
      frequentDestinations: [],
      averageTimeBetweenTransactions: 86400000, // 1 day in ms
      preferredNetworks: ['hyperliquid'],
      deviceFingerprints: [],
      ipAddressHistory: [],
      geolocationHistory: [],
      riskScore: 0,
      lastUpdated: new Date()
    };
  }

  private getMostFrequentHours(hours: number[]): number[] {
    const hourCounts = hours.reduce((acc, hour) => {
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([hour]) => parseInt(hour));
  }

  private getMostFrequentValues<T>(values: T[], limit: number): T[] {
    const counts = values.reduce((acc, value) => {
      acc.set(value, (acc.get(value) || 0) + 1);
      return acc;
    }, new Map<T, number>());

    return Array.from(counts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([value]) => value);
  }

  private calculateAverageTimeBetween(transactions: any[]): number {
    if (transactions.length < 2) return 86400000; // Default 1 day

    const times = transactions.map(tx => new Date(tx.created_at).getTime()).sort();
    const differences = times.slice(1).map((time, i) => time - times[i]);
    
    return differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
  }

  private async getGeolocation(ipAddress: string): Promise<{lat: number, lon: number, country: string} | null> {
    try {
      // Use a geolocation service (example with ipapi.co)
      const response = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lon: data.longitude,
          country: data.country_name || 'Unknown'
        };
      }
      
      return null;
    } catch (_error) {
      console.error('❌ Geolocation lookup failed:', _error);
      return null;
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private findNearestLocation(currentLocation: {lat: number, lon: number}, locationHistory: string[]) {
    let nearestDistance = Infinity;
    let nearestLocation = '';

    for (const location of locationHistory) {
      const [lat, lon] = location.split(',').map(Number);
      const distance = this.calculateDistance(currentLocation.lat, currentLocation.lon, lat, lon);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestLocation = location;
      }
    }

    return { distance: nearestDistance, location: nearestLocation };
  }

  private async getTransactionCount(userId: string, since: Date): Promise<number> {
    const { count, error } = await this.supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', since.toISOString());

    if (error) {
      console.error('❌ Failed to get transaction count:', _error);
      return 0;
    }

    return count || 0;
  }

  private calculateDaysSinceLastTransaction(userPattern: UserBehaviorPattern): number {
    const daysSince = (Date.now() - userPattern.lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return Math.floor(daysSince);
  }

  private async saveUserBehaviorPattern(userId: string, pattern: UserBehaviorPattern): Promise<void> {
    const { error } = await this.supabase
      .from('user_behavior_patterns')
      .upsert({
        user_id: userId,
        avg_transaction_amount: pattern.averageTransactionAmount,
        typical_hours: pattern.typicalTransactionHours,
        frequent_destinations: pattern.frequentDestinations,
        avg_time_between_txn: pattern.averageTimeBetweenTransactions,
        preferred_networks: pattern.preferredNetworks,
        device_fingerprints: pattern.deviceFingerprints,
        ip_history: pattern.ipAddressHistory,
        geolocation_history: pattern.geolocationHistory,
        risk_score: pattern.riskScore,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Failed to save behavior pattern:', _error);
    }
  }

  private calculateUpdatedPattern(current: UserBehaviorPattern, newData: any): UserBehaviorPattern {
    // Implement exponential moving average for continuous learning
    const alpha = 0.1; // Learning rate
    
    return {
      ...current,
      averageTransactionAmount: current.averageTransactionAmount * (1 - alpha) + newData.amount * alpha,
      typicalTransactionHours: this.updateTypicalHours(current.typicalTransactionHours, newData.timestamp.getHours()),
      frequentDestinations: this.updateFrequentDestinations(current.frequentDestinations, newData.destinationAddress),
      preferredNetworks: this.updatePreferredNetworks(current.preferredNetworks, newData.network),
      deviceFingerprints: this.updateDeviceFingerprints(current.deviceFingerprints, newData.deviceFingerprint),
      ipAddressHistory: this.updateIpHistory(current.ipAddressHistory, newData.ipAddress),
      lastUpdated: new Date()
    };
  }

  private updateTypicalHours(current: number[], newHour: number): number[] {
    const updated = [...current];
    if (!updated.includes(newHour)) {
      updated.push(newHour);
      // Keep only top 8 most frequent hours
      return updated.slice(-8);
    }
    return updated;
  }

  private updateFrequentDestinations(current: string[], newDestination: string): string[] {
    const updated = [...current];
    if (!updated.includes(newDestination)) {
      updated.push(newDestination);
      // Keep only top 5 most frequent destinations
      return updated.slice(-5);
    }
    return updated;
  }

  private updatePreferredNetworks(current: string[], newNetwork: string): string[] {
    const updated = [...current];
    if (!updated.includes(newNetwork)) {
      updated.push(newNetwork);
      return updated.slice(-3);
    }
    return updated;
  }

  private updateDeviceFingerprints(current: string[], newFingerprint?: string): string[] {
    if (!newFingerprint) return current;
    
    const updated = [...current];
    if (!updated.includes(newFingerprint)) {
      updated.push(newFingerprint);
      return updated.slice(-5); // Keep last 5 devices
    }
    return updated;
  }

  private updateIpHistory(current: string[], newIp: string): string[] {
    const updated = [...current];
    if (!updated.includes(newIp)) {
      updated.push(newIp);
      return updated.slice(-10); // Keep last 10 IPs
    }
    return updated;
  }

  private async logFraudAnalysis(userId: string, analysis: any): Promise<void> {
    try {
      await this.supabase
        .from('fraud_analysis_logs')
        .insert({
          user_id: userId,
          risk_score: analysis.riskScore,
          risk_factors: analysis.riskFactors,
          recommendation: analysis.recommendation,
          ml_prediction: analysis.mlPrediction,
          transaction_data: analysis.transactionData,
          created_at: new Date().toISOString()
        });
    } catch (_error) {
      console.error('❌ Failed to log fraud analysis:', _error);
    }
  }
}

// Export utility functions
export const analyzeFraudRisk = async (userId: string, transactionData: any) => {
  const service = FraudDetectionService.getInstance();
  return service.analyzeTransaction(userId, transactionData);
};

export const updateBehaviorPattern = async (userId: string, transactionData: any) => {
  const service = FraudDetectionService.getInstance();
  return service.updateUserBehaviorPattern(userId, transactionData);
};

// Constants
export const FRAUD_RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export const FRAUD_RECOMMENDATIONS = {
  APPROVE: 'approve',
  REVIEW: 'review',
  BLOCK: 'block'
} as const;