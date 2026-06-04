import { useState, useCallback } from 'react';

type AuthTab = 'login' | 'register';
type FormErrors = Record<string, string>;

export function useAuthForm() {
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const clearFieldError = useCallback((field: string) => {
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  const switchTab = useCallback((tab: AuthTab) => {
    setActiveTab(tab);
    setErrors({});
  }, []);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setName('');
    setErrors({});
    setShowPassword(false);
    setLoading(false);
  }, []);

  return {
    activeTab,
    email, setEmail,
    password, setPassword,
    name, setName,
    showPassword, setShowPassword,
    loading, setLoading,
    errors, setErrors,
    clearFieldError,
    switchTab,
    resetForm,
  };
}