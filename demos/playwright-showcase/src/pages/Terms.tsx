import LegalPageLayout from '@/components/LegalPageLayout';

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms and Conditions"
      description="Terms of service for using Shipgate."
      lastUpdated="February 11, 2026"
    >
      <h2>Agreement to Terms</h2>
      <p>
        By accessing or using Shipgate&apos;s website, CLI tools, documentation, or related services
        (&quot;Services&quot;), you agree to be bound by these Terms and Conditions (&quot;Terms&quot;).
        If you are using the Services on behalf of an organization, you represent that you have the
        authority to bind that organization to these Terms.
      </p>

      <h2>Description of Services</h2>
      <p>
        Shipgate provides proof-driven code verification and gating tools. Our Services include the
        Shipgate CLI, ISL (Intent Specification Language) tooling, VS Code extension, GitHub Actions
        integration, and associated documentation. The core CLI and specification language are available
        under the MIT license.
      </p>

      <h2>Acceptable Use</h2>
      <p>
        You agree to use the Services only for lawful purposes and in accordance with these Terms.
        You will not:
      </p>
      <ul>
        <li>Use the Services to violate any applicable law, regulation, or third-party rights</li>
        <li>Attempt to reverse engineer, decompile, or disassemble the Services (except as permitted by the MIT license for open-source components)</li>
        <li>Probe, scan, or test the vulnerability of our systems or networks without authorization</li>
        <li>Use the Services to distribute malware, spam, or other harmful content</li>
        <li>Circumvent or disable any security or access control features</li>
      </ul>

      <h2>Account and Registration</h2>
      <p>
        Certain features may require account registration. You are responsible for maintaining the
        confidentiality of your account credentials and for all activities under your account. You must
        notify us immediately of any unauthorized use.
      </p>

      <h2>Intellectual Property</h2>
      <p>
        Shipgate and its licensors retain all rights, title, and interest in and to the Services,
        including all intellectual property rights. The open-source components (e.g., ISL parser,
        core verification logic) are licensed under the MIT license; see the applicable repository
        for details.
      </p>

      <h2>Subscriptions and Payment</h2>
      <p>
        Paid plans (e.g., Team, Enterprise) are subject to additional subscription terms. Fees are
        billed in advance. We may change pricing with 30 days&apos; notice. Refunds are handled in
        accordance with our refund policy at the time of purchase.
      </p>

      <h2>Disclaimer of Warranties</h2>
      <p>
        THE SERVICES ARE PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND,
        EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
        FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
        SERVICES WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHIPGATE AND ITS AFFILIATES, DIRECTORS, OFFICERS,
        EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, OR GOODWILL, ARISING
        OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES. OUR TOTAL LIABILITY SHALL NOT
        EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
      </p>

      <h2>Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless Shipgate and its affiliates from and
        against any claims, damages, losses, liabilities, and expenses (including reasonable
        attorneys&apos; fees) arising out of your use of the Services or violation of these Terms.
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or terminate your access to the Services at any time for violation of these
        Terms or for any other reason. You may terminate your account at any time. Upon termination,
        your right to use the Services ceases immediately.
      </p>

      <h2>Governing Law</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the State of
        Delaware, United States, without regard to its conflict of law provisions. Any disputes
        shall be resolved in the courts of Delaware.
      </p>

      <h2>Changes</h2>
      <p>
        We may modify these Terms at any time. We will notify you of material changes by posting
        the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued use
        of the Services after such changes constitutes acceptance of the modified Terms.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about these Terms, contact us at{' '}
        <a href="mailto:legal@shipgate.dev">legal@shipgate.dev</a>.
      </p>
    </LegalPageLayout>
  );
}
