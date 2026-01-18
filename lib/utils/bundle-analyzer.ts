/**
 * Bundle Analysis Utilities
 * Help identify large dependencies and optimize bundle size
 */

import React from 'react';

/**
 * Get bundle size estimate for a module
 * This is a helper for development - use @next/bundle-analyzer for production
 */
export function analyzeBundleSize() {
  if (typeof window === 'undefined') {
    return null; // Server-side only
  }

  const modules: Array<{ name: string; size: number }> = [];

  // Check for performance API
  if ('performance' in window && 'getEntriesByType' in performance) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    resources.forEach((resource) => {
      if (resource.name.includes('/_next/static/')) {
        const size = resource.transferSize || 0;
        modules.push({
          name: resource.name.split('/').pop() || 'unknown',
          size,
        });
      }
    });
  }

  return modules.sort((a, b) => b.size - a.size);
}

/**
 * Lazy load component helper
 */
export function lazyLoad<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(importFn);
}

