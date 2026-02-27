/**
 * Notification scheduler implementation
 */

import { Scheduler, NotificationId, Timestamp } from './types';
import { Clock } from '../types';

export interface ScheduledNotification {
  notificationId: NotificationId;
  scheduledAt: Timestamp;
}

export class InMemoryScheduler implements Scheduler {
  private scheduled: Map<string, ScheduledNotification[]> = new Map();
  private clock: Clock;
  
  constructor(clock?: Clock) {
    this.clock = clock || { now: () => new Date() };
  }
  
  async schedule(notificationId: NotificationId, scheduledAt: Timestamp): Promise<void> {
    if (scheduledAt <= this.clock.now()) {
      throw new Error('Scheduled time must be in the future');
    }
    
    const dateKey = this.getDateKey(scheduledAt);
    const daySchedule = this.scheduled.get(dateKey) || [];
    
    // Check if already scheduled
    if (daySchedule.some(s => s.notificationId === notificationId)) {
      throw new Error(`Notification ${notificationId} is already scheduled`);
    }
    
    // Add to schedule
    daySchedule.push({
      notificationId,
      scheduledAt
    });
    
    // Sort by scheduled time
    daySchedule.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    
    this.scheduled.set(dateKey, daySchedule);
  }
  
  async unschedule(notificationId: NotificationId): Promise<void> {
    // Search all days
    for (const [dateKey, schedule] of this.scheduled) {
      const index = schedule.findIndex(s => s.notificationId === notificationId);
      if (index !== -1) {
        schedule.splice(index, 1);
        
        // Clean up empty days
        if (schedule.length === 0) {
          this.scheduled.delete(dateKey);
        }
        
        return;
      }
    }
  }
  
  async getScheduled(maxCount: number = 100): Promise<NotificationId[]> {
    const now = this.clock.now();
    const result: NotificationId[] = [];
    
    // Get today's key and a few days ahead
    const today = this.getDateKey(now);
    
    for (let i = 0; i < 7; i++) { // Check 7 days ahead
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      const dateKey = this.getDateKey(date);
      
      const schedule = this.scheduled.get(dateKey) || [];
      
      for (const scheduled of schedule) {
        if (scheduled.scheduledAt <= now && result.length < maxCount) {
          result.push(scheduled.notificationId);
        }
      }
      
      if (result.length >= maxCount) {
        break;
      }
    }
    
    return result;
  }
  
  async isScheduled(notificationId: NotificationId): Promise<boolean> {
    for (const schedule of this.scheduled.values()) {
      if (schedule.some(s => s.notificationId === notificationId)) {
        return true;
      }
    }
    return false;
  }
  
  async getPendingCount(): Promise<number> {
    const now = this.clock.now();
    let count = 0;
    
    for (const schedule of this.scheduled.values()) {
      count += schedule.filter(s => s.scheduledAt <= now).length;
    }
    
    return count;
  }
  
  async cleanupOldDates(daysToKeep: number = 30): Promise<void> {
    const cutoff = new Date(this.clock.now());
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    
    for (const [dateKey, schedule] of this.scheduled) {
      const date = new Date(dateKey);
      if (date < cutoff) {
        this.scheduled.delete(dateKey);
      }
    }
  }
  
  private getDateKey(date: Timestamp): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  
  // Helper methods for testing
  clear(): void {
    this.scheduled.clear();
  }
  
  size(): number {
    let total = 0;
    for (const schedule of this.scheduled.values()) {
      total += schedule.length;
    }
    return total;
  }
}
