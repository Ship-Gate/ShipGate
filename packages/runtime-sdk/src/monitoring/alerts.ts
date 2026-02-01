/**
 * ISL Alerts
 * 
 * Alert triggering based on ISL verification metrics.
 */

import type { Violation } from '../types.js';

export interface AlertOptions {
  /** Alert provider */
  provider: 'pagerduty' | 'opsgenie' | 'slack' | 'webhook' | 'custom';
  /** Alert rules */
  rules: AlertRule[];
  /** Custom alert sender */
  customSender?: AlertSender;
  /** Webhook URL (for webhook provider) */
  webhookUrl?: string;
  /** API key (for PagerDuty, OpsGenie) */
  apiKey?: string;
  /** Slack webhook URL */
  slackWebhook?: string;
  /** Cooldown between same alerts in ms */
  cooldownMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface AlertRule {
  /** Rule ID */
  id?: string;
  /** Condition expression */
  condition: string;
  /** Alert severity */
  severity: 'info' | 'warning' | 'critical';
  /** Alert title */
  title?: string;
  /** Alert message template */
  message?: string;
  /** Channels to notify */
  channels?: string[];
  /** Cooldown override for this rule */
  cooldownMs?: number;
}

export interface AlertSender {
  send(alert: Alert): Promise<void>;
}

export interface Alert {
  ruleId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface RuleState {
  lastTriggered?: Date;
  triggerCount: number;
}

/**
 * ISL Alerter for sending alerts based on verification metrics
 * 
 * @example
 * ```typescript
 * const alerter = new ISLAlerter({
 *   provider: 'slack',
 *   slackWebhook: process.env.SLACK_WEBHOOK,
 *   rules: [
 *     {
 *       condition: 'precondition_failure_rate > 0.01',
 *       severity: 'warning',
 *       title: 'High Precondition Failure Rate',
 *     },
 *     {
 *       condition: 'postcondition_failure_rate > 0.001',
 *       severity: 'critical',
 *       title: 'Postcondition Failures Detected',
 *     },
 *   ],
 * });
 * 
 * alerter.start();
 * ```
 */
export class ISLAlerter {
  private options: AlertOptions;
  private sender: AlertSender;
  private ruleStates = new Map<string, RuleState>();
  private running = false;

  constructor(options: AlertOptions) {
    this.options = options;
    this.sender = options.customSender ?? this.createSender();
  }

  /**
   * Start the alerter
   */
  start(): void {
    this.running = true;
    
    if (this.options.debug) {
      console.log('[ISL Alerter] Started with', this.options.rules.length, 'rules');
    }
  }

  /**
   * Stop the alerter
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Check metrics against rules and trigger alerts
   */
  async checkMetrics(metrics: MetricsSnapshot): Promise<void> {
    if (!this.running) return;

    for (const rule of this.options.rules) {
      const ruleId = rule.id ?? rule.condition;
      
      if (this.evaluateCondition(rule.condition, metrics)) {
        await this.triggerAlert(rule, metrics);
      }
    }
  }

  /**
   * Trigger an alert for a violation
   */
  async alertViolation(violation: Violation): Promise<void> {
    if (!this.running) return;

    const alert: Alert = {
      ruleId: `violation:${violation.type}`,
      severity: violation.type === 'postcondition' ? 'critical' : 'warning',
      title: `ISL ${violation.type} Violation`,
      message: violation.message,
      timestamp: violation.timestamp,
      metadata: {
        domain: violation.domain,
        behavior: violation.behavior,
        condition: violation.condition,
      },
    };

    await this.sender.send(alert);
  }

  /**
   * Manually trigger an alert
   */
  async trigger(alert: Alert): Promise<void> {
    if (!this.running) return;
    await this.sender.send(alert);
  }

