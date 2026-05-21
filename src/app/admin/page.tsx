'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { AdminRouteGuard } from '@/components/auth/admin-route-guard';
import { AdminUserTable } from '@/components/admin/admin-user-table';
import { AdminModelsTable } from '@/components/admin/admin-models-table';
import { AdminOverview } from '@/components/admin/admin-overview';
import { AdminLogsView } from '@/components/admin/admin-logs-view';
import { AdminSettingsPanel } from '@/components/admin/admin-settings-panel';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { useAdminModels } from '@/hooks/useAdminModels';
import type { AdminSection, AdminUser } from '@/lib/admin-types';

const SIDEBAR_ITEMS: { id: AdminSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'models', label: 'Models' },
  { id: 'users', label: 'Users' },
  { id: 'logs', label: 'Logs' },
  { id: 'settings', label: 'Settings' },
];

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoggedIn } = useChatStore();
  const { models, fetchModels, deleteModel, toggleFreeStatus, syncModels, isSyncing } = useAdminModels();
  const { fetchUsers, setCredit, addCredit, isLoadingUsers } = useAdminUsers();

  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [creditUserId, setCreditUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPage, setUsersPage] = useState(1);
  const usersLimit = 10;
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Fetch models on mount
  useEffect(() => {
    fetchModels(true);
  }, [fetchModels]);

  // Fetch users when needed
  useEffect(() => {
    async function loadUsers() {
      try {
        const data = await fetchUsers(usersPage, usersLimit, userSearchQuery);
        setUsers(data.users);
        setUsersTotal(data.total);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    }
    loadUsers();
  }, [usersPage, usersLimit, userSearchQuery, fetchUsers]);

  const handlePullModels = async () => {
    await syncModels();
  };

  const handleRemoveModel = async (modelId: string) => {
    await deleteModel(modelId);
  };

  const handleToggleFree = async (modelId: string) => {
    const model = models.find((m) => m.id === modelId);
    if (!model) return;
    await toggleFreeStatus(modelId, model.free);
  };

  const handleSetCredit = async (userId: string) => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount < 0) {
      return;
    }
    const result = await setCredit(userId, amount);
    if (result.success) {
      setCreditUserId(null);
      setCreditAmount('');
    }
  };

  const handleAddCredit = async (userId: string) => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      return;
    }
    const result = await addCredit(userId, amount);
    if (result.success) {
      setCreditUserId(null);
      setCreditAmount('');
    }
  };

  if (!isLoggedIn || user?.role !== 'admin') {
    return null;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverview />;
      case 'models':
        return (
          <AdminModelsTable
            models={models}
            onToggleFree={handleToggleFree}
            onRemove={handleRemoveModel}
            onPullModels={handlePullModels}
            isSyncing={isSyncing}
          />
        );
      case 'users':
        return (
          <AdminUserTable
            users={users}
            isLoading={isLoadingUsers}
            currentUser={user}
            creditUserId={creditUserId}
            creditAmount={creditAmount}
            onSetCreditUser={(userId) => {
              setCreditUserId(userId);
              setCreditAmount('');
            }}
            onCreditAmountChange={setCreditAmount}
            onSetCredit={handleSetCredit}
            onAddCredit={handleAddCredit}
            onCancelCredit={() => setCreditUserId(null)}
            searchQuery={userSearchQuery}
            onSearchChange={(q) => {
              setUserSearchQuery(q);
              setUsersPage(1);
            }}
            currentPage={usersPage}
            totalPages={Math.ceil(usersTotal / usersLimit)}
            onPageChange={setUsersPage}
            totalUsers={usersTotal}
          />
        );
      case 'logs':
        return <AdminLogsView />;
      case 'settings':
        return <AdminSettingsPanel />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden">
      {/* Left Mini Sidebar */}
      <aside className="w-16 shrink-0 flex flex-col items-center border-r border-border/40 bg-sidebar py-4 gap-2">
        {/* Logo */}
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 mb-4">
          <Bot className="h-5 w-5 text-foreground" />
        </div>
        {/* Nav Items */}
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              {item.label.charAt(0)}
            </button>
          );
        })}
        {/* Spacer */}
        <div className="flex-1" />
        {/* Back to chat */}
        <button
          onClick={() => router.push('/')}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
          title="Kembali ke Chat"
          aria-label="Kembali ke Chat"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 shrink-0 flex items-center justify-between border-b border-border/40 px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-foreground">Control Panel</h1>
            <Badge variant="secondary" className="text-[10px] bg-muted/60 text-muted-foreground">
              Admin
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/30 text-muted-foreground text-xs font-bold">
                {user?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <span className="text-xs font-medium text-foreground">{user?.name}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke Chat
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-6 animate-in fade-in slide-in-from-bottom-1 duration-400">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
