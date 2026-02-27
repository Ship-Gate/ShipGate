/**
 * Predefined onboarding steps
 */

import { OnboardingStep, OnboardingHandler, OnboardingContext, OnboardingResult } from './types';
import { UUID } from '../types';

/**
 * Step: Create default project
 */
export const createDefaultProjectStep: OnboardingStep = {
  id: 'create_default_project',
  name: 'Create Your First Project',
  description: 'Set up your first project to get started',
  required: true,
  order: 1,
  rollback: true,
  handler: {
    async execute(context: OnboardingContext): Promise<OnboardingResult> {
      try {
        // In a real implementation, this would call your project service
        const projectData = {
          name: context.data.projectName || 'My First Project',
          description: context.data.projectDescription || 'Getting started with our platform',
          organizationId: context.tenantId,
          createdBy: context.userId
        };

        // Simulate project creation
        const project = {
          id: { value: `proj_${Date.now()}` },
          ...projectData,
          createdAt: { value: new Date() },
          updatedAt: { value: new Date() }
        };

        // Store project ID in context for later steps
        context.data.projectId = project.id.value;

        return {
          success: true,
          data: { project }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create project',
          retryable: true
        };
      }
    },

    async rollback(context: OnboardingContext): Promise<void> {
      const projectId = context.data.projectId;
      if (projectId) {
        // In a real implementation, delete the project
        console.log(`Rolling back project creation: ${projectId}`);
      }
    }
  }
};

/**
 * Step: Invite team members
 */
export const inviteTeamMembersStep: OnboardingStep = {
  id: 'invite_team_members',
  name: 'Invite Your Team',
  description: 'Add team members to collaborate on projects',
  required: false,
  order: 2,
  rollback: false,
  dependencies: ['create_default_project'],
  handler: {
    async execute(context: OnboardingContext): Promise<OnboardingResult> {
      try {
        const emails = context.data.teamEmails as string[] || [];
        const invitedMembers = [];

        for (const email of emails) {
          // In a real implementation, send invitations
          const invitation = {
            id: `inv_${Date.now()}_${Math.random()}`,
            email,
            organizationId: context.tenantId,
            invitedBy: context.userId,
            invitedAt: { value: new Date() }
          };
          invitedMembers.push(invitation);
        }

        return {
          success: true,
          data: { invitedMembers }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to invite team members',
          retryable: true
        };
      }
    }
  }
};

/**
 * Step: Configure integrations
 */
export const configureIntegrationsStep: OnboardingStep = {
  id: 'configure_integrations',
  name: 'Set Up Integrations',
  description: 'Connect your favorite tools and services',
  required: false,
  order: 3,
  rollback: true,
  handler: {
    async execute(context: OnboardingContext): Promise<OnboardingResult> {
      try {
        const integrations = context.data.integrations as Record<string, any> || {};
        const configured = [];

        for (const [provider, config] of Object.entries(integrations)) {
          // In a real implementation, configure the integration
          configured.push({
            provider,
            status: 'connected',
            configuredAt: new Date()
          });
        }

        return {
          success: true,
          data: { configuredIntegrations: configured }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to configure integrations',
          retryable: true
        };
      }
    },

    async rollback(context: OnboardingContext): Promise<void> {
      const integrations = context.data.integrations as Record<string, any> || {};
      for (const provider of Object.keys(integrations)) {
        // In a real implementation, disconnect the integration
        console.log(`Rolling back integration: ${provider}`);
      }
    }
  }
};

/**
 * Step: Complete profile
 */
export const completeProfileStep: OnboardingStep = {
  id: 'complete_profile',
  name: 'Complete Your Profile',
  description: 'Tell us more about your organization',
  required: true,
  order: 4,
  rollback: false,
  handler: {
    async execute(context: OnboardingContext): Promise<OnboardingResult> {
      try {
        const profileData = context.data.profile || {};
        
        // In a real implementation, update the organization profile
        const profile = {
          ...profileData,
          tenantId: context.tenantId,
          updatedAt: new Date()
        };

        return {
          success: true,
          data: { profile }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update profile',
          retryable: true
        };
      }
    }
  }
};

/**
 * Step: Schedule kickoff call
 */
export const scheduleKickoffCallStep: OnboardingStep = {
  id: 'schedule_kickoff_call',
  name: 'Schedule Kickoff Call',
  description: 'Book a call with our success team',
  required: false,
  order: 5,
  rollback: false,
  handler: {
    async execute(context: OnboardingContext): Promise<OnboardingResult> {
      try {
        const preferredTime = context.data.kickoffTime;
        
        // In a real implementation, integrate with a calendar service
        const meeting = {
          id: `meeting_${Date.now()}`,
          tenantId: context.tenantId,
          scheduledFor: preferredTime,
          status: 'scheduled',
          createdAt: new Date()
        };

        return {
          success: true,
          data: { meeting }
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to schedule kickoff call',
          retryable: true
        };
      }
    }
  }
};

/**
 * Default onboarding steps for new tenants
 */
export const DEFAULT_ONBOARDING_STEPS: OnboardingStep[] = [
  createDefaultProjectStep,
  inviteTeamMembersStep,
  configureIntegrationsStep,
  completeProfileStep,
  scheduleKickoffCallStep
];

/**
 * Get onboarding steps by plan
 */
export function getOnboardingStepsForPlan(plan: string): OnboardingStep[] {
  switch (plan) {
    case 'FREE':
      return DEFAULT_ONBOARDING_STEPS.filter(step => 
        !['configure_integrations', 'schedule_kickoff_call'].includes(step.id)
      );
    
    case 'STARTER':
      return DEFAULT_ONBOARDING_STEPS.filter(step => 
        step.id !== 'schedule_kickoff_call'
      );
    
    case 'PROFESSIONAL':
    case 'ENTERPRISE':
      return DEFAULT_ONBOARDING_STEPS;
    
    default:
      return DEFAULT_ONBOARDING_STEPS;
  }
}
