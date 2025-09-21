'use client';

import React from 'react';
import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { privyConfig } from '@/lib/privy/config';

interface PrivyProviderProps {
  children: React.ReactNode;
}

export function PrivyProvider({ children }: PrivyProviderProps) {
  return (
    <PrivyProviderBase {...privyConfig}>
      {children}
    </PrivyProviderBase>
  );
}