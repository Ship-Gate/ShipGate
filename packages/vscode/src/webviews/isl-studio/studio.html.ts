/**
 * ISL Studio HTML Template
 * 
 * Builds the complete HTML for the ISL Studio webview panel.
 */

import type { StudioState } from './studioState';
import { buildPromptBox } from './components/PromptBox';
import { buildSpecPreview } from './components/SpecPreview';
import { buildStatusPanel } from './components/StatusPanel';
import { buildStudioStyles } from './studioStyles';

/**
 * Build the complete ISL Studio HTML
 */
export function buildStudioHtml(
  state: StudioState,
  nonce: string,
  cspSource: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>ISL Studio</title>
  <style>${buildStudioStyles()}</style>
</head>
<body>
  <div class="studio-container">
    <!-- Header -->
    <header class="studio-header">
      <div class="studio-title">
        <svg class="studio-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
          <line x1="12" y1="22" x2="12" y2="15.5"/>
          <polyline points="22 8.5 12 15.5 2 8.5"/>
          <polyline points="2 15.5 12 8.5 22 15.5"/>
          <line x1="12" y1="2" x2="12" y2="8.5"/>
        </svg>
        ISL Studio
        <span class="studio-subtitle">Intent Specification Language</span>
      </div>
      <button class="icon-button" data-action="openSettings" title="Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </header>

    <!-- Left Panel: Prompt + Preview -->
    <div class="left-panel">
      ${buildPromptBox(state)}
      ${buildSpecPreview(state.spec)}
    </div>

    <!-- Right Panel: Status -->
    <div class="right-panel">
      ${buildStatusPanel(state)}
    </div>

    <!-- Footer -->
    <footer class="studio-footer">
      <span>ISL v1.0.0</span>
      <span>${state.specPath ? state.specPath : 'No spec file'}</span>
    </footer>
  </div>

  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      
      // Restore state
      const previousState = vscode.getState() || ${JSON.stringify(state)};
      
      // DOM Elements
      const promptInput = document.getElementById('prompt-input');
      const charCount = document.getElementById('char-count');
      const activityLog = document.getElementById('activity-log');
      
      // Event Handlers
      
      // Prompt input
      if (promptInput) {
        promptInput.addEventListener('input', (e) => {
          const value = e.target.value;
          if (charCount) {
            charCount.textContent = value.length;
          }
          vscode.setState({ ...previousState, prompt: value });
        });
        
        // Ctrl+Enter to generate
        promptInput.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            const prompt = promptInput.value.trim();
            if (prompt) {
              vscode.postMessage({ type: 'generateSpec', prompt });
            }
          }
        });
      }
      
      // Action buttons
      document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', (e) => {
          const action = e.currentTarget.dataset.action;
          const prompt = promptInput ? promptInput.value.trim() : '';
          
          switch (action) {
            case 'generate':
              if (prompt) {
                vscode.postMessage({ type: 'generateSpec', prompt });
              }
              break;
            case 'generateAndBuild':
              if (prompt) {
                vscode.postMessage({ type: 'generateAndBuild', prompt });
              }
              break;
            case 'audit':
              vscode.postMessage({ type: 'auditExisting' });
              break;
            case 'cancel':
              vscode.postMessage({ type: 'cancelOperation' });
              break;
            case 'copySpec':
              vscode.postMessage({ type: 'copySpec' });
              break;
            case 'saveSpec':
              vscode.postMessage({ type: 'saveSpec' });
              break;
            case 'openSettings':
              vscode.postMessage({ type: 'openSettings' });
              break;
          }
        });
      });
      
      // Spec tabs
      document.querySelectorAll('.spec-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const tabId = e.currentTarget.dataset.tab;
          
          // Update active tab
          document.querySelectorAll('.spec-tab').forEach(t => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          
          // Show corresponding content
          document.querySelectorAll('.spec-tab-content').forEach(content => {
            content.classList.toggle('hidden', content.id !== 'tab-' + tabId);
          });
        });
      });
      
      // Question answers
      document.querySelectorAll('.option-button').forEach(button => {
        button.addEventListener('click', (e) => {
          const questionId = e.currentTarget.dataset.questionId;
          const answer = e.currentTarget.dataset.answer;
          
          // Update UI
          const parent = e.currentTarget.closest('.question-options');
          parent.querySelectorAll('.option-button').forEach(b => b.classList.remove('selected'));
          e.currentTarget.classList.add('selected');
          
          // Send message
          vscode.postMessage({ type: 'answerQuestion', questionId, answer });
        });
      });
      
      document.querySelectorAll('.question-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const questionId = e.target.dataset.questionId;
          const answer = e.target.value;
          vscode.postMessage({ type: 'answerQuestion', questionId, answer });
        });
      });
      
      // Message handler from extension
      window.addEventListener('message', (event) => {
        const message = event.data;
        
        switch (message.type) {
          case 'updateState':
            vscode.setState(message.state);
            // Full re-render would happen here in a real implementation
            // For now, we handle specific updates
            break;
            
          case 'setLoading':
            // Update loading state
            document.body.classList.toggle('loading', message.isLoading);
            break;
            
          case 'appendLog':
            if (activityLog) {
              const entry = document.createElement('div');
              entry.className = 'log-entry';
              entry.textContent = message.log;
              activityLog.appendChild(entry);
              activityLog.scrollTop = activityLog.scrollHeight;
            }
            break;
            
          case 'setError':
            // Error handling would trigger re-render
            break;
        }
      });
      
      // Auto-scroll activity log
      if (activityLog) {
        activityLog.scrollTop = activityLog.scrollHeight;
      }
    })();
  </script>
</body>
</html>`;
}
