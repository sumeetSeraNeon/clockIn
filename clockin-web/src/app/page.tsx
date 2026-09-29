'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { useAuth } from '@/lib/auth-context';

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    } else if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  return <LoadingScreen message="Loading ClockIn…" />;
}
