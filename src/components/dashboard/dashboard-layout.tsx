'use client';

import { useRouter } from 'next/navigation';
import { useChatStore } from '@/lib/store';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoggedIn } = useChatStore();

  if (!isLoggedIn) {
    router.replace('/login');
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <div className="flex-1 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-1 duration-400">
        {children}
      </div>
    </div>
  );
}
