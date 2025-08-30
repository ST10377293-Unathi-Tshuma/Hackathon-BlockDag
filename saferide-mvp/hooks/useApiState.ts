import { useState, useCallback } from 'react';
import { ApiResponse } from '@/lib/types';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  lastApiCall: (() => Promise<ApiResponse<T>>) | null;
}

interface UseApiStateReturn<T> extends ApiState<T> {
  execute: (apiCall: () => Promise<ApiResponse<T>>) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
  setData: (data: T | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

/**
 * Custom hook for managing API call states with loading, error handling, and data management
 * @param initialData - Initial data value
 * @returns Object containing state and control functions
 */
export function useApiState<T>(initialData: T | null = null): UseApiStateReturn<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: initialData,
    loading: false,
    error: null,
    lastUpdated: null,
    lastApiCall: null,
  });

  const execute = useCallback(async (apiCall: () => Promise<ApiResponse<T>>): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await apiCall();
      
      if (response.success) {
        setState({
          data: response.data,
          loading: false,
          error: null,
          lastUpdated: new Date(),
          lastApiCall: null,
        });
        return response.data;
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: response.error || 'An unexpected error occurred',
        }));
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null,
      lastUpdated: null,
      lastApiCall: null,
    });
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data, lastUpdated: new Date() }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const retry = useCallback(async () => {
    if (!state.lastApiCall) {
      throw new Error('No previous API call to retry.');
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await state.lastApiCall();

      if (response.success) {
        setState({
          data: response.data,
          loading: false,
          error: null,
          lastUpdated: new Date(),
          lastApiCall: null,
        });
        return response.data;
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: response.error || 'An unexpected error occurred during retry',
        }));
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred during retry';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [state.lastApiCall]);

  return {
    ...state,
    execute,
    retry,
    reset,
    setData,
    setError,
    clearError,
  };
}

/**
 * Hook for managing multiple API states
 */
export function useMultipleApiStates<T extends Record<string, any>>(
  initialStates: { [K in keyof T]: T[K] | null }
): { [K in keyof T]: UseApiStateReturn<T[K]> } {
  const states = {} as { [K in keyof T]: UseApiStateReturn<T[K]> };
  
  for (const key in initialStates) {
    states[key] = useApiState<T[typeof key]>(initialStates[key]);
  }
  
  return states;
}

/**
 * Hook for retry functionality
 */
export function useRetry() {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const retry = useCallback(async (fn: () => Promise<any>, maxRetries: number = 3) => {
    if (retryCount >= maxRetries) {
      throw new Error(`Max retries (${maxRetries}) exceeded`);
    }
    
    setIsRetrying(true);
    try {
      const result = await fn();
      setRetryCount(0); // Reset on success
      return result;
    } catch (error) {
      setRetryCount(prev => prev + 1);
      throw error;
    } finally {
      setIsRetrying(false);
    }
  }, [retryCount]);
  
  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);
  
  return { retry, retryCount, isRetrying, resetRetry };
}