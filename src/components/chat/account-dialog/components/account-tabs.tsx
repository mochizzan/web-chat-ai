import { BarChart3, CreditCard } from 'lucide-react';

interface AccountTabsProps {
  value: 'overview' | 'topup';
  onChange: (value: 'overview' | 'topup') => void;
}

function TabButton({ 
  isActive, 
  onClick, 
  icon, 
  label 
}: { 
  isActive: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
        isActive
          ? 'border-primary/60 text-primary/70'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/30'
      }`}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

export function AccountTabs({ value, onChange }: AccountTabsProps) {
  return (
    <div className="px-6 pb-0">
      <div className="flex items-center gap-1 border-b border-border/20">
        <TabButton 
          isActive={value === 'overview'} 
          onClick={() => onChange('overview')}
          icon={<BarChart3 className="h-3.5 w-3.5" />}
          label="Overview"
        />
        <TabButton 
          isActive={value === 'topup'} 
          onClick={() => onChange('topup')}
          icon={<CreditCard className="h-3.5 w-3.5" />}
          label="Top Up"
        />
      </div>
    </div>
  );
}