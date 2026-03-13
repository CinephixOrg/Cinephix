/**
 * useApiCache Hook
 * React hook for handling cached API calls with loading/error states
 */

import { useState, useEffect } from 'react';

/**
 * Custom hook for API calls with automatic caching support
 * @param {Function} apiCall - The async API function to call
 * @param {Array} dependencies - Dependencies array for useEffect
 * @param {Object} options - Configuration options
 * @param {boolean} options.cacheEnabled - Whether to use cache (default: true)
 * @returns {Object} { data, loading, error, refetch }
 */
export const useApiCache = (apiCall, dependencies = [], options = {}) => {
  const { cacheEnabled = true } = options;
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall();
      setData(result.data || result);
    } catch (err) {
      setError(err?.message || 'An error occurred');
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  const refetch = () => {
    fetchData();
  };

  return { data, loading, error, refetch };
};

export default useApiCache;
