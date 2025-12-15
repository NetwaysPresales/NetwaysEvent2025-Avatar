'use client';

import { Suspense } from 'react';
import { AuthPage } from '@/components/AuthPage';

function AuthPageWrapper() {
  return <AuthPage />;
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
      <AuthPageWrapper />
    </Suspense>
  );
}

