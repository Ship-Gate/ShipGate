// ============================================================================
// Observability Standard Library - Alerting Implementation
// @isl-lang/stdlib-observability
// ============================================================================

/// <reference types="node" />

import {
  UUID,
  Duration,
  ComparisonOperator,
  AlertThreshold,
  AlertState,
  AlertSeverity,
  AlertRule,
  Alert,
  CreateAlertRuleInput,
  AcknowledgeAlertInput,
  SilenceAlertInput,
  Result,
  success,
  failure,
} from './types';

// ============================================================================
// ID Generation
// ============================================================================

declare const crypto: {
  randomUUID?: () => string;
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
} | undefined;

function generateUUID(): UUID {
  if (typeof crypto !== 'undefined' && crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// Threshold Evaluation
// ============================================================================

export function evaluateThreshold(
  value: number,
  threshold: AlertThreshold
): boolean {
  switch (threshold.operator) {
    case ComparisonOperator.GREATER_THAN:
      return value > threshold.value;
    case ComparisonOperator.GREATER_THAN_OR_EQUAL:
      return value >= threshold.value;
    case ComparisonOperator.LESS_THAN:
      return value < threshold.value;
    case ComparisonOperator.LESS_THAN_OR_EQUAL:
      return value <= threshold.value;
    case ComparisonOperator.EQUAL:
      return value === threshold.value;
    case ComparisonOperator.NOT_EQUAL:
      return value !== threshold.value;
    default:
      return false;
  }
}

// ============================================================================
// Notification Channel Interface
// ============================================================================

export interface NotificationChannel {
  name: string;
  send(alert: Alert, rule: AlertRule): Promise<void>;
}

// ============================================================================
// Console Notification Channel
// ============================================================================

export class ConsoleNotificationChannel implements NotificationChannel {
  name = 'console';

  async send(alert: Alert, rule: AlertRule): Promise<void> {
    const severity = rule.severity.toUpperCase();
    const state = alert.state.toUpperCase();
    const output = `[ALERT ${severity}] ${rule.name} - State: ${state} - Value: ${alert.value}`;
    
    if (rule.severity === AlertSeverity.CRITICAL) {
      if (typeof process !== 'undefined' && process.stderr?.write) {
        process.stderr.write(output + '\n');
      }
    } else if (rule.severity === AlertSeverity.WARNING) {
      if (typeof process !== 'undefined' && process.stderr?.write) {
        process.stderr.write(output + '\n');
      }
    } else {
      if (typeof process !== 'undefined' && process.stdout?.write) {
        process.stdout.write(output + '\n');
      }
    }
  }
}

// ============================================================================
// Query Evaluator Interface
// ============================================================================

export interface QueryEvaluator {
  evaluate(query: string): Promise<number>;
}

// ============================================================================
// Simple Query Evaluator (for testing)
// ============================================================================

export class SimpleQueryEvaluator implements QueryEvaluator {
  private values: Map<string, number> = new Map();

  setValue(query: string, value: number): void {
    this.values.set(query, value);
  }

  async evaluate(query: string): Promise<number> {
    return this.values.get(query) ?? 0;
  }
}

// ============================================================================
// Alert Manager
// ============================================================================

export class AlertManager {
  private readonly rules: Map<UUID, AlertRule> = new Map();
  private readonly alerts: Map<UUID, Alert> = new Map();
  private readonly channels: Map<string, NotificationChannel> = new Map();
  private readonly queryEvaluator: QueryEvaluator;
  private evaluationTimer?: ReturnType<typeof setInterval>;
  private readonly pendingTimers: Map<UUID, Date> = new Map();

  constructor(
    queryEvaluator: QueryEvaluator,
    channels: NotificationChannel[] = [new ConsoleNotificationChannel()]
  ) {
    this.queryEvaluator = queryEvaluator;
    for (const channel of channels) {
      this.channels.set(channel.name, channel);
    }
  }

  // ==========================================================================
  // Rule Management
  // ==========================================================================

  createRule(input: CreateAlertRuleInput): Result<AlertRule> {
    try {
      // Validate notification channels exist
      for (const channelName of input.notificationChannels) {
        if (!this.channels.has(channelName)) {
          return failure(
            new Error(`Notification channel not found: ${channelName}`)
          );
        }
      }

      const rule: AlertRule = {
        id: generateUUID(),
        name: input.name,
        description: input.description,
        query: input.query,
        threshold: input.threshold,
        forDuration: input.forDuration,
        evaluationInterval: 60000, // 1 minute default
        state: AlertState.INACTIVE,
        severity: input.severity,
        labels: input.labels,
        annotations: input.annotations,
        notificationChannels: input.notificationChannels,
      };

      this.rules.set(rule.id, rule);
      return success(rule);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  getRule(ruleId: UUID): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  deleteRule(ruleId: UUID): boolean {
    return this.rules.delete(ruleId);
  }

  listRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  // ==========================================================================
  // Alert Management
  // ==========================================================================

  getAlert(alertId: UUID): Alert | undefined {
    return this.alerts.get(alertId);
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(
      (a) => a.state === AlertState.FIRING || a.state === AlertState.PENDING
    );
  }

  getAlertsByRule(ruleId: UUID): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => a.ruleId === ruleId);
  }

  acknowledgeAlert(input: AcknowledgeAlertInput): Result<Alert> {
    try {
      const alert = this.alerts.get(input.alertId);
      if (!alert) {
        return failure(new Error('Alert not found'));
      }

      // Check if already acknowledged
      const lastNotification = alert.notifications[alert.notifications.length - 1];
      if (lastNotification?.acknowledgedAt) {
        return failure(new Error('Alert already acknowledged'));
      }

      // Add acknowledgment to last notification
      if (lastNotification) {
        lastNotification.acknowledgedAt = new Date();
        lastNotification.acknowledgedBy = input.acknowledgedBy;
      }

      return success(alert);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  silenceRule(input: SilenceAlertInput): Result<void> {
    try {
      const rule = this.rules.get(input.ruleId);
      if (!rule) {
        return failure(new Error('Rule not found'));
      }

      rule.silencedUntil = input.until;
      return success(undefined);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  // ==========================================================================
  // Evaluation
  // ==========================================================================

  async evaluateRule(ruleId: UUID): Promise<Result<AlertState>> {
    try {
      const rule = this.rules.get(ruleId);
      if (!rule) {
        return failure(new Error('Rule not found'));
      }

      // Check if silenced
      if (rule.silencedUntil && rule.silencedUntil > new Date()) {
        return success(rule.state);
      }

      // Evaluate query
      const value = await this.queryEvaluator.evaluate(rule.query);
      const thresholdExceeded = evaluateThreshold(value, rule.threshold);

      // State machine transitions
      const previousState = rule.state;
      let newState = rule.state;

      if (thresholdExceeded) {
        if (rule.state === AlertState.INACTIVE) {
          if (rule.forDuration && rule.forDuration > 0) {
            newState = AlertState.PENDING;
            this.pendingTimers.set(ruleId, new Date());
          } else {
            newState = AlertState.FIRING;
          }
        } else if (rule.state === AlertState.PENDING) {
          const pendingStart = this.pendingTimers.get(ruleId);
          if (
            pendingStart &&
            Date.now() - pendingStart.getTime() >= (rule.forDuration ?? 0)
          ) {
            newState = AlertState.FIRING;
            this.pendingTimers.delete(ruleId);
          }
        }
      } else {
        if (
          rule.state === AlertState.FIRING ||
          rule.state === AlertState.PENDING
        ) {
          newState = AlertState.RESOLVED;
          this.pendingTimers.delete(ruleId);
        } else if (rule.state === AlertState.RESOLVED) {
          newState = AlertState.INACTIVE;
        }
      }

      rule.state = newState;

      // Handle state transitions
      if (newState !== previousState) {
        if (newState === AlertState.FIRING) {
          rule.activeSince = new Date();
          await this.createAndNotifyAlert(rule, value);
        } else if (newState === AlertState.RESOLVED) {
          await this.resolveAlerts(rule);
        }
      }

      return success(newState);
    } catch (err) {
      return failure(err instanceof Error ? err : new Error(String(err)));
    }
  }

  async evaluateAllRules(): Promise<void> {
    for (const [ruleId] of this.rules) {
      await this.evaluateRule(ruleId);
    }
  }

  // ==========================================================================
  // Notification
  // ==========================================================================

  private async createAndNotifyAlert(
    rule: AlertRule,
    value: number
  ): Promise<void> {
    const alert: Alert = {
      id: generateUUID(),
      ruleId: rule.id,
      state: AlertState.FIRING,
      startedAt: new Date(),
      labels: rule.labels ?? {},
      annotations: rule.annotations,
      value,
      notifications: [],
    };

    this.alerts.set(alert.id, alert);

    // Send notifications
    for (const channelName of rule.notificationChannels) {
      const channel = this.channels.get(channelName);
      if (channel) {
        try {
          await channel.send(alert, rule);
          alert.notifications.push({
            channel: channelName,
            sentAt: new Date(),
          });
        } catch {
          // Notification failed, but continue with others
        }
      }
    }
  }

  private async resolveAlerts(rule: AlertRule): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (alert.ruleId === rule.id && alert.state === AlertState.FIRING) {
        alert.state = AlertState.RESOLVED;
        alert.endedAt = new Date();

        // Send resolution notifications
        for (const channelName of rule.notificationChannels) {
          const channel = this.channels.get(channelName);
          if (channel) {
            try {
              await channel.send(alert, rule);
              alert.notifications.push({
                channel: channelName,
                sentAt: new Date(),
              });
            } catch {
              // Notification failed
            }
          }
        }
      }
    }
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  startEvaluation(intervalMs: Duration = 60000): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
    this.evaluationTimer = setInterval(
      () => this.evaluateAllRules(),
      intervalMs
    );
  }

  stopEvaluation(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = undefined;
    }
  }

  // ==========================================================================
  // Channel Management
  // ==========================================================================

  registerChannel(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel);
  }

  unregisterChannel(name: string): boolean {
    return this.channels.delete(name);
  }
}

// ============================================================================
// Default Alert Manager
// ============================================================================

let defaultAlertManager: AlertManager | null = null;

export function getDefaultAlertManager(): AlertManager {
  if (!defaultAlertManager) {
    defaultAlertManager = new AlertManager(new SimpleQueryEvaluator());
  }
  return defaultAlertManager;
}

export function setDefaultAlertManager(manager: AlertManager): void {
  defaultAlertManager = manager;
}

// ============================================================================
// Module Exports
// ============================================================================

export default {
  AlertManager,
  ConsoleNotificationChannel,
  SimpleQueryEvaluator,
  evaluateThreshold,
  getDefaultAlertManager,
  setDefaultAlertManager,
};
