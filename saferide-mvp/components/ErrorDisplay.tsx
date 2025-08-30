"use client"

import React from 'react';
import { AlertCircle, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
  error: string | Error | null;
  variant?: 'alert' | 'card' | 'inline' | 'toast';
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  description?: string;
  showRetry?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  retryText?: string;
  dismissText?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  variant = 'alert',
  size = 'md',
  title,
  description,
  showRetry = false,
  onRetry,
  onDismiss,
  className,
  retryText = 'Try Again',
  dismissText = 'Dismiss',
}) => {
  if (!error) return null;

  const errorMessage = error instanceof Error ? error.message : error;
  const isNetworkError = errorMessage.toLowerCase().includes('network') || 
                        errorMessage.toLowerCase().includes('fetch') ||
                        errorMessage.toLowerCase().includes('connection');

  const getErrorTitle = () => {
    if (title) return title;
    if (isNetworkError) return 'Connection Error';
    return 'Error';
  };

  const getErrorDescription = () => {
    if (description) return description;
    if (isNetworkError) return 'Please check your internet connection and try again.';
    return errorMessage;
  };

  const getErrorIcon = () => {
    if (isNetworkError) return <WifiOff className="w-4 h-4" />;
    return <AlertCircle className="w-4 h-4" />;
  };

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  switch (variant) {
    case 'card':
      return (
        <Card className={cn('border-destructive/20 bg-destructive/5', className)}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {getErrorIcon()}
              <CardTitle className={cn('text-destructive', sizeClasses[size])}>
                {getErrorTitle()}
              </CardTitle>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="ml-auto h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <CardDescription className="text-destructive/80">
              {getErrorDescription()}
            </CardDescription>
          </CardHeader>
          {(showRetry || onRetry) && (
            <CardContent className="pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {retryText}
              </Button>
            </CardContent>
          )}
        </Card>
      );

    case 'inline':
      return (
        <div className={cn('flex items-center gap-2 text-destructive', sizeClasses[size], className)}>
          {getErrorIcon()}
          <span>{getErrorDescription()}</span>
          {(showRetry || onRetry) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-auto p-1 text-destructive hover:text-destructive"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-auto p-1 text-destructive hover:text-destructive"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      );

    case 'toast':
      return (
        <div className={cn(
          'fixed top-4 right-4 z-50 bg-destructive text-destructive-foreground p-4 rounded-lg shadow-lg border max-w-sm',
          className
        )}>
          <div className="flex items-start gap-2">
            {getErrorIcon()}
            <div className="flex-1">
              <p className="font-medium">{getErrorTitle()}</p>
              <p className="text-sm opacity-90">{getErrorDescription()}</p>
            </div>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-6 w-6 p-0 text-destructive-foreground hover:text-destructive-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {(showRetry || onRetry) && (
            <div className="mt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onRetry}
                className="bg-destructive-foreground text-destructive hover:bg-destructive-foreground/90"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {retryText}
              </Button>
            </div>
          )}
        </div>
      );

    default: // alert
      return (
        <Alert variant="destructive" className={className}>
          {getErrorIcon()}
          <AlertTitle>{getErrorTitle()}</AlertTitle>
          <AlertDescription className="mt-2">
            {getErrorDescription()}
            {(showRetry || onRetry || onDismiss) && (
              <div className="flex gap-2 mt-3">
                {(showRetry || onRetry) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {retryText}
                  </Button>
                )}
                {onDismiss && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDismiss}
                    className="text-destructive hover:text-destructive"
                  >
                    {dismissText}
                  </Button>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      );
  }
};

// Specialized error components
export const NetworkError: React.FC<Omit<ErrorDisplayProps, 'error'> & { onRetry?: () => void }> = (props) => (
  <ErrorDisplay
    error="Unable to connect to the server"
    title="Connection Error"
    description="Please check your internet connection and try again."
    showRetry
    {...props}
  />
);

export const NotFoundError: React.FC<Omit<ErrorDisplayProps, 'error'>> = (props) => (
  <ErrorDisplay
    error="The requested resource was not found"
    title="Not Found"
    description="The page or resource you're looking for doesn't exist."
    {...props}
  />
);

export const UnauthorizedError: React.FC<Omit<ErrorDisplayProps, 'error'>> = (props) => (
  <ErrorDisplay
    error="You are not authorized to access this resource"
    title="Access Denied"
    description="Please log in or contact support if you believe this is an error."
    {...props}
  />
);

export const ValidationError: React.FC<Omit<ErrorDisplayProps, 'error'> & { errors: string[] }> = ({ 
  errors, 
  ...props 
}) => (
  <ErrorDisplay
    error={errors.join(', ')}
    title="Validation Error"
    description="Please correct the following errors and try again."
    {...props}
  />
);

export default ErrorDisplay;