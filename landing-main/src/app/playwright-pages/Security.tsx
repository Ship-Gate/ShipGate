import LegalPageLayout from '@/components/LegalPageLayout';
import { Shield } from 'lucide-react';

export default function Security() {
  return (
    <LegalPageLayout
      title="Security"
      description="How Shipgate protects your code and data."
      lastUpdated="February 11, 2026"
    >
      <div className="mb-12 p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 text-emerald-400 shrink-0 mt-0.5" strokeWidth={2} />
          <div>
            <h3 className="font-semibold text-white mb-2">Local-first by design</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Shipgate runs verification entirely on your machine. Your source code is never uploaded
              to our servers. We cannot access, store, or inspect your codebase.
            </p>
          </div>
        </div>
      </div>

      <h2>Code and Data Handling</h2>

      <h3>No code upload</h3>
      <p>
        The Shipgate CLI and VS Code extension operate locally. Verification, gating, and evidence
        generation happen on your workstation or CI runner. We do not receive, transmit, or store
        your source code.
      </p>

      <h3>Truthpack and config</h3>
      <p>
        The truthpack (routes, contracts, env vars) is built from your codebase locally. Configuration
        files such as <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-sm">.shipgate.yml</code> remain
        in your repository. We do not collect or transmit these files.
      </p>

      <h2>Security Practices</h2>

      <h3>Encryption</h3>
      <ul>
        <li><strong>In transit:</strong> All communication with our website and APIs uses TLS 1.3</li>
        <li><strong>At rest:</strong> Any data we store (e.g., account info) is encrypted using industry-standard encryption</li>
      </ul>

      <h3>Access control</h3>
      <ul>
        <li>Principle of least privilege for internal systems</li>
        <li>Multi-factor authentication for administrative access</li>
        <li>Regular access reviews and audits</li>
      </ul>

      <h3>Software supply chain</h3>
      <ul>
        <li>Dependencies are regularly audited and updated</li>
        <li>Publish checksums and signed releases where applicable</li>
        <li>Open-source components are vetted before inclusion</li>
      </ul>

      <h2>Incident Response</h2>
      <p>
        We have incident response procedures to detect, contain, and remediate security issues.
        In the event of a data breach affecting user data, we will notify affected users and
        relevant authorities as required by applicable law.
      </p>

      <h2>Reporting Vulnerabilities</h2>
      <p>
        We encourage responsible disclosure of security vulnerabilities. If you discover a
        vulnerability, please report it to <a href="mailto:security@shipgate.dev">security@shipgate.dev</a>.
        We aim to acknowledge reports within 48 hours and will not take legal action against
        researchers who follow responsible disclosure practices.
      </p>

      <h2>Compliance</h2>
      <p>
        Shipgate is designed with enterprise compliance in mind. Contact us for information about
        SOC 2, HIPAA, or other compliance frameworks.
      </p>

      <h2>Contact</h2>
      <p>
        For security-related inquiries, contact{' '}
        <a href="mailto:security@shipgate.dev">security@shipgate.dev</a>.
      </p>
    </LegalPageLayout>
  );
}
