// components/security/BehaviorTracker.tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import crypto from 'crypto';

interface BehaviorTrackerProps {
  enabled?: boolean;
  sessionId?: string;
  onAnomalyDetected?: (anomaly: any) => void;
}

interface ActivityEvent {
  action: string;
  resource?: string;
  metadata?: any;
  processingTime?: number;
  outcome: 'success' | 'failure' | 'partial';
}

export default function BehaviorTracker({ 
  enabled = true, 
  sessionId,
  onAnomalyDetected 
}: BehaviorTrackerProps) {
  const { user, ready } = usePrivy();
  const currentSessionId = useRef<string>(sessionId || crypto.randomUUID());
  const isTracking = useRef<boolean>(false);
  const activityQueue = useRef<ActivityEvent[]>([]);
  const lastActivity = useRef<Date>(new Date());
  const mousePositions = useRef<{ x: number; y: number; timestamp: number }[]>([]);
  const keystrokes = useRef<{ key: string; timestamp: number; duration?: number }[]>([]);

  // Initialize behavior tracking
  useEffect(() => {
    if (!enabled || !ready || !user) return;

    startBehaviorTracking();

    return () => {
      endBehaviorTracking();
    };
  }, [enabled, ready, user]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled || !isTracking.current) return;

    const handleMouseMove = (event: MouseEvent) => {
      mousePositions.current.push({
        x: event.clientX,
        y: event.clientY,
        timestamp: Date.now()
      });

      // Keep only last 100 positions
      if (mousePositions.current.length > 100) {
        mousePositions.current.shift();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      keystrokes.current.push({
        key: event.key.length === 1 ? 'char' : event.key,
        timestamp: Date.now()
      });

      // Keep only last 50 keystrokes
      if (keystrokes.current.length > 50) {
        keystrokes.current.shift();
      }
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      trackActivity({
        action: 'click',
        resource: target.tagName.toLowerCase(),
        metadata: {
          elementId: target.id,
          className: target.className,
          position: { x: event.clientX, y: event.clientY }
        },
        outcome: 'success'
      });
    };

    const handleFormSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      trackActivity({
        action: 'form_submit',
        resource: form.action || window.location.pathname,
        metadata: {
          formId: form.id,
          method: form.method
        },
        outcome: 'success'
      });
    };

    const handlePageVisibility = () => {
      if (document.hidden) {
        trackActivity({
          action: 'page_blur',
          outcome: 'success'
        });
      } else {
        trackActivity({
          action: 'page_focus',
          outcome: 'success'
        });
      }
    };

    const handleBeforeUnload = () => {
      trackActivity({
        action: 'page_unload',
        outcome: 'success'
      });
      endBehaviorTracking();
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('keydown', handleKeyDown, { passive: true });
    document.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('submit', handleFormSubmit);
    document.addEventListener('visibilitychange', handlePageVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('submit', handleFormSubmit);
      document.removeEventListener('visibilitychange', handlePageVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled]);

  const startBehaviorTracking = async () => {
    if (!user || isTracking.current) return;

    try {
      const deviceFingerprint = await generateDeviceFingerprint();
      const geolocation = await getCurrentLocation();

      const response = await fetch('/api/security/behavior', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start_session',
          sessionId: currentSessionId.current,
          deviceFingerprint,
          geolocation
        }),
      });

      if (response.ok) {
        isTracking.current = true;
        console.log('✅ Behavior tracking started');
        
        // Track initial page load
        trackActivity({
          action: 'page_load',
          resource: window.location.pathname,
          metadata: {
            referrer: document.referrer,
            userAgent: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            colorDepth: screen.colorDepth,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          outcome: 'success'
        });

        // Start periodic batch sending
        startActivityBatching();
      }
    } catch (error) {
      console.error('❌ Failed to start behavior tracking:', error);
    }
  };

  const endBehaviorTracking = async () => {
    if (!isTracking.current) return;

    try {
      // Send any remaining activities
      await flushActivityQueue();

      const response = await fetch('/api/security/behavior', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'end_session',
          sessionId: currentSessionId.current
        }),
      });

      if (response.ok) {
        isTracking.current = false;
        console.log('✅ Behavior tracking ended');
      }
    } catch (error) {
      console.error('❌ Failed to end behavior tracking:', error);
    }
  };

  const trackActivity = useCallback((activity: ActivityEvent) => {
    if (!isTracking.current) return;

    const enhancedActivity = {
      ...activity,
      timestamp: new Date(),
      processingTime: activity.processingTime || Date.now() - lastActivity.current.getTime(),
      metadata: {
        ...activity.metadata,
        mouseVelocity: calculateMouseVelocity(),
        typingSpeed: calculateTypingSpeed(),
        timeOnPage: Date.now() - lastActivity.current.getTime()
      }
    };

    activityQueue.current.push(enhancedActivity);
    lastActivity.current = new Date();

    // Send immediately if it's a critical action
    if (isCriticalAction(activity.action)) {
      flushActivityQueue();
    }
  }, []);

  const startActivityBatching = () => {
    // Send activities every 30 seconds
    setInterval(() => {
      if (activityQueue.current.length > 0) {
        flushActivityQueue();
      }
    }, 30000);
  };

  const flushActivityQueue = async () => {
    if (activityQueue.current.length === 0) return;

    const activities = [...activityQueue.current];
    activityQueue.current = [];

    try {
      for (const activity of activities) {
        const response = await fetch('/api/security/behavior', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'track_activity',
            sessionId: currentSessionId.current,
            activity
          }),
        });

        if (!response.ok) {
          console.error('❌ Failed to send activity:', activity);
        }
      }

      // Check for anomalies after sending activities
      await checkForAnomalies(activities);
    } catch (error) {
      console.error('❌ Failed to flush activity queue:', error);
      // Re-add activities to queue for retry
      activityQueue.current.unshift(...activities);
    }
  };

  const checkForAnomalies = async (activities: ActivityEvent[]) => {
    if (!onAnomalyDetected) return;

    try {
      const response = await fetch('/api/security/behavior', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'detect_anomalies',
          currentActivity: activities[activities.length - 1]
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.anomalies.length > 0) {
          data.anomalies.forEach((anomaly: any) => {
            onAnomalyDetected(anomaly);
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to check for anomalies:', error);
    }
  };

  const generateDeviceFingerprint = async (): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillText('Device fingerprinting', 2, 2);
    }
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}`,
      colorDepth: screen.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL(),
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack
    };

    // Create hash of fingerprint
    const fingerprintString = JSON.stringify(fingerprint);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const getCurrentLocation = (): Promise<any> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        () => {
          resolve(null);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    });
  };

  const calculateMouseVelocity = (): number => {
    const positions = mousePositions.current;
    if (positions.length < 2) return 0;

    const recent = positions.slice(-10); // Last 10 positions
    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 1; i < recent.length; i++) {
      const dx = recent[i].x - recent[i - 1].x;
      const dy = recent[i].y - recent[i - 1].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const time = recent[i].timestamp - recent[i - 1].timestamp;

      totalDistance += distance;
      totalTime += time;
    }

    return totalTime > 0 ? totalDistance / totalTime : 0;
  };

  const calculateTypingSpeed = (): number => {
    const strokes = keystrokes.current;
    if (strokes.length < 2) return 0;

    const recent = strokes.slice(-20); // Last 20 keystrokes
    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    
    return timeSpan > 0 ? (recent.length / timeSpan) * 60000 : 0; // WPM
  };

  const isCriticalAction = (action: string): boolean => {
    const criticalActions = [
      'form_submit',
      'page_unload',
      'transaction_initiated',
      'password_change',
      'security_setting_change'
    ];
    return criticalActions.includes(action);
  };

  // Expose public methods for manual tracking
  const publicAPI = {
    trackCustomActivity: trackActivity,
    trackTransaction: (transactionData: any) => {
      trackActivity({
        action: 'transaction_initiated',
        resource: 'withdrawal',
        metadata: transactionData,
        outcome: 'success'
      });
    },
    trackSecurityEvent: (eventType: string, metadata: any) => {
      trackActivity({
        action: `security_${eventType}`,
        metadata,
        outcome: 'success'
      });
    }
  };

  // Store public API in global scope for use by other components
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).behaviorTracker = publicAPI;
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}

// Utility hook for other components to use behavior tracking
export function useBehaviorTracking() {
  const trackCustomActivity = useCallback((activity: ActivityEvent) => {
    if (typeof window !== 'undefined' && (window as any).behaviorTracker) {
      (window as any).behaviorTracker.trackCustomActivity(activity);
    }
  }, []);

  const trackTransaction = useCallback((transactionData: any) => {
    if (typeof window !== 'undefined' && (window as any).behaviorTracker) {
      (window as any).behaviorTracker.trackTransaction(transactionData);
    }
  }, []);

  const trackSecurityEvent = useCallback((eventType: string, metadata: any) => {
    if (typeof window !== 'undefined' && (window as any).behaviorTracker) {
      (window as any).behaviorTracker.trackSecurityEvent(eventType, metadata);
    }
  }, []);

  return {
    trackCustomActivity,
    trackTransaction,
    trackSecurityEvent
  };
}