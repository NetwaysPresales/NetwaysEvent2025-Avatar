'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/LandingPage';

export default function Page() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If session check is complete and user is not authenticated, redirect to signin
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  // Show nothing while checking session or if unauthenticated (will redirect)
  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Only render landing page if authenticated
  if (status === 'authenticated' && session) {
    return <LandingPage />;
  }

  return null;
}
