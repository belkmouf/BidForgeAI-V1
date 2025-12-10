import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, level = 'component' } = this.props;
    const { errorId } = this.state;

    // Enhanced error logging
    const errorData = {
      errorId,
      level,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      retryCount: this.retryCount,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Boundary - ${level}`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Error Data:', errorData);
      console.groupEnd();
    }

    // Send to error reporting service (implement your own)
    this.reportError(errorData);

    // Call custom error handler
    onError?.(error, errorInfo);

    this.setState({ errorInfo });
  }

  private getUserId(): string | null {
    try {
      // Try to get user ID from localStorage or context
      const userData = localStorage.getItem('user');
      return userData ? JSON.parse(userData).id : null;
    } catch {
      return null;
    }
  }

  private async reportError(errorData: any) {
    try {
      // In production, send to your error reporting service
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(errorData),
        });
      }
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const { fallback, level = 'component' } = this.props;
      const { error, errorId } = this.state;
      const canRetry = this.retryCount < this.maxRetries;

      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Critical level errors get a full page overlay
      if (level === 'critical') {
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-6 text-center">
              <div className="space-y-2">
                <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
                <h1 className="text-2xl font-semibold">Something went wrong</h1>
                <p className="text-muted-foreground">
                  We've encountered a critical error. Our team has been notified.
                </p>
                {process.env.NODE_ENV === 'development' && (
                  <p className="text-xs text-muted-foreground font-mono">
                    Error ID: {errorId}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <Button onClick={this.handleReload} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Application
                </Button>
                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome} 
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Homepage
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && error && (
                <Alert variant="destructive" className="text-left">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Debug Information</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap text-xs mt-2">
                    {error.message}
                    {error.stack && `\n\n${error.stack}`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        );
      }

      // Page level errors get a centered error message
      if (level === 'page') {
        return (
          <div className="min-h-[400px] flex items-center justify-center p-8">
            <div className="max-w-sm w-full space-y-4 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Page Error</h2>
                <p className="text-muted-foreground text-sm">
                  This page encountered an error and couldn't load properly.
                </p>
              </div>
              
              <div className="space-y-2">
                {canRetry && (
                  <Button onClick={this.handleRetry} size="sm" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  onClick={this.handleGoHome} 
                  size="sm" 
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go Home
                </Button>
              </div>
            </div>
          </div>
        );
      }

      // Component level errors get a compact error message
      return (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Component Error</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>This component couldn't render due to an error.</p>
            <div className="flex gap-2">
              {canRetry && (
                <Button 
                  onClick={this.handleRetry} 
                  size="sm" 
                  variant="outline"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
              {process.env.NODE_ENV === 'development' && (
                <Button 
                  onClick={() => console.error(error)} 
                  size="sm" 
                  variant="outline"
                >
                  View Details
                </Button>
              )}
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="text-xs mt-2">
                <summary className="cursor-pointer">Debug Info</summary>
                <pre className="whitespace-pre-wrap mt-1 p-2 bg-muted rounded">
                  {error?.message}
                  {error?.stack}
                </pre>
              </details>
            )}
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for wrapping components with error boundaries
export function withErrorBoundary<T extends object>(
  Component: React.ComponentType<T>,
  options?: {
    fallback?: ReactNode;
    level?: 'page' | 'component' | 'critical';
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
  }
) {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary {...options}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual error reporting
export function useErrorHandler() {
  return React.useCallback((error: Error, context?: string) => {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const errorData = {
      errorId,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    if (process.env.NODE_ENV === 'development') {
      console.error('Manual error report:', errorData);
    }

    // Report to error service
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(errorData),
    }).catch(console.error);

    return errorId;
  }, []);
}

// React Query Error Boundary
export function QueryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="component"
      onError={(error, errorInfo) => {
        // Handle React Query specific errors
        console.error('Query Error:', error, errorInfo);
      }}
      fallback={
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Data Loading Error</AlertTitle>
          <AlertDescription>
            Unable to load data. Please refresh the page or try again later.
          </AlertDescription>
        </Alert>
      }
    >
      {children}
    </ErrorBoundary>
  );
}