import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-destructive/10 rounded-lg">
          <h3 className="text-destructive font-medium">Terjadi kesalahan</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {this.state.error?.message || 'Terjadi kesalahan yang tidak terduga'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;