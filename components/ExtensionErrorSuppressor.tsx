"use client";

import { useEffect } from 'react';

/**
 * Component to suppress errors from Chrome extensions
 * This prevents wallet extension errors from breaking the app
 */
export function ExtensionErrorSuppressor() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Suppress console errors from extensions
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args: any[]) => {
      const errorMessage = args[0]?.toString() || '';
      
      // Ignore errors from Chrome extensions
      if (
        errorMessage.includes('chrome-extension://') ||
        errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('Extension context invalidated') ||
        errorMessage.includes('message handler closed') ||
        errorMessage.includes('"undefined" is not valid JSON') ||
        errorMessage.includes('is not valid JSON') ||
        (errorMessage.includes('target') && errorMessage.includes('undefined')) ||
        (errorMessage.includes('type') && errorMessage.includes('undefined') && args.some(arg =>
          typeof arg === 'string' && arg.includes('chrome-extension://')
        ))
      ) {
        // Silently ignore extension errors
        return;
      }
      
      // Log other errors normally
      try {
        originalError(...args);
      } catch (e) {
        // Fallback if spread doesn't work
        originalError.apply(console, args as any);
      }
    };

    console.warn = (...args: any[]) => {
      const warnMessage = args[0]?.toString() || '';

      // Ignore warnings from Chrome extensions
      if (
        warnMessage.includes('chrome-extension://') ||
        warnMessage.includes('Could not establish connection') ||
        warnMessage.includes('Receiving end does not exist') ||
        warnMessage.includes('is not valid JSON') ||
        warnMessage.includes('"undefined" is not valid JSON')
      ) {
        return;
      }

      try {
        originalWarn(...args);
      } catch (e) {
        originalWarn.apply(console, args as any);
      }
    };

    // Suppress unhandled promise rejections from extensions
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMessage = event.reason?.toString() || '';
      
      if (
        errorMessage.includes('chrome-extension://') ||
        errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('Extension context invalidated') ||
        errorMessage.includes('is not valid JSON') ||
        errorMessage.includes('"undefined" is not valid JSON')
      ) {
        event.preventDefault(); // Suppress the error
        return;
      }
    };

    // Suppress runtime errors from extensions
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || '';
      const source = event.filename || '';
      
      if (
        source.includes('chrome-extension://') ||
        errorMessage.includes('Could not establish connection') ||
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('is not valid JSON') ||
        errorMessage.includes('"undefined" is not valid JSON') ||
        (errorMessage.includes('Cannot read properties of undefined') &&
         (source.includes('chrome-extension://') || event.error?.stack?.includes('chrome-extension://'))) ||
        (errorMessage.includes('type') && source.includes('chrome-extension://')) ||
        (errorMessage.includes('target') && source.includes('chrome-extension://'))
      ) {
        event.preventDefault(); // Suppress the error
        return;
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError, true); // Use capture phase

    // Cleanup
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError, true);
    };
  }, []);

  return null; // This component doesn't render anything
}

