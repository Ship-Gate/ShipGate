// ============================================================================
// ISL Standard Library - Scheduler Operations
// @isl-lang/stdlib-queue
// ============================================================================

import {
  ScheduledJob,
  Schedule,
  QueueId,
  JobId,
  OverlapBehavior,
  CreateScheduleOptions,
} from './types.js';
import { getQueue } from './queue.js';
import { enqueue, getJob, cancelJob } from './job.js';

/**
 * In-memory scheduled job storage (for reference implementation)
 */
const scheduledJobs = new Map<string, ScheduledJob>();

/**
 * Generate a unique schedule ID
 */
function generateScheduleId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parse a cron expression and get the next run time
 * Simplified implementation - supports basic cron syntax
 */
function getNextCronRun(cron: string, after: Date = new Date()): Date | undefined {
  // Very basic cron parsing (minute, hour, day, month, weekday)
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return undefined;
  }

  const [minutePart, hourPart] = parts;
  const next = new Date(after);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  // Simple implementation for common patterns
  if (minutePart === '*' && hourPart === '*') {
    // Every minute
    return next;
  }

  if (minutePart && minutePart !== '*' && hourPart === '*') {
    // Every hour at specific minute
    const minute = parseInt(minutePart, 10);
    if (isNaN(minute)) return undefined;
    next.setMinutes(minute);
    if (next <= after) {
      next.setHours(next.getHours() + 1);
    }
    return next;
  }

  if (minutePart && hourPart && minutePart !== '*' && hourPart !== '*') {
    // Specific time each day
    const minute = parseInt(minutePart, 10);
    const hour = parseInt(hourPart, 10);
    if (isNaN(minute) || isNaN(hour)) return undefined;
    next.setHours(hour, minute);
    if (next <= after) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // Default: next minute
  return next;
}

/**
 * Calculate the next run time for a schedule
 */
export function calculateNextRun(schedule: Schedule, after: Date = new Date()): Date | undefined {
  if (schedule.cron) {
    return getNextCronRun(schedule.cron, after);
  }

  if (schedule.interval) {
    const next = new Date(after.getTime() + schedule.interval);
    return next;
  }

  if (schedule.at && schedule.at.length > 0) {
    // Find the next time from the list
    const today = new Date(after);
    today.setSeconds(0, 0);

    for (const timeStr of schedule.at) {
      const timeParts = timeStr.split(':').map(Number);
      const hours = timeParts[0];
      const minutes = timeParts[1];
      if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) continue;

      const candidate = new Date(today);
      candidate.setHours(hours, minutes, 0, 0);

      if (candidate > after) {
        return candidate;
      }
    }

    // Try tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const timeStr of schedule.at) {
      const timeParts = timeStr.split(':').map(Number);
      const hours = timeParts[0];
      const minutes = timeParts[1];
      if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) continue;

      const candidate = new Date(tomorrow);
      candidate.setHours(hours, minutes, 0, 0);
      return candidate;
    }
  }

  return undefined;
}

/**
 * Validate a schedule configuration
 */
export function validateSchedule(schedule: Schedule): boolean {
  if (!schedule.cron && !schedule.interval && !schedule.at) {
    return false;
  }

  if (schedule.cron) {
    const parts = schedule.cron.trim().split(/\s+/);
    if (parts.length !== 5) {
      return false;
    }
  }

  if (schedule.interval && schedule.interval <= 0) {
    return false;
  }

  if (schedule.at && schedule.at.length === 0) {
    return false;
  }

  return true;
}

/**
 * Create a new scheduled job
 */
export function createSchedule<TData = unknown>(
  queueId: QueueId,
  name: string,
  data: TData,
  schedule: Schedule,
  options: CreateScheduleOptions = {}
): ScheduledJob<TData> | { error: string } {
  const queue = getQueue(queueId);

  if (!queue) {
    return { error: 'QUEUE_NOT_FOUND' };
  }

  if (!validateSchedule(schedule)) {
    return { error: 'INVALID_SCHEDULE' };
  }

  const id = generateScheduleId();
  const enabled = options.enabled ?? true;

  const scheduledJob: ScheduledJob<TData> = {
    id,
    queueId,
    name,
    data,
    schedule,
    timezone: options.timezone ?? 'UTC',
    enabled,
    nextRunAt: enabled ? calculateNextRun(schedule) : undefined,
    overlapBehavior: options.overlapBehavior ?? OverlapBehavior.SKIP,
  };

  scheduledJobs.set(id, scheduledJob);
  return scheduledJob;
}

/**
 * Get a scheduled job by ID
 */
