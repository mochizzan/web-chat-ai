'use client';

import { useState } from 'react';
import { DashboardSidebar, type DashboardSection } from '@/components/dashboard/dashboard-sidebar';
import { ApiKeysTab } from '@/components/dashboard/api-keys-tab';
import { DocsTab } from '@/components/dashboard/docs-tab';
import { EndpointsTab } from '@/components/dashboard/endpoints-tab';
import { UsageTab } from '@/components/dashboard/usage-tab';

export default function DashboardPage() {
  const [activeSection, setActiveSection] = useState<DashboardSection>('api-keys');

  const renderContent = () => {
    switch (activeSection) {
      case 'api-keys':
        return <ApiKeysTab />;
      case 'docs':
        return <DocsTab />;
      case 'endpoints':
        return <EndpointsTab />;
      case 'usage':
        return <UsageTab />;
      default:
        return <ApiKeysTab />;
    }
  };

  const sectionTitles: Record<DashboardSection, { title: string; subtitle: string }> = {
    'api-keys': { title: 'API Keys', subtitle: 'Kelola dan buat API key untuk integrasi.' },
    'docs': { title: 'Dokumentasi', subtitle: 'Dokumentasi penggunaan API.' },
    'endpoints': { title: 'Endpoint', subtitle: 'URL endpoint yang tersedia.' },
    'usage': { title: 'Penggunaan', subtitle: 'Pantau pemakaian API key Anda.' },
  };

  const current = sectionTitles[activeSection];

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar panel */}
      <div className="hidden md:block">
        <DashboardSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
      </div>

      <main className="flex-1 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-1 duration-400 overflow-auto">
        {/* Mobile header with sidebar trigger inline */}
        <div className="flex items-center gap-3 mb-6 md:hidden">
          <DashboardSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">{current.title}</h1>
            <p className="text-xs text-muted-foreground">{current.subtitle}</p>
          </div>
        </div>

        {/* Desktop title */}
        <div className="hidden md:block mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{current.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p>
        </div>

        {renderContent()}
      </main>
    </div>
  );
}
