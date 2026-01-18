/**
 * Performance Monitoring Utilities
 * Track and log performance metrics
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics

  /**
   * Track performance of an async function
   */
  async track<T>(
    name: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.record(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Track performance of a sync function
   */
  trackSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.record(name, duration, metadata);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.record(name, duration, { ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Record a metric
   */
  private record(
    name: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    // Keep only last maxMetrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations (over 1 second)
    if (duration > 1000) {
      console.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getMetrics(name?: string): PerformanceMetric[] {
    if (name) {
      return this.metrics.filter((m) => m.name === name);
    }
    return [...this.metrics];
  }

  /**
   * Get statistics for a specific operation
   */
  getStats(name: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } | null {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return null;

    const durations = metrics.map((m) => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const avg = sum / durations.length;
    const min = durations[0];
    const max = durations[durations.length - 1];
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      count: durations.length,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      p95: Math.round(durations[p95Index] * 100) / 100,
      p99: Math.round(durations[p99Index] * 100) / 100,
    };
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Performance decorator for functions
 */
export function trackPerformance(
  name: string,
  metadata?: Record<string, any>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return performanceMonitor.track(
        `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args),
        { ...metadata, args: args.length }
      );
    };

    return descriptor;
  };
}

