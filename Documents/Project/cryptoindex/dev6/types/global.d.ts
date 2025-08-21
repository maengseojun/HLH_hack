// Global type definitions for mixed JS/TS environment

// Import Privy type extensions
/// <reference path="./privy.d.ts" />

// JavaScript 모듈 선언
declare module '*.js' {
  const content: any;
  export = content;
}

declare module '*.jsx' {
  import { ComponentType } from 'react';
  const component: ComponentType<any>;
  export default component;
}

// 자주 사용되는 JavaScript 유틸리티의 타입 정의
declare module './lib/utils' {
  export function formatDate(date: Date): string;
  export function calculatePrice(amount: number, tax: number): number;
  export const API_BASE_URL: string;
  export function cn(...classes: string[]): string;
}

// Hyperliquid 특화 타입들
declare module './lib/hyperliquid' {
  export interface IndexToken {
    symbol: string;
    weight: number;
    price: number;
    address?: string;
  }
  
  export interface VaultConfig {
    name: string;
    tokens: IndexToken[];
    rebalanceThreshold: number;
    totalSupply?: string;
  }
  
  export interface HyperliquidApiResponse {
    success: boolean;
    data?: any;
    error?: string;
  }
}

// 블록체인 관련 타입들
declare module './lib/blockchain/*' {
  export interface NetworkConfig {
    chainId: number;
    name: string;
    rpcUrl: string;
    blockExplorer?: string;
  }
  
  export interface BalanceInfo {
    token: string;
    balance: string;
    decimals: number;
  }
  
  export interface TransactionResult {
    hash: string;
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
  }
}

// Trading 관련 타입들
declare module './lib/trading/*' {
  export interface Order {
    id: string;
    type: 'buy' | 'sell';
    amount: string;
    price: string;
    status: 'pending' | 'filled' | 'cancelled';
  }
  
  export interface Portfolio {
    totalValue: string;
    positions: Position[];
  }
  
  export interface Position {
    token: string;
    amount: string;
    value: string;
  }
}

// Redis/Orderbook 관련 타입들
declare module './lib/orderbook/*' {
  export interface OrderbookEntry {
    price: string;
    amount: string;
    timestamp: number;
  }
  
  export interface OrderbookSnapshot {
    bids: OrderbookEntry[];
    asks: OrderbookEntry[];
    lastUpdated: number;
  }
}

// 환경 변수 타입 확장
declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_PRIVY_APP_ID: string;
    PRIVY_APP_SECRET: string;
    PRIVY_VERIFICATION_KEY: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    NEXT_PUBLIC_APP_URL: string;
    REDIS_URL?: string;
    HYPERLIQUID_API_URL?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

// Window 객체 확장 (브라우저 환경)
declare global {
  interface Window {
    ethereum?: any;
    privy?: any;
  }
}

// CSS 모듈 지원
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

// 이미지 파일들
declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.svg';
declare module '*.webp';

export {};