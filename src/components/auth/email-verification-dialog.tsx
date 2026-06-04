'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, RefreshCw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { verifyEmail, resendVerification } from '@/services/auth-api';

interface EmailVerificationDialogProps {
  email: string;
  onVerified?: () => void;
}

export function EmailVerificationDialog({ email, onVerified }: EmailVerificationDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [resendCount, setResendCount] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digit characters
    const digit = value.replace(/\D/g, '').slice(0, 1);
    if (!digit && value !== '') return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    // Extract only digits, max 6 characters
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    // Reset OTP array before filling (prevents old digits lingering)
    const newOtp = ['', '', '', '', '', ''];
    for (let i = 0; i < digits.length; i++) {
      newOtp[i] = digits[i];
    }
    setOtp(newOtp);

    // Auto-focus last filled input or stay at index 0
    if (digits.length > 0) {
      inputRefs.current[Math.min(digits.length - 1, 5)]?.focus();
    }

    // Auto-submit if 6 digits pasted
    if (digits.length === 6) {
      setTimeout(() => handleSubmit(), 150);
    }
  };

  const handleSubmit = async () => {
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast({ title: 'Error', description: 'Masukkan kode OTP lengkap', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const json = await verifyEmail(email, otpValue);
      if (json.success) {
        toast({ title: 'Berhasil!', description: 'Email Anda telah terverifikasi' });
        setIsVerified(true);
        onVerified?.();
      } else {
        toast({ title: 'Gagal', description: json.error?.message || json.message || 'Kode OTP tidak valid', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan saat verifikasi', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setResendLoading(true);
    try {
      const json = await resendVerification(email);
      if (json.success) {
        const nextCount = resendCount + 1;
        setResendCount(nextCount);
        toast({ title: 'Terkirim', description: 'Kode verifikasi baru telah dikirim ke email Anda' });
        setCountdown(nextCount * 60);
      } else {
        toast({ title: 'Gagal', description: json.error?.message || json.message || 'Gagal mengirim ulang kode', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Terjadi kesalahan saat mengirim ulang', variant: 'destructive' });
    } finally {
      setResendLoading(false);
    }
  };

  if (isVerified) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-8 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 mb-4">
            <Shield className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Verifikasi Berhasil!</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Email Anda telah berhasil diverifikasi. Sekarang Anda dapat masuk ke akun Anda.
          </p>
          <Button
            className="w-full h-11"
            onClick={() => {
              onVerified?.();
              router.push('/login');
            }}
          >
            Lanjutkan ke Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border/40 bg-card p-8">
        <div className="text-center mb-6">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Verifikasi Email</h2>
          <p className="text-sm text-muted-foreground">
            Masukkan kode OTP yang dikirim ke <br />
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="space-y-6">
          {/* OTP Input */}
          <div className="flex justify-center gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className="h-12 w-12 rounded-lg border border-border bg-background text-center text-xl font-bold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            ))}
          </div>

          {/* Submit Button */}
          <Button
            className="w-full h-11"
            onClick={handleSubmit}
            disabled={loading || otp.join('').length !== 6}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Memverifikasi...
              </span>
            ) : (
              'Verifikasi'
            )}
          </Button>

          {/* Resend */}
          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={resendLoading || countdown > 0}
              className="text-sm text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 mx-auto"
            >
              <RefreshCw className={`h-3 w-3 ${resendLoading ? 'animate-spin' : ''}`} />
              {countdown > 0 ? `Kirim ulang dalam ${countdown}s` : 'Kirim ulang kode'}
            </button>
          </div>

          {/* Back to login */}
          <div className="border-t border-border/30 pt-4">
            <button
              onClick={() => router.push('/login')}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke halaman login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}