import { UserProfile } from '@/lib/store';

export interface AuthResponse {
  success: boolean;
  data?: {
    user?: UserProfile;
    token?: string;
    needsVerification?: boolean;
    message?: string;
  };
  message?: string;
  error?: {
    message: string;
    code: string;
  };
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email: email.trim(), password }),
  });
  return response.json();
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', name: name.trim(), email: email.trim(), password }),
  });
  return response.json();
}

export async function verifyEmail(email: string, otp: string): Promise<AuthResponse> {
  const response = await fetch('/api/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), otp }),
  });
  return response.json();
}

export async function resendVerification(email: string): Promise<AuthResponse> {
  const response = await fetch('/api/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'resend', email: email.trim() }),
  });
  return response.json();
}