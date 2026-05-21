'use client';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/store';

export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoggedIn } = useChatStore();

  if (!isLoggedIn || user?.role !== 'admin') {
    router.replace('/');
    return null; // Tidak ada flash content
  }

  return <>{children}</>;
}