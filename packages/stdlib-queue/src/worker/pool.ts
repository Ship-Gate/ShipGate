/**
 * Worker Pool Implementation
 * Manages multiple workers with auto-scaling capabilities
 */

import type { Job, WorkerId, WorkerStatus } from '../types.js';
import type { 
  WorkerInterface, 
  WorkerPoolInterface, 
  WorkerPoolConfig, 
  WorkerPoolStats,
  WorkerPoolEvent 
} from './types.js';
import { WorkerPoolStoppedError, WorkerPoolBusyError } from '../errors.js';

export class WorkerPool implements WorkerPoolInterface {
  private config: WorkerPoolConfig;
  private workers: Map<WorkerId, WorkerInterface> = new Map();
  private status: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';
  private eventListeners: Map<WorkerPoolEvent, Function[]> = new Map();
  private startTime?: Date;
  private lastScaleUp = 0;
  private lastScaleDown = 0;
  
  // Metrics
  private totalJobsProcessed = 0;
  private totalJobsFailed = 0;
  private processingTimes: number[] = [];

  constructor(config: WorkerPoolConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.status !== 'stopped') {
      return;
    }

    this.status = 'starting';
    this.startTime = new Date();
    this.emit('pool:started');

    // Start minimum workers
    const startPromises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minWorkers; i++) {
      startPromises.push(this.addWorker());
    }
    
    await Promise.all(startPromises);
    this.status = 'running';
    
    // Start auto-scaling monitor
    this.startScalingMonitor();
  }

  async stop(graceful = true, timeout = 30000): Promise<void> {
    if (this.status === 'stopped') {
      return;
    }

    this.status = 'stopping';
    this.emit('pool:stopped');

    const stopPromises: Promise<void>[] = [];
    
    for (const worker of this.workers.values()) {
      stopPromises.push(worker.stop(graceful, timeout));
    }
    
    await Promise.all(stopPromises);
    this.workers.clear();
    this.status = 'stopped';
  }

  pause(): void {
    for (const worker of this.workers.values()) {
      worker.pause();
    }
  }

  resume(): void {
    for (const worker of this.workers.values()) {
      worker.resume();
    }
  }

  async scaleUp(count = 1): Promise<void> {
    if (this.status !== 'running') {
      throw new WorkerPoolStoppedError();
    }

    const currentCount = this.workers.size;
    const targetCount = Math.min(currentCount + count, this.config.maxWorkers);
    
    for (let i = currentCount; i < targetCount; i++) {
      await this.addWorker();
    }
    
    this.emit('pool:scaled_up', targetCount - currentCount);
  }

  async scaleDown(count = 1): Promise<void> {
    if (this.status !== 'running') {
      throw new WorkerPoolStoppedError();
    }

    const currentCount = this.workers.size;
    const targetCount = Math.max(currentCount - count, this.config.minWorkers);
    
    // Find idle workers to remove
    const idleWorkers = Array.from(this.workers.entries())
      .filter(([_, worker]) => worker.getCurrentJob() === null)
      .slice(0, currentCount - targetCount);
    
    for (const [workerId] of idleWorkers) {
      await this.removeWorker(workerId);
    }
    
    this.emit('pool:scaled_down', currentCount - targetCount);
  }

  setMinWorkers(count: number): void {
    this.config.minWorkers = Math.max(1, count);
    
    // Scale up if needed
    if (this.workers.size < this.config.minWorkers) {
      this.scaleUp(this.config.minWorkers - this.workers.size);
    }
  }

  setMaxWorkers(count: number): void {
    this.config.maxWorkers = Math.max(this.config.minWorkers, count);
    
    // Scale down if needed
    if (this.workers.size > this.config.maxWorkers) {
      this.scaleDown(this.workers.size - this.config.maxWorkers);
    }
  }

  getStats(): WorkerPoolStats {
    const activeWorkers = Array.from(this.workers.values())
      .filter(w => w.isRunning()).length;
    
    const idleWorkers = activeWorkers - Array.from(this.workers.values())
      .filter(w => w.getCurrentJob() !== null).length;
    
    const processingJobs = Array.from(this.workers.values())
      .reduce((sum, w) => sum + (w.getCurrentJob() ? 1 : 0), 0);

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      idleWorkers,
      processingJobs,
      queuedJobs: 0, // Should be provided by job queue
      completedJobs: this.totalJobsProcessed,
      failedJobs: this.totalJobsFailed,
      avgProcessingTime: this.calculateAvgProcessingTime(),
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
    };
  }

  getWorker(id: WorkerId): WorkerInterface | null {
    return this.workers.get(id) || null;
  }

  getAllWorkers(): WorkerInterface[] {
    return Array.from(this.workers.values());
  }

  // Event handling
  on(event: WorkerPoolEvent, listener: (...args: any[]) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  off(event: WorkerPoolEvent, listener: (...args: any[]) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private async addWorker(): Promise<void> {
    const worker = await this.config.workerFactory();
    
    // Set up worker event listeners
    worker.on('job:completed', (job, result) => {
      this.totalJobsProcessed++;
      this.recordProcessingTime(result.durationMs);
    });
    
    worker.on('job:failed', (job, result) => {
      this.totalJobsFailed++;
      this.recordProcessingTime(result.durationMs);
    });
    
    await worker.start();
    this.workers.set(worker.getStats().id, worker);
    this.emit('worker:added', worker);
  }

  private async removeWorker(workerId: WorkerId): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      return;
    }
    
    await worker.stop();
    this.workers.delete(workerId);
    this.emit('worker:removed', workerId);
  }

  private startScalingMonitor(): void {
    const monitor = async () => {
      if (this.status !== 'running') {
        return;
      }
      
      try {
        const queueSize = await this.config.jobQueue.size();
        const currentWorkers = this.workers.size;
        const now = Date.now();
        
        // Scale up if queue is backing up
        if (queueSize > this.config.scaleUpThreshold && 
            currentWorkers < this.config.maxWorkers &&
            now - this.lastScaleUp > this.config.scaleUpCooldown) {
          await this.scaleUp(1);
          this.lastScaleUp = now;
        }
        
        // Scale down if queue is empty and we have excess workers
        if (queueSize < this.config.scaleDownThreshold && 
            currentWorkers > this.config.minWorkers &&
            now - this.lastScaleDown > this.config.scaleDownCooldown) {
          await this.scaleDown(1);
          this.lastScaleDown = now;
        }
      } catch (error) {
        this.emit('error', error);
      }
      
      // Schedule next check
      setTimeout(monitor, 5000); // Check every 5 seconds
    };
    
    setTimeout(monitor, 5000);
  }

  private emit(event: WorkerPoolEvent, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in worker pool event listener for ${event}:`, error);
        }
      });
    }
  }

  private recordProcessingTime(time: number): void {
    this.processingTimes.push(time);
    
    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes.shift();
    }
  }

  private calculateAvgProcessingTime(): number {
    if (this.processingTimes.length === 0) {
      return 0;
    }
    
    const sum = this.processingTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.processingTimes.length;
  }
}