export function getScheduledJob<TData = unknown>(
  scheduleId: string
): ScheduledJob<TData> | undefined {
  return scheduledJobs.get(scheduleId) as ScheduledJob<TData> | undefined;
}

/**
 * Get all scheduled jobs for a queue
 */
export function getScheduledJobsForQueue(queueId: QueueId): ScheduledJob[] {
  return Array.from(scheduledJobs.values()).filter(
    (job) => job.queueId === queueId
  );
}

/**
 * Update a scheduled job
 */
export function updateSchedule<TData = unknown>(
  scheduleId: string,
  updates: {
    schedule?: Schedule;
    enabled?: boolean;
    data?: TData;
  }
): ScheduledJob<TData> | { error: string } {
  const existing = scheduledJobs.get(scheduleId);

  if (!existing) {
    return { error: 'SCHEDULE_NOT_FOUND' };
  }

  if (updates.schedule && !validateSchedule(updates.schedule)) {
    return { error: 'INVALID_SCHEDULE' };
  }

  const updated: ScheduledJob<TData> = {
    ...existing,
    data: updates.data ?? existing.data,
    schedule: updates.schedule ?? existing.schedule,
    enabled: updates.enabled ?? existing.enabled,
  } as ScheduledJob<TData>;

  // Recalculate next run if schedule changed or job was enabled
  if (updated.enabled && (updates.schedule || updates.enabled)) {
    updated.nextRunAt = calculateNextRun(updated.schedule);
  }

  scheduledJobs.set(scheduleId, updated);
  return updated;
}

/**
 * Delete a scheduled job
 */
export function deleteSchedule(scheduleId: string): boolean {
  return scheduledJobs.delete(scheduleId);
}

/**
 * Enable a scheduled job
 */
export function enableSchedule(scheduleId: string): ScheduledJob | undefined {
  const job = scheduledJobs.get(scheduleId);
  if (job) {
    job.enabled = true;
    job.nextRunAt = calculateNextRun(job.schedule);
  }
  return job;
}

/**
 * Disable a scheduled job
 */
export function disableSchedule(scheduleId: string): ScheduledJob | undefined {
  const job = scheduledJobs.get(scheduleId);
  if (job) {
    job.enabled = false;
    job.nextRunAt = undefined;
  }
  return job;
}

/**
 * Process due scheduled jobs
 */
export function processDueSchedules(): JobId[] {
  const now = new Date();
  const enqueuedJobs: JobId[] = [];

  for (const scheduledJob of scheduledJobs.values()) {
    if (!scheduledJob.enabled || !scheduledJob.nextRunAt) {
      continue;
    }

    if (scheduledJob.nextRunAt <= now) {
      // Check overlap behavior
      if (
        scheduledJob.lastJobId &&
        scheduledJob.overlapBehavior !== OverlapBehavior.ENQUEUE
      ) {
        const lastJob = getJob(scheduledJob.lastJobId);
        const isStillRunning =
          lastJob &&
          (lastJob.status === 'WAITING' ||
            lastJob.status === 'ACTIVE' ||
            lastJob.status === 'DELAYED');

        if (isStillRunning) {
          if (scheduledJob.overlapBehavior === OverlapBehavior.SKIP) {
            // Skip this run
            scheduledJob.nextRunAt = calculateNextRun(
              scheduledJob.schedule,
              now
            );
            continue;
          } else if (scheduledJob.overlapBehavior === OverlapBehavior.CANCEL) {
            // Cancel the previous job
            cancelJob(scheduledJob.lastJobId);
          }
        }
      }

      // Enqueue the job
      const result = enqueue(
        scheduledJob.queueId,
        scheduledJob.name,
        scheduledJob.data
      );

      if ('jobId' in result) {
        scheduledJob.lastJobId = result.jobId;
        scheduledJob.lastRunAt = now;
        enqueuedJobs.push(result.jobId);
      }

      // Calculate next run
      scheduledJob.nextRunAt = calculateNextRun(scheduledJob.schedule, now);
    }
  }

  return enqueuedJobs;
}

/**
 * Get all scheduled jobs that are due
 */
export function getDueSchedules(): ScheduledJob[] {
  const now = new Date();
  return Array.from(scheduledJobs.values()).filter(
    (job) => job.enabled && job.nextRunAt && job.nextRunAt <= now
  );
}

/**
 * Clear all scheduled jobs (for testing)
 */
export function clearScheduledJobs(): void {
  scheduledJobs.clear();
}

export default {
  calculateNextRun,
  validateSchedule,
  createSchedule,
  getScheduledJob,
  getScheduledJobsForQueue,
  updateSchedule,
  deleteSchedule,
  enableSchedule,
  disableSchedule,
  processDueSchedules,
  getDueSchedules,
  clearScheduledJobs,
};
