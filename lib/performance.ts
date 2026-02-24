/**
 * Performance Monitoring
 * Tracking metrics cho optimization
 */

import { logPerformance, logQuery, logBlockchain }from '@/lib/logger';
import type { LogContext }from '@/lib/logger';

/**
 * Database query wrapper với performance tracking
 */
export async function trackDatabaseQuery<T>(
  query: string,
  params: any[],
  executeQuery: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await executeQuery();
    const duration = Date.now() - startTime;

    // Log query performance
    logQuery({
      requestId: context?.requestId || 'unknown',
      query,
      duration,
      rowCount: (result as any)?.rows?.length || 0,
    });

    // Log slow query warning
    if (duration > 1000) {
      logPerformance({
        requestId: context?.requestId || 'unknown',
        operation: query.substring(0, 50),
        duration,
        threshold: 1000,
      });
    }

    return result;
  }catch (error) {
    const duration = Date.now() - startTime;

    logQuery({
      requestId: context?.requestId || 'unknown',
      query,
      duration,
      error: (error as Error).message,
    });

    throw error;
  }
}

/**
 * Blockchain operation wrapper với performance tracking
 */
export async function trackBlockchainOperation<T>(
  action: string,
  execute: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await execute();
    const duration = Date.now() - startTime;

    logBlockchain({
      requestId: context?.requestId || 'unknown',
      action,
      status: 'success',
      duration,
    });

    // Log slow operation
    if (duration > 30000) {
      logPerformance({
        requestId: context?.requestId || 'unknown',
        operation: action,
        duration,
        threshold: 30000,
      });
    }

    return result;
  }catch (error) {
    const duration = Date.now() - startTime;

    logBlockchain({
      requestId: context?.requestId || 'unknown',
      action,
      status: 'error',
      duration,
      error: (error as Error).message,
    });

    throw error;
  }
}

/**
 * Custom operation timer
 */
export class OperationTimer {
  private startTime: number;
  private operation: string;

  constructor(operation: string) {
    this.operation = operation;
    this.startTime = Date.now();
  }

  /**
   * Get elapsed time
   */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Log timing
   */
  log(context?: LogContext) {
    const duration = this.elapsed();

    logPerformance({
      requestId: context?.requestId || 'unknown',
      operation: this.operation,
      duration,
    });
  }

  /**
   * Warn if exceeded threshold
   */
  warnIfSlow(threshold: number, context?: LogContext) {
    const duration = this.elapsed();

    if (duration > threshold) {
      logPerformance({
        requestId: context?.requestId || 'unknown',
        operation: this.operation,
        duration,
        threshold,
      });
    }
  }
}

/**
 * Performance metrics collector
 */
export class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  /**
   * Record metric
   */
  record(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string) {
    const values = this.metrics.get(name) || [];

    if (values.length === 0) {
      return null;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];

    return { count: values.length, sum, avg, min, max, median };
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result: Record<string, any> = {};

    for (const [name] of this.metrics) {
      result[name] = this.getStats(name);
    }

    return result;
  }

  /**
   * Clear metrics
   */
  clear() {
    this.metrics.clear();
  }

  /**
   * Clear specific metric
   */
  clearMetric(name: string) {
    this.metrics.delete(name);
  }
}

// Global metrics collector
const globalMetrics = new MetricsCollector();

export function getMetricsCollector(): MetricsCollector {
  return globalMetrics;
}

/**
 * Memory usage tracker
 */
export function getMemoryUsage() {
  if (typeof window === 'undefined') {
    // Node.js environment
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(usage.external / 1024 / 1024) + 'MB',
      rss: Math.round(usage.rss / 1024 / 1024) + 'MB',
    };
  }

  // Browser environment
  return {
    usedJSHeapSize: (performance as any).memory?.usedJSHeapSize || 0,
    totalJSHeapSize: (performance as any).memory?.totalJSHeapSize || 0,
    jsHeapSizeLimit: (performance as any).memory?.jsHeapSizeLimit || 0,
  };
}
