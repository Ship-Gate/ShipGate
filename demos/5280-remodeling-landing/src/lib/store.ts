/**
 * In-memory store for leads (BR-002: all submissions logged).
 * For production, replace with database.
 */

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  serviceInterest?: string;
  createdAt: string;
}

const leads: Lead[] = [];

export function createLead(data: Omit<Lead, 'id' | 'createdAt'>): Lead {
  const lead: Lead = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  leads.push(lead);
  return lead;
}

export function getLeads(): Lead[] {
  return [...leads];
}
