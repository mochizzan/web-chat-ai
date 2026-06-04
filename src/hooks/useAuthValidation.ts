import { useCallback } from 'react';

export function useAuthValidation() {
  const validateLogin = useCallback((email: string, password: string): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!email.trim()) {
      errors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Format email tidak valid (contoh: user@mail.com)';
    }
    
    if (!password.trim()) {
      errors.password = 'Password wajib diisi';
    } else if (password.length < 3) {
      errors.password = 'Password minimal 3 karakter';
    }
    
    return errors;
  }, []);

  const validateRegister = useCallback((name: string, email: string, password: string): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!name.trim()) {
      errors.name = 'Nama wajib diisi';
    } else if (name.trim().length < 2) {
      errors.name = 'Nama minimal 2 karakter';
    }
    
    if (!email.trim()) {
      errors.email = 'Email wajib diisi';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/^[a-zA-Z0-9_]+$/.test(email)) {
      errors.email = 'Format email tidak valid';
    }
    
    if (!password.trim()) {
      errors.password = 'Password wajib diisi';
    } else if (password.length < 3) {
      errors.password = 'Password minimal 3 karakter';
    }
    
    return errors;
  }, []);

  return { validateLogin, validateRegister };
}