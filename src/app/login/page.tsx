'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { LogIn, UserPlus, ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useChatDataStore, UserProfile } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useAuthForm } from '@/hooks/useAuthForm';
import { useAuthValidation } from '@/hooks/useAuthValidation';
import { usePageTitle } from '@/hooks/usePageTitle';
import { loginUser, registerUser, resendVerification } from '@/services/auth-api';
import { AuthHeader } from '@/components/auth/auth-header';
import { AuthTabSwitcher } from '@/components/auth/auth-tab-switcher';
import { AuthFormField } from '@/components/auth/auth-form-field';
import { EmailVerificationDialog } from '@/components/auth/email-verification-dialog';

export default function LoginPage() {
  // 0. Dynamic page title
  usePageTitle('Sign In');

  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn, login, setCredit } = useChatDataStore();
  
  const {
    activeTab, email, setEmail, password, setPassword, name, setName,
    showPassword, setShowPassword, loading, setLoading, errors, setErrors,
    clearFieldError, switchTab, resetForm
  } = useAuthForm();
  
  const { validateLogin, validateRegister } = useAuthValidation();
  const pageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // State for email verification dialog
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

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

  const handleLogin = async () => {
    const validationErrors = validateLogin(email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    try {
      const json = await loginUser(email, password);
      if (json.success) {
        const userData = json.data?.user;
        if (userData) {
          login(userData);
          // Credit is set separately from user data
          toast({ title: 'Berhasil Masuk', description: 'Selamat datang kembali!' });
          router.push('/');
        }
      } else {
        const message = json.error?.message || json.message || 'Email atau password salah';
        
        if (message.toLowerCase().includes('belum diverifikasi')) {
          setVerificationEmail(email);
          setShowVerification(true);
          // Auto-resend OTP so user immediately receives a fresh code
          resendVerification(email).then(() => {
            toast({
              title: 'Kode Terkirim',
              description: 'Kode verifikasi baru telah dikirim ke email Anda',
            });
          }).catch(() => {
            toast({
              title: 'Gagal Mengirim Kode',
              description: 'Gagal mengirim ulang kode verifikasi. Klik "Kirim Ulang" untuk mencoba lagi.',
              variant: 'destructive',
            });
          });
        } else {
          toast({ title: 'Gagal Masuk', description: message, variant: 'destructive' });
          setErrors({ [message.toLowerCase().includes('email') ? 'email' : 'password']: message });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan sistem saat login', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const validationErrors = validateRegister(name, email, password);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setLoading(true);
    try {
      const json = await registerUser(name, email, password);
      if (json.success) {
        // Check if verification is needed
        if (json.data?.needsVerification) {
          setVerificationEmail(email);
          setShowVerification(true);
          toast({
            title: 'Akun Dibuat!',
            description: `Kode verifikasi telah dikirim ke ${email}`
          });
        } else {
          const userData = json.data?.user;
          if (userData) {
            login(userData);
            toast({ title: 'Akun Dibuat!', description: `Selamat datang, ${name.trim()}!` });
            router.push('/');
          }
        }
      } else {
        const message = json.message || 'Gagal membuat akun';
        toast({ title: 'Gagal Mendaftar', description: message, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan sistem saat mendaftar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      activeTab === 'login' ? handleLogin() : handleRegister();
    }
  };

  // Show verification dialog if needed
  if (showVerification) {
    return <EmailVerificationDialog email={verificationEmail} onVerified={() => {
      resetForm();
      setVerificationEmail('');
      switchTab('login');
      setShowVerification(false);
    }} />;
  }

  return (
    <div ref={pageRef} className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/3 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/3 blur-3xl" />
      </div>

      <div ref={cardRef} className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <AuthHeader />

          {/* Tab Switcher */}
          <div className="px-8 pb-2">
            <AuthTabSwitcher activeTab={activeTab} onTabChange={switchTab} />
          </div>

          {/* Form */}
          <div className="px-8 pt-4 pb-6">
            <div className="space-y-4">
              {activeTab === 'register' && (
                <AuthFormField
                  id="name"
                  label="Nama Lengkap"
                  value={name}
                  placeholder="Masukkan nama lengkap"
                  error={errors.name}
                  onChange={(val) => { setName(val); clearFieldError('name'); }}
                  onKeyDown={handleKeyDown}
                  autoComplete="name"
                />
              )}

              <AuthFormField
                id="email"
                label="Email"
                type="text"
                value={email}
                placeholder="Masukkan email"
                error={errors.email}
                onChange={(val) => { setEmail(val); clearFieldError('email'); }}
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />

              <AuthFormField
                id="password"
                label="Password"
                value={password}
                placeholder="Masukkan password"
                error={errors.password}
                showPasswordToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
                onChange={(val) => { setPassword(val); clearFieldError('password'); }}
                onKeyDown={handleKeyDown}
                autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
              />

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