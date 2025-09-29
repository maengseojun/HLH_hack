'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.push('/dashboard');
    }
  }, [ready, authenticated, router]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Redirecting to dashboard...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to HLH</h1>
      <p className="text-lg mb-8 text-center max-w-md">
        Connect your wallet or sign in with email to get started.
      </p>
      <button
        onClick={login}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Sign In
      </button>
    </div>
  );
}