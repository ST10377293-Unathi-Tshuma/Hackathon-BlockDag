"use client"

import React from 'react';
import { Loader2, Car, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  variant?: 'default' | 'page' | 'inline' | 'button' | 'card' | 'overlay';
  size?: 'sm' | 'md' | 'lg';
  message?: string;
  className?: string;
  showIcon?: boolean;
  icon?: React.ReactNode;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'default',
  size = 'md',
  message,
  className,
  showIcon = true,
  icon,
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const LoadingIcon = icon || <Loader2 className={cn('animate-spin', sizeClasses[size])} />;

  switch (variant) {
    case 'page':
      return (
        <div className={cn(
          'min-h-screen bg-background flex items-center justify-center',
          className
        )}>
          <div className="text-center space-y-4">
            {showIcon && (
              <div className="flex justify-center">
                {LoadingIcon}
              </div>
            )}
            {message && (
              <p className={cn('text-muted-foreground', textSizeClasses[size])}>
                {message}
              </p>
            )}
          </div>
        </div>
      );

    case 'overlay':
      return (
        <div className={cn(
          'fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center',
          className
        )}>
          <div className="bg-card p-6 rounded-lg shadow-lg border text-center space-y-4">
            {showIcon && (
              <div className="flex justify-center">
                {LoadingIcon}
              </div>
            )}
            {message && (
              <p className={cn('text-muted-foreground', textSizeClasses[size])}>
                {message}
              </p>
            )}
          </div>
        </div>
      );

    case 'card':
      return (
        <div className={cn(
          'bg-card p-8 rounded-lg border text-center space-y-4',
          className
        )}>
          {showIcon && (
            <div className="flex justify-center">
              {LoadingIcon}
            </div>
          )}
          {message && (
            <p className={cn('text-muted-foreground', textSizeClasses[size])}>
              {message}
            </p>
          )}
        </div>
      );

    case 'inline':
      return (
        <div className={cn('flex items-center gap-2', className)}>
          {showIcon && LoadingIcon}
          {message && (
            <span className={cn('text-muted-foreground', textSizeClasses[size])}>
              {message}
            </span>
          )}
        </div>
      );

    case 'button':
      return (
        <div className={cn('flex items-center gap-2', className)}>
          {showIcon && LoadingIcon}
          {message && (
            <span className={textSizeClasses[size]}>{message}</span>
          )}
        </div>
      );

    default:
      return (
        <div className={cn('flex flex-col items-center gap-2', className)}>
          {showIcon && LoadingIcon}
          {message && (
            <p className={cn('text-muted-foreground text-center', textSizeClasses[size])}>
              {message}
            </p>
          )}
        </div>
      );
  }
};

// Specialized loading components
export const PageLoading: React.FC<Omit<LoadingStateProps, 'variant'>> = (props) => (
  <LoadingState variant="page" {...props} />
);

export const OverlayLoading: React.FC<Omit<LoadingStateProps, 'variant'>> = (props) => (
  <LoadingState variant="overlay" {...props} />
);

export const CardLoading: React.FC<Omit<LoadingStateProps, 'variant'>> = (props) => (
  <LoadingState variant="card" {...props} />
);

export const InlineLoading: React.FC<Omit<LoadingStateProps, 'variant'>> = (props) => (
  <LoadingState variant="inline" {...props} />
);

export const ButtonLoading: React.FC<Omit<LoadingStateProps, 'variant'>> = (props) => (
  <LoadingState variant="button" {...props} />
);

// Skeleton loading components
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('bg-card p-4 rounded-lg border space-y-3', className)}>
    <div className="h-4 bg-muted rounded animate-pulse" />
    <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
    <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
  </div>
);

export const SkeletonList: React.FC<{ items?: number; className?: string }> = ({ 
  items = 3, 
  className 
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: items }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

// SafeRide themed loading
export const SafeRideLoading: React.FC<Omit<LoadingStateProps, 'icon'>> = (props) => (
  <LoadingState
    {...props}
    icon={
      <div className="relative">
        <Shield className={cn('animate-pulse text-primary', props.size === 'sm' ? 'w-4 h-4' : props.size === 'lg' ? 'w-8 h-8' : 'w-6 h-6')} />
        <Car className={cn('absolute top-0 left-0 animate-bounce text-primary/60', props.size === 'sm' ? 'w-4 h-4' : props.size === 'lg' ? 'w-8 h-8' : 'w-6 h-6')} />
      </div>
    }
  />
);

export default LoadingState;