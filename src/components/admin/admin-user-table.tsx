'use client';


import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, Wallet, X } from 'lucide-react';

// Format currency with 8 decimals
function formatCurrency8(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  if (isNaN(num)) return '$0.00000000';
  return `$${num.toFixed(8)}`;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  credit: number;
  totalSpent: number;
  createdAt: string;
}

interface AdminUserTableProps {
  users: User[];
  isLoading: boolean;
  currentUser: { id: string } | null;
  creditUserId: string | null;
  creditAmount: string;
  onSetCreditUser: (id: string) => void;
  onCreditAmountChange: (value: string) => void;
  onSetCredit: (id: string, amount: number) => void;
  onAddCredit: (id: string, amount: number) => void;
  onCancelCredit: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalUsers: number;
}

export function AdminUserTable({
  users,
  isLoading,
  currentUser,
  creditUserId,
  creditAmount,
  onSetCreditUser,
  onCreditAmountChange,
  onSetCredit,
  onAddCredit,
  onCancelCredit,
  searchQuery,
  onSearchChange,
  currentPage,
  totalPages,
  onPageChange,
  totalUsers,
}: AdminUserTableProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Manajemen Pengguna</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isLoading ? 'Memuat pengguna...' : `Menampilkan ${users.length} dari ${totalUsers} pengguna terdaftar`}
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <Input
          placeholder="Cari nama atau email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-9 text-sm"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        {users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Tidak ada pengguna yang cocok</p>
          </div>
        ) : (
          <Table className="w-full">
            <TableCaption>
              Daftar pengguna dalam sistem
            </TableCaption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-left w-[20%]">Informasi Pengguna</TableHead>
                <TableHead className="text-center">Kredit</TableHead>
                <TableHead className="text-center">Total Spent</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isCurrentUser = currentUser?.id === user.id;
                
                return (
                  <TableRow key={user.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-4">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-full font-bold text-sm shrink-0 ${
                          user.role === 'admin'
                            ? 'bg-muted/40 text-foreground'
                            : 'bg-muted/30 text-muted-foreground'
                        }`}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{user.name}</p>
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                Wallet
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                User
                              </span>
                            )}
                            {isCurrentUser && (
                              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                Anda
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground/60">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Kredit</p>
                        <p className="text-sm font-bold font-mono text-foreground">{formatCurrency8(user.credit)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Total Spent</p>
                        <p className="text-sm font-bold font-mono text-muted-foreground">{formatCurrency8(user.totalSpent)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {creditUserId === user.id ? (
                          <>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Jumlah"
                              value={creditAmount}
                              onChange={(e) => onCreditAmountChange(e.target.value)}
                              className="h-8 w-32 text-xs"
                            />
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => onSetCredit(user.id, parseFloat(creditAmount) || 0)}
                            >
                              Set
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => onAddCredit(user.id, parseFloat(creditAmount) || 0)}
                            >
                              +Tambah
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={onCancelCredit}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => onSetCreditUser(user.id)}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Atur Kredit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
            >
              <ArrowLeft className="h-3 w-3" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || isLoading}
            >
              Berikutnya
              <ArrowLeft className="h-3 w-3 rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}