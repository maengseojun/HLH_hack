"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { AnimatePresence, motion } from 'framer-motion';
import { BlurIn, SlideIn, AnimatedGradientText, Ripple } from "@/components/magicui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle, AlertCircle, Info, Zap, TrendingUp, Wallet, Settings } from "lucide-react";

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  progress?: number;
  walletAddress?: string;
  transactionHash?: string;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-cryptoindex-soft" />;
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    case 'warning':
      return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    case 'info':
      return <Info className="w-5 h-5 text-cryptoindex-highlight" />;
    default:
      return <Info className="w-5 h-5 text-cryptoindex-highlight" />;
  }
};

const getToastStyles = (type: ToastType) => {
  switch (type) {
    case 'success':
      return {
        container: "bg-cryptoindex-soft/20 border-cryptoindex-soft/30",
        title: "text-cryptoindex-soft",
        description: "text-cryptoindex-cream",
        progress: "bg-cryptoindex-soft"
      };
    case 'error':
      return {
        container: "bg-red-500/20 border-red-500/30",
        title: "text-red-400",
        description: "text-cryptoindex-cream",
        progress: "bg-red-400"
      };
    case 'warning':
      return {
        container: "bg-yellow-500/20 border-yellow-500/30",
        title: "text-yellow-400",
        description: "text-cryptoindex-cream",
        progress: "bg-yellow-400"
      };
    case 'info':
      return {
        container: "bg-cryptoindex-highlight/20 border-cryptoindex-highlight/30",
        title: "text-cryptoindex-highlight",
        description: "text-cryptoindex-cream",
        progress: "bg-cryptoindex-highlight"
      };
    default:
      return {
        container: "bg-cryptoindex-accent/20 border-cryptoindex-accent/30",
        title: "text-cryptoindex-accent",
        description: "text-cryptoindex-cream",
        progress: "bg-cryptoindex-accent"
      };
  }
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const styles = getToastStyles(toast.type);
  const icon = getToastIcon(toast.type);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev <= 0) {
            onRemove(toast.id);
            return 0;
          }
          return prev - (100 / ((toast.duration || 5000) / 100));
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [toast.duration, toast.id, onRemove]);

  const handleClose = () => {
    onRemove(toast.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.9 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`
        relative overflow-hidden rounded-lg border backdrop-blur-sm
        ${styles.container}
        shadow-lg shadow-cryptoindex-primary/20
      `}
    >
      <BlurIn duration={0.2}>
        <div className="p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`text-sm font-semibold ${styles.title}`}>
                    {toast.title}
                  </h4>
                  {toast.description && (
                    <p className={`text-xs mt-1 ${styles.description}`}>
                      {toast.description}
                    </p>
                  )}
                  
                  {/* Special content for different toast types */}
                  {toast.walletAddress && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Wallet className="w-3 h-3 text-cryptoindex-warm" />
                      <span className="text-xs text-cryptoindex-warm font-mono">
                        {toast.walletAddress.slice(0, 6)}...{toast.walletAddress.slice(-4)}
                      </span>
                    </div>
                  )}
                  
                  {toast.transactionHash && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Zap className="w-3 h-3 text-cryptoindex-warm" />
                      <span className="text-xs text-cryptoindex-warm font-mono">
                        {toast.transactionHash.slice(0, 10)}...
                      </span>
                      <Badge variant="outline" className="text-xs border-cryptoindex-warm/30 text-cryptoindex-warm">
                        View
                      </Badge>
                    </div>
                  )}
                  
                  {toast.progress !== undefined && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-cryptoindex-warm">
                          Progress
                        </span>
                        <span className="text-xs text-cryptoindex-cream">
                          {Math.round(toast.progress)}%
                        </span>
                      </div>
                      <div className="w-full bg-cryptoindex-medium/20 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-300 ${styles.progress}`}
                          style={{ width: `${toast.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center space-x-2 ml-3">
                  {toast.action && (
                    <Ripple>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toast.action.onClick}
                        className="border-cryptoindex-accent/30 text-cryptoindex-accent hover:bg-cryptoindex-accent hover:text-cryptoindex-primary"
                      >
                        {toast.action.label}
                      </Button>
                    </Ripple>
                  )}
                  
                  <button
                    onClick={handleClose}
                    className="text-cryptoindex-warm hover:text-cryptoindex-cream transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Progress bar for auto-dismiss */}
        {toast.duration && toast.duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-cryptoindex-medium/20">
            <div
              className={`h-full transition-all duration-100 ease-linear ${styles.progress}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </BlurIn>
    </motion.div>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString();
    const newToast: Toast = {
      id,
      duration: 5000,
      ...toast,
    };
    
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const clearAllToasts = () => {
    setToasts([]);
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearAllToasts }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onRemove={removeToast}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Predefined toast functions for common use cases
export const createSuccessToast = (title: string, description?: string, options?: Partial<Toast>) => ({
  type: 'success' as const,
  title,
  description,
  ...options,
});

export const createErrorToast = (title: string, description?: string, options?: Partial<Toast>) => ({
  type: 'error' as const,
  title,
  description,
  ...options,
});

export const createWalletConnectedToast = (walletAddress: string) => ({
  type: 'success' as const,
  title: 'Wallet Connected',
  description: 'Your wallet has been successfully connected to CryptoIndex',
  walletAddress,
  duration: 4000,
});

export const createTransactionToast = (transactionHash: string, status: 'pending' | 'success' | 'failed') => {
  switch (status) {
    case 'pending':
      return {
        type: 'info' as const,
        title: 'Transaction Pending',
        description: 'Your transaction is being processed',
        transactionHash,
        duration: 0, // Don't auto-dismiss
      };
    case 'success':
      return {
        type: 'success' as const,
        title: 'Transaction Successful',
        description: 'Your transaction has been confirmed',
        transactionHash,
        duration: 6000,
      };
    case 'failed':
      return {
        type: 'error' as const,
        title: 'Transaction Failed',
        description: 'Your transaction could not be processed',
        transactionHash,
        duration: 8000,
      };
  }
};

export const createTradingToast = (action: 'buy' | 'sell', token: string, amount: string) => ({
  type: 'success' as const,
  title: `${action === 'buy' ? 'Purchased' : 'Sold'} ${token}`,
  description: `Successfully ${action === 'buy' ? 'bought' : 'sold'} ${amount} ${token}`,
  action: {
    label: 'View Portfolio',
    onClick: () => {
      // Navigate to portfolio
      console.log('Navigate to portfolio');
    }
  },
  duration: 6000,
});

export const createPriceAlertToast = (token: string, price: number, direction: 'up' | 'down') => ({
  type: 'info' as const,
  title: `Price Alert: ${token}`,
  description: `${token} is ${direction === 'up' ? 'above' : 'below'} $${price}`,
  action: {
    label: 'Trade Now',
    onClick: () => {
      // Open trading dialog
      console.log('Open trading dialog');
    }
  },
  duration: 7000,
});