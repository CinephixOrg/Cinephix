/**
 * Custom React Hooks
 * Reusable hook logic for components
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useApi Hook
 * Handles API calls with loading, error, and data states
 * @param {Function} apiFunction - Async function to call
 * @param {Array} dependencies - Dependencies array
 * @returns {Object} { data, loading, error, setData, refetch }
 */
export const useApi = (apiFunction, dependencies = []) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiFunction();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err.message || 'An error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  React.useEffect(() => {
    refetch();
  }, dependencies);

  return { data, loading, error, setData, refetch };
};

/**
 * useFetch Hook
 * Similar to useApi but more flexible
 * @param {string|Function} url - URL or API function
 * @param {Object} options - Configuration options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useFetch = (url, options = {}) => {
  const [state, setState] = React.useState({
    data: null,
    loading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      const response = await (typeof url === 'function' ? url() : url);
      setState({ data: response, loading: false, error: null });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err.message || 'Error fetching data',
      });
    }
  }, [url]);

  React.useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      refetch();
    }

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { ...state, refetch };
};

/**
 * useDebounce Hook
 * Debounce a value with delay
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in ms (default: 300)
 * @returns {any} Debounced value
 */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

/**
 * useLocalStorage Hook
 * Sync state with localStorage
 * @param {string} key - localStorage key
 * @param {any} initialValue - Initial value
 * @returns {Array} [storedValue, setValue]
 */
export const useLocalStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = React.useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage:`, error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error writing to localStorage:`, error);
    }
  };

  return [storedValue, setValue];
};

/**
 * useAsync Hook
 * Handle async operations
 * @param {Function} asyncFunction - Async function to execute
 * @param {boolean} immediate - Execute immediately (default: true)
 * @returns {Object} { execute, status, value, error }
 */
export const useAsync = (asyncFunction, immediate = true) => {
  const [status, setStatus] = React.useState('idle');
  const [value, setValue] = React.useState(null);
  const [error, setError] = React.useState(null);

  const execute = React.useCallback(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);
    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      return response;
    } catch (error) {
      setError(error);
      setStatus('error');
    }
  }, [asyncFunction]);

  React.useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, value, error };
};

/**
 * usePrevious Hook
 * Get previous value of a variable
 * @param {any} value - Current value
 * @returns {any} Previous value
 */
export const usePrevious = (value) => {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
};

/**
 * useClickOutside Hook
 * Detect click outside element
 * @param {React.Ref} ref - Reference to element
 * @param {Function} callback - Callback when clicked outside
 */
export const useClickOutside = (ref, callback) => {
  useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, callback]);
};

/**
 * useWindowSize Hook
 * Get current window size
 * @returns {Object} { width, height }
 */
export const useWindowSize = () => {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

/**
 * useToggle Hook
 * Toggle boolean state
 * @param {boolean} initialValue - Initial state
 * @returns {Array} [value, toggle]
 */
export const useToggle = (initialValue = false) => {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue(v => !v);
  }, []);

  return [value, toggle];
};

/**
 * useTimeout Hook
 * Set up a timeout
 * @param {Function} callback - Function to execute
 * @param {number} delay - Delay in ms
 */
export const useTimeout = (callback, delay) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!delay && delay !== 0) {
      return;
    }

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
};

/**
 * useInterval Hook
 * Set up an interval
 * @param {Function} callback - Function to execute
 * @param {number} delay - Delay in ms
 */
export const useInterval = (callback, delay) => {
  const savedCallback = useRef();

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!delay && delay !== 0) {
      return;
    }

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
};
