'use client';

import { useState, useEffect, useCallback } from 'react';
import { Key, Plus, Copy, Check, XCircle, RefreshCw, Eye, EyeOff, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  has_encrypted_key: boolean;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  total_requests: number;
  total_tokens: number;
}

export function ApiKeysTab() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [lastCreatedKey, setLastCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [fullKeys, setFullKeys] = useState<Record<string, string>>({});
  const [loadingFullKey, setLoadingFullKey] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/v1/auth/keys');
      if (!res.ok) throw new Error('Gagal memuat API keys');
      const data = await res.json();
      setKeys(data.data || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      const res = await fetch('/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal membuat API key');
      }
      const data = await res.json();
      const key = data.data?.full_key || null;
      setCreatedKey(key);
      if (key) setLastCreatedKey(key);
      await fetchKeys();
      toast({ title: 'Berhasil', description: 'API key baru telah dibuat' });
    } catch (err) {
      toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/v1/auth/keys?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mencabut API key');
      }
      setShowConfirmRevoke(null);
      await fetchKeys();
      toast({ title: 'Berhasil', description: 'API key telah dinonaktifkan' });
    } catch (err) {
      toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      setRegenerating(id);
      const res = await fetch(`/v1/auth/keys?id=${id}&regenerate=true`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal memperbarui API key');
      }
      const data = await res.json();
      const key = data.data?.full_key || null;
      setCreatedKey(key);
      if (key) setLastCreatedKey(key);
      setShowCreateDialog(true);
      await fetchKeys();
      toast({ title: 'Berhasil', description: 'API key baru telah dibuat' });
    } catch (err) {
      toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRegenerating(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/v1/auth/keys?id=${id}&force=true`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus API key');
      }
      setShowConfirmDelete(null);
      await fetchKeys();
      toast({ title: 'Berhasil', description: 'API key telah dihapus permanen' });
    } catch (err) {
      toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const fetchFullKey = async (keyId: string) => {
    if (fullKeys[keyId]) return;
    try {
      setLoadingFullKey(keyId);
      const res = await fetch(`/v1/auth/keys/${keyId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mendapatkan full key');
      }
      const data = await res.json();
      if (data.data?.full_key) {
        setFullKeys(prev => ({ ...prev, [keyId]: data.data.full_key }));
      }
    } catch (err) {
      toast({ title: 'Gagal', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoadingFullKey(null);
    }
  };

  const handleToggleShow = async (keyId: string) => {
    if (showKeyId === keyId) {
      setShowKeyId(null);
    } else {
      setShowKeyId(keyId);
      if (!fullKeys[keyId]) {
        await fetchFullKey(keyId);
      }
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Gagal', description: 'Tidak dapat menyalin ke clipboard', variant: 'destructive' });
    }
  };

  const dismissLastKey = () => {
    setLastCreatedKey(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchKeys}>Coba Lagi</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {lastCreatedKey && (
        <Card className="border-green-500/50 bg-green-500/5 mb-4">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                  ✅ API Key Terakhir Dibuat
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Simpan key ini. Anda tidak akan bisa melihatnya lagi.
                </p>
                <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
                  <code className="flex-1 text-xs break-all font-mono select-all">{lastCreatedKey}</code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(lastCreatedKey, '__last_key__')}
                  >
                    {copiedId === '__last_key__' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={dismissLastKey}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>
              Kelola API key untuk akses ke endpoint OpenAI-compatible. Maksimal 5 key aktif.
            </CardDescription>
          </div>
          <Button onClick={() => { setNewKeyName(''); setCreatedKey(null); setShowCreateDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Buat Key Baru
          </Button>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Key className="h-8 w-8" />
              <p className="text-sm">Belum ada API key. Buat key pertama Anda.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-accent/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{key.name || '(tanpa nama)'}</span>
                      <Badge variant={key.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {key.is_active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono select-all">
                        {showKeyId === key.id && fullKeys[key.id]
                          ? fullKeys[key.id]
                          : loadingFullKey === key.id
                            ? `${key.key_prefix}...`
                            : `${key.key_prefix}...`}
                      </code>
                      {key.has_encrypted_key ? (
                        <button
                          onClick={() => handleToggleShow(key.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title={showKeyId === key.id ? 'Sembunyikan full key' : 'Tampilkan full key'}
                        >
                          {showKeyId === key.id ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </button>
                      ) : (
                        <button
                          className="text-muted-foreground/40 cursor-not-allowed"
                          title="Full key tidak tersedia (key lama)"
                        >
                          <EyeOff className="h-3 w-3 opacity-40" />
                        </button>
                      )}
                      <button
                        onClick={() => copyToClipboard(
                          showKeyId === key.id && fullKeys[key.id] ? fullKeys[key.id] : key.key_prefix,
                          key.id
                        )}
                        className="text-muted-foreground hover:text-foreground"
                        title={showKeyId === key.id && fullKeys[key.id] ? 'Salin full key' : 'Salin prefix key'}
                      >
                        {copiedId === key.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Digunakan {key.total_requests} kali &middot; {key.total_tokens} token &middot;
                      Dibuat {new Date(key.created_at).toLocaleDateString('id-ID')}
                      {key.last_used_at && ` &middot; Terakhir ${new Date(key.last_used_at).toLocaleDateString('id-ID')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {key.is_active ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRegenerate(key.id)}
                          disabled={regenerating === key.id}
                          title="Regenerate"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${regenerating === key.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setShowConfirmRevoke(key.id)}
                          title="Nonaktifkan"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setShowConfirmDelete(key.id)}
                        title="Hapus permanen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedKey(null);
            setNewKeyName('');
          }
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="sm:max-w-md" onInteractOutside={(e) => {
          // Prevent closing by clicking outside when showing a key
          if (createdKey) e.preventDefault();
        }}>
          {createdKey ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-500" />
                  API Key Berhasil Dibuat
                </DialogTitle>
                <DialogDescription>
                  Salin key ini sekarang. Anda tidak akan bisa melihatnya lagi setelah dialog ini ditutup.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <code className="block text-xs break-all font-mono bg-background rounded border p-3 select-all">
                  {createdKey}
                </code>
                <Button
                  variant="default"
                  className="w-full gap-2"
                  onClick={() => copyToClipboard(createdKey, '__create_key__')}
                >
                  {copiedId === '__create_key__' ? (
                    <>
                      <Check className="h-4 w-4" />
                      Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Salin API Key
                    </>
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowCreateDialog(false); setCreatedKey(null); }}>
                  Tutup
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Buat API Key Baru</DialogTitle>
                <DialogDescription>
                  Beri nama untuk membedakan key Anda (opsional).
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  placeholder="Misal: Production, Development"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !creating) handleCreate(); }}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowCreateDialog(false); setNewKeyName(''); }}>
                  Batal
                </Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Membuat...
                    </>
                  ) : (
                    'Buat Key'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Revoke Dialog */}
      <Dialog open={!!showConfirmRevoke} onOpenChange={() => setShowConfirmRevoke(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nonaktifkan API Key?</DialogTitle>
            <DialogDescription>
              Key yang dinonaktifkan tidak bisa digunakan lagi. Anda bisa mengaktifkannya kembali dengan regenerate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmRevoke(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => handleRevoke(showConfirmRevoke!)}>
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!showConfirmDelete} onOpenChange={() => setShowConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus API Key?</DialogTitle>
            <DialogDescription>
              Tindakan ini permanen dan tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDelete(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => handleDelete(showConfirmDelete!)}>
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
