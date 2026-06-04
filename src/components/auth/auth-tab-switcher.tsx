import { LogIn, UserPlus } from 'lucide-react';

type AuthTab = 'login' | 'register';

interface AuthTabSwitcherProps {
  activeTab: AuthTab;
  onTabChange: (tab: AuthTab) => void;
}

export function AuthTabSwitcher({ activeTab, onTabChange }: AuthTabSwitcherProps) {
  return (
    <div className="flex rounded-xl bg-muted/40 p-1">
      <button
        onClick={() => onTabChange('login')}
        className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
          activeTab === 'login'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <LogIn className="h-4 w-4" />
        Masuk
      </button>
      <button
        onClick={() => onTabChange('register')}
        className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
          activeTab === 'register'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <UserPlus className="h-4 w-4" />
        Daftar
      </button>
    </div>
  );
}