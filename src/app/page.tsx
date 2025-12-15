'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { LandingPage } from '@/components/LandingPage';

export default function Page() {
  const { status } = useSession();

  // Show loading while session is being checked
  // If unauthenticated, middleware will redirect to /auth/signin
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-zinc-200 border-t-zinc-600 rounded-full animate-spin" />
      </div>
    );
  }

  // If we get here, user is authenticated (middleware handles redirects)
  return <LandingPage />;
}
