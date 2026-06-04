import { Wallet, LogIn, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { UserProfile } from '@/lib/store';
import { getInitials } from '../utils';

interface AccountHeaderProps {
  isLoggedIn: boolean;
  user: UserProfile | null;
  onLoginClick: () => void;
}

export function AccountHeader({ isLoggedIn, user, onLoginClick }: AccountHeaderProps) {
  return (
    <div className="px-5 pr-10 pt-4 pb-2 flex items-center gap-3">
      {/* Title & icon */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Wallet className="h-4 w-4 text-primary/70" />
        </div>
        <div>
          <DialogTitle className="text-sm font-bold text-foreground">
            Akun & Penggunaan
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground/60 mt-0">
            Kelola kredit & pantau penggunaan
          </DialogDescription>
        </div>
      </div>

      {/* Profile or Login button */}
      {isLoggedIn && user ? (
        <div className="flex items-center gap-2 ml-auto pl-3 border-l border-border/20 rounded-lg bg-muted/20 border border-border/15 px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary/70 font-bold text-[10px] shrink-0">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-semibold text-foreground truncate max-w-[120px]">{user.name}</p>
              {user.role === 'admin' ? (
                <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0 text-[8px] font-bold uppercase tracking-wider text-primary/80 shrink-0">
                  <Shield className="h-2 w-2" />
                  Admin
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-muted-foreground/50 truncate max-w-[140px]">{user.email}</p>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px] ml-auto rounded-lg px-3"
          onClick={onLoginClick}
        >
          <LogIn className="h-3 w-3" />
          Masuk
        </Button>
      )}
    </div>
  );
}