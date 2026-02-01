/**
 * Prompt Box Component
 * 
 * Input area for natural language specification prompts.
 * Includes textarea and action buttons for generation modes.
 */

import type { StudioState, GenerationMode } from '../studioState';

/**
 * Build the prompt input box HTML
 */
export function buildPromptBox(state: StudioState): string {
  const { prompt, status, isLoading } = state;
  const isDisabled = isLoading || status === 'generating' || status === 'building' || status === 'auditing';
  const disabledAttr = isDisabled ? 'disabled' : '';
  
  return `
    <div class="prompt-box">
      <div class="prompt-header">
        <h2 class="prompt-title">
          <svg class="prompt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Describe Your Intent
        </h2>
        <span class="prompt-hint">Natural language specification</span>
      </div>
      
      <div class="prompt-input-container">
        <textarea
          id="prompt-input"
          class="prompt-textarea"
          placeholder="Describe what your API or system should do...

Example: Create a user registration endpoint that validates email format, hashes passwords with bcrypt, and returns a JWT token on success."
          rows="6"
          ${disabledAttr}
        >${escapeHtml(prompt)}</textarea>
        
        <div class="prompt-footer">
          <div class="char-count">
            <span id="char-count">${prompt.length}</span> characters
          </div>
        </div>
      </div>
      
      <div class="action-buttons">
        ${buildActionButton('generate', 'Generate Spec', 'M9 12l2 2 4-4', state)}
        ${buildActionButton('generateAndBuild', 'Generate & Build', 'M13 10V3L4 14h7v7l9-11h-7z', state)}
        ${buildActionButton('audit', 'Audit Existing', 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', state)}
        
        ${isLoading ? buildCancelButton() : ''}
      </div>
    </div>
  `;
}

/**
 * Build an action button
 */
function buildActionButton(
  mode: GenerationMode,
  label: string,
  iconPath: string,
  state: StudioState
): string {
  const { status, isLoading } = state;
  const isActive = isLoading && (
    (mode === 'generate' && status === 'generating') ||
    (mode === 'generateAndBuild' && (status === 'generating' || status === 'building')) ||
    (mode === 'audit' && status === 'auditing')
  );
  const isDisabled = isLoading && !isActive;
  
  const buttonClass = [
    'action-button',
    mode === 'generateAndBuild' ? 'primary' : 'secondary',
    isActive ? 'active' : '',
    isDisabled ? 'disabled' : ''
  ].filter(Boolean).join(' ');
  
  return `
    <button
      class="${buttonClass}"
      data-action="${mode}"
      ${isDisabled ? 'disabled' : ''}
    >
      <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="${iconPath}"/>
      </svg>
      <span class="button-label">${label}</span>
      ${isActive ? '<span class="spinner-small"></span>' : ''}
    </button>
  `;
}

/**
 * Build cancel button
 */
function buildCancelButton(): string {
  return `
    <button class="action-button cancel" data-action="cancel">
      <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M15 9l-6 6M9 9l6 6"/>
      </svg>
      <span class="button-label">Cancel</span>
    </button>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return text.replace(/[&<>"']/g, char => escapeMap[char]);
}