  private async triggerAlert(rule: AlertRule, metrics: MetricsSnapshot): Promise<void> {
    const ruleId = rule.id ?? rule.condition;
    const state = this.ruleStates.get(ruleId) ?? { triggerCount: 0 };
    
    // Check cooldown
    const cooldown = rule.cooldownMs ?? this.options.cooldownMs ?? 60000;
    if (state.lastTriggered) {
      const elapsed = Date.now() - state.lastTriggered.getTime();
      if (elapsed < cooldown) {
        return;
      }
    }

    const alert: Alert = {
      ruleId,
      severity: rule.severity,
      title: rule.title ?? `ISL Alert: ${rule.condition}`,
      message: this.formatMessage(rule, metrics),
      timestamp: new Date(),
      metadata: { metrics },
    };

    try {
      await this.sender.send(alert);
      
      state.lastTriggered = new Date();
      state.triggerCount++;
      this.ruleStates.set(ruleId, state);

      if (this.options.debug) {
        console.log('[ISL Alerter] Alert sent:', alert.title);
      }
    } catch (error) {
      if (this.options.debug) {
        console.error('[ISL Alerter] Failed to send alert:', error);
      }
    }
  }

  private evaluateCondition(condition: string, metrics: MetricsSnapshot): boolean {
    // Parse condition like "precondition_failure_rate > 0.01"
    const match = condition.match(/(\w+)_(\w+)\s*([<>]=?|==)\s*([\d.]+)/);
    if (!match) return false;

    const [, type, metric, op, thresholdStr] = match;
    const threshold = parseFloat(thresholdStr!);
    
    let value = 0;
    
    if (metric === 'failure_rate') {
      switch (type) {
        case 'precondition':
          value = metrics.preconditionFailureRate;
          break;
        case 'postcondition':
          value = metrics.postconditionFailureRate;
          break;
        case 'invariant':
          value = metrics.invariantFailureRate;
          break;
      }
    } else if (metric === 'count') {
      switch (type) {
        case 'precondition_failure':
          value = metrics.preconditionFailures;
          break;
        case 'postcondition_failure':
          value = metrics.postconditionFailures;
          break;
      }
    }

    switch (op) {
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      default: return false;
    }
  }

  private formatMessage(rule: AlertRule, metrics: MetricsSnapshot): string {
    let message = rule.message ?? `Alert condition met: ${rule.condition}`;
    
    // Replace placeholders
    message = message.replace('{{precondition_failure_rate}}', String(metrics.preconditionFailureRate));
    message = message.replace('{{postcondition_failure_rate}}', String(metrics.postconditionFailureRate));
    message = message.replace('{{precondition_failures}}', String(metrics.preconditionFailures));
    message = message.replace('{{postcondition_failures}}', String(metrics.postconditionFailures));
    
    return message;
  }

  private createSender(): AlertSender {
    switch (this.options.provider) {
      case 'slack':
        return this.createSlackSender();
      case 'webhook':
        return this.createWebhookSender();
      default:
        return this.createConsoleSender();
    }
  }

  private createSlackSender(): AlertSender {
    const webhookUrl = this.options.slackWebhook;
    
    return {
      async send(alert: Alert): Promise<void> {
        if (!webhookUrl) {
          console.warn('[ISL Alerter] Slack webhook URL not configured');
          return;
        }

        const color = alert.severity === 'critical' ? '#ff0000' 
                    : alert.severity === 'warning' ? '#ffaa00' 
                    : '#00ff00';

        const payload = {
          attachments: [{
            color,
            title: alert.title,
            text: alert.message,
            footer: `ISL Alert | ${alert.timestamp.toISOString()}`,
            fields: Object.entries(alert.metadata ?? {}).map(([key, value]) => ({
              title: key,
              value: String(value),
              short: true,
            })),
          }],
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      },
    };
  }

  private createWebhookSender(): AlertSender {
    const webhookUrl = this.options.webhookUrl;
    
    return {
      async send(alert: Alert): Promise<void> {
        if (!webhookUrl) {
          console.warn('[ISL Alerter] Webhook URL not configured');
          return;
        }

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
        });
      },
    };
  }

  private createConsoleSender(): AlertSender {
    return {
      async send(alert: Alert): Promise<void> {
        const prefix = alert.severity === 'critical' ? '🚨' 
                     : alert.severity === 'warning' ? '⚠️' 
                     : 'ℹ️';
        console.log(`${prefix} [ISL Alert] ${alert.title}: ${alert.message}`);
      },
    };
  }
}

export interface MetricsSnapshot {
  preconditionFailureRate: number;
  postconditionFailureRate: number;
  invariantFailureRate: number;
  preconditionFailures: number;
  postconditionFailures: number;
  invariantFailures: number;
}
