'use client';

import React, { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LandingPage } from '@/components/LandingPage';

export default function Page() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Client-side fallback: if unauthenticated, redirect to signin
    // This is a backup in case middleware doesn't catch it
    if (status === 'unauthenticated') {
      router.replace('/auth/signin');
    }
  }, [status, router]);

  // Show loading while session is being checked
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  // If unauthenticated, show loading while redirect happens
  if (status === 'unauthenticated') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  // If authenticated, show landing page
  return <LandingPage />;
}
