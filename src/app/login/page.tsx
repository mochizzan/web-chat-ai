'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';

import { Bot, LogIn, UserPlus, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useChatDataStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

type AuthTab = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  
  const { toast } = useToast();
  const { isLoggedIn, login, setCredit } = useChatDataStore();

  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  // GSAP entrance animations
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (cardRef.current) {
        gsap.fromTo(
          cardRef.current,
          { opacity: 0, y: 30, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out' }
        );
      }
    }, pageRef);
    return () => ctx.revert();
  }, []);

  // Validate login form
  const validateLogin = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Format email tidak valid (contoh: user@mail.com)';
    }
    if (!password.trim()) {
      newErrors.password = 'Password wajib diisi';
    } else if (password.length < 3) {
      newErrors.password = 'Password minimal 3 karakter';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  // Validate register form
  const validateRegister = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) {
      newErrors.name = 'Nama wajib diisi';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Nama minimal 2 karakter';
    }
    if (!email.trim()) {
      newErrors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/^[a-zA-Z0-9_]+$/.test(email)) {
      newErrors.email = 'Format email tidak valid';
    }
    if (!password.trim()) {
      newErrors.password = 'Password wajib diisi';
    } else if (password.length < 3) {
      newErrors.password = 'Password minimal 3 karakter';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, email, password]);

  // Handle login — calls /api/auth directly (loginUser removed from store)
  const handleLogin = useCallback(async () => {
    if (!validateLogin()) return;
    setLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email: email.trim(), password }),
      });
      const json = await response.json();

      if (response.ok) {
        const payload = json.data || json;
        const userData = payload.user;
        login(userData);
        setCredit(userData?.credit ?? 0);
        toast({ title: 'Berhasil Masuk', description: 'Selamat datang kembali!' });
        router.push('/');
      } else {
        const message = json.message || 'Email atau password salah';
        toast({ title: 'Gagal Masuk', description: message, variant: 'destructive' });
        const fieldErrors: Record<string, string> = {};
        if (message.toLowerCase().includes('email')) {
          fieldErrors.email = message;
        } else {
          fieldErrors.password = message;
        }
        setErrors(fieldErrors);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan sistem saat login',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [email, password, validateLogin, login, setCredit, router, toast]);

  // Handle register — calls /api/auth directly (registerUser removed from store)
  const handleRegister = useCallback(async () => {
    if (!validateRegister()) return;
    setLoading(true);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', name: name.trim(), email: email.trim(), password }),
      });
      const json = await response.json();

      if (response.ok) {
        const payload = json.data || json;
        const userData = payload.user;
        login(userData);
        setCredit(userData?.credit ?? 0);
        toast({ title: 'Akun Dibuat!', description: `Selamat datang, ${name.trim()}!` });
        router.push('/');
      } else {
        const message = json.message || 'Gagal membuat akun';
        toast({ title: 'Gagal Mendaftar', description: message, variant: 'destructive' });
        const fieldErrors: Record<string, string> = {};
        if (message.toLowerCase().includes('email')) {
          fieldErrors.email = message;
        } else if (message.toLowerCase().includes('nama')) {
          fieldErrors.name = message;
        } else if (message.toLowerCase().includes('password')) {
          fieldErrors.password = message;
        } else {
          fieldErrors.email = message;
        }
        setErrors(fieldErrors);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan sistem saat mendaftar',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [name, email, password, validateRegister, login, setCredit, router, toast]);

  // Handle Enter key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (activeTab === 'login') handleLogin();
        else handleRegister();
      }
    },
    [activeTab, handleLogin, handleRegister]
  );

  // Switch tab - clear errors
  const switchTab = useCallback((tab: AuthTab) => {
    setActiveTab(tab);
    setErrors({});
  }, []);

  return (
    <div
      ref={pageRef}
      className="flex min-h-dvh w-full items-center justify-center bg-background p-4"
    >
      {/* Background decoration - subtle */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/3 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/3 blur-3xl" />
      </div>

      {/* Login Card */}
      <div
        ref={cardRef}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
              <Bot className="h-7 w-7 text-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              MI-Labs Chat
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Masuk ke akun Anda untuk memulai
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="px-8 pb-2">
            <div className="flex rounded-xl bg-muted/40 p-1">
              <button
                onClick={() => switchTab('login')}
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
                onClick={() => switchTab('register')}
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
          </div>

          {/* Form */}
          <div className="px-8 pt-4 pb-6">
            <div className="space-y-4">
              {/* Name field (register only) */}
              {activeTab === 'register' && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-semibold text-muted-foreground">
                    Nama Lengkap
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Masukkan nama lengkap"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: '' }));
                    }}
                    onKeyDown={handleKeyDown}
                    className={`h-11 text-sm ${errors.name ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                    autoComplete="name"
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name}</p>
                  )}
                </div>
              )}

              {/* Email field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="Masukkan email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                  }}
                  onKeyDown={handleKeyDown}
                  className={`h-11 text-sm ${errors.email ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: '' }));
                    }}
                    onKeyDown={handleKeyDown}
                    className={`h-11 text-sm pr-10 ${errors.password ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
                    autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Submit button */}
              <Button
                className="w-full h-11 text-sm font-bold"
                onClick={activeTab === 'login' ? handleLogin : handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Memproses...
                  </span>
                ) : activeTab === 'login' ? (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Masuk
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Daftar
                  </span>
                )}
              </Button>
            </div>

          </div>

          {/* Back to chat link */}
          <div className="border-t border-border/30 px-8 py-4">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke Chat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
