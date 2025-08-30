import { useState, useEffect } from 'react'

/**
 * Custom hook for debouncing values
 * @param value - The value to debounce
 * @param delay - The delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Custom hook for debouncing search queries with loading state
 * @param initialValue - Initial search value
 * @param delay - The delay in milliseconds (default: 300ms)
 * @returns Object with search value, debounced value, setter, and loading state
 */
export function useDebouncedSearch(initialValue: string = '', delay: number = 300) {
  const [searchValue, setSearchValue] = useState(initialValue)
  const debouncedValue = useDebounce(searchValue, delay)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (searchValue !== debouncedValue) {
      setIsSearching(true)
    } else {
      setIsSearching(false)
    }
  }, [searchValue, debouncedValue])

  return {
    searchValue,
    debouncedValue,
    setSearchValue,
    isSearching
  }
}