/**
 * Suppress errors from Chrome extensions (wallet extensions, etc.)
 * These errors are harmless and don't affect the app functionality
 */

if (typeof window !== 'undefined') {
  // Suppress console errors from extensions
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || '';
    
    // Ignore errors from Chrome extensions
    if (
      errorMessage.includes('chrome-extension://') ||
      errorMessage.includes('Could not establish connection') ||
      errorMessage.includes('Receiving end does not exist') ||
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('message handler closed') ||
      errorMessage.includes('target') && errorMessage.includes('undefined')
    ) {
      // Silently ignore extension errors
      return;
    }
    
    // Log other errors normally
    originalError.apply(console, args);
  };

  // Suppress unhandled promise rejections from extensions
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.toString() || '';
    
    if (
      errorMessage.includes('chrome-extension://') ||
      errorMessage.includes('Could not establish connection') ||
      errorMessage.includes('Receiving end does not exist') ||
      errorMessage.includes('Extension context invalidated')
    ) {
      event.preventDefault(); // Suppress the error
      return;
    }
  });

  // Suppress runtime errors from extensions
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    const source = event.filename || '';
    
    if (
      source.includes('chrome-extension://') ||
      errorMessage.includes('Could not establish connection') ||
      errorMessage.includes('Receiving end does not exist') ||
      errorMessage.includes('Cannot read properties of undefined') ||
      (errorMessage.includes('type') && source.includes('chrome-extension://')) ||
      (errorMessage.includes('target') && source.includes('chrome-extension://'))
    ) {
      event.preventDefault(); // Suppress the error
      return;
    }
  }, true); // Use capture phase to catch early
}

