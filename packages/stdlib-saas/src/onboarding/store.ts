/**
 * Onboarding storage interface and in-memory implementation
 */

import { 
  OnboardingFlow, 
  OnboardingSession, 
  OnboardingTemplate,
  OnboardingStatus 
} from './types';

export interface OnboardingStore {
  // Flows
  saveFlow(flow: OnboardingFlow): Promise<OnboardingFlow>;
  findFlow(flowId: string): Promise<OnboardingFlow | null>;
  findAllFlows(): Promise<OnboardingFlow[]>;
  deleteFlow(flowId: string): Promise<void>;
  
  // Sessions
  saveSession(session: OnboardingSession): Promise<OnboardingSession>;
  findSession(sessionId: string): Promise<OnboardingSession | null>;
  findSessionsByTenant(tenantId: string): Promise<OnboardingSession[]>;
  findSessionsByStatus(status: OnboardingStatus): Promise<OnboardingSession[]>;
  
  // Templates
  saveTemplate(template: OnboardingTemplate): Promise<OnboardingTemplate>;
  findTemplate(templateId: string): Promise<OnboardingTemplate | null>;
  findAllTemplates(): Promise<OnboardingTemplate[]>;
}

export class InMemoryOnboardingStore implements OnboardingStore {
  private flows: Map<string, OnboardingFlow> = new Map();
  private sessions: Map<string, OnboardingSession> = new Map();
  private templates: Map<string, OnboardingTemplate> = new Map();
  private tenantSessions: Map<string, string[]> = new Map(); // tenantId -> sessionIds

  // Flows
  async saveFlow(flow: OnboardingFlow): Promise<OnboardingFlow> {
    this.flows.set(flow.id, flow);
    return flow;
  }

  async findFlow(flowId: string): Promise<OnboardingFlow | null> {
    return this.flows.get(flowId) || null;
  }

  async findAllFlows(): Promise<OnboardingFlow[]> {
    return Array.from(this.flows.values());
  }

  async deleteFlow(flowId: string): Promise<void> {
    this.flows.delete(flowId);
  }

  // Sessions
  async saveSession(session: OnboardingSession): Promise<OnboardingSession> {
    this.sessions.set(session.id, session);
    
    // Update tenant index
    const tenantId = session.tenantId.value;
    const tenantSessionIds = this.tenantSessions.get(tenantId) || [];
    if (!tenantSessionIds.includes(session.id)) {
      tenantSessionIds.push(session.id);
      this.tenantSessions.set(tenantId, tenantSessionIds);
    }
    
    return session;
  }

  async findSession(sessionId: string): Promise<OnboardingSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async findSessionsByTenant(tenantId: string): Promise<OnboardingSession[]> {
    const sessionIds = this.tenantSessions.get(tenantId) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter(session => session !== undefined) as OnboardingSession[];
  }

  async findSessionsByStatus(status: OnboardingStatus): Promise<OnboardingSession[]> {
    return Array.from(this.sessions.values())
      .filter(session => session.status === status);
  }

  // Templates
  async saveTemplate(template: OnboardingTemplate): Promise<OnboardingTemplate> {
    this.templates.set(template.id, template);
    return template;
  }

  async findTemplate(templateId: string): Promise<OnboardingTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  async findAllTemplates(): Promise<OnboardingTemplate[]> {
    return Array.from(this.templates.values());
  }
}
