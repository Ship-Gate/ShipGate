import LegalPageLayout from '@/components/LegalPageLayout';

export default function Privacy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description="How Shipgate collects, uses, and protects your information."
      lastUpdated="February 11, 2026"
    >
      <h2>Overview</h2>
      <p>
        Shipgate (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy.
        This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you
        use our website, CLI tools, and related services (collectively, the &quot;Services&quot;).
      </p>

      <h2>Information We Collect</h2>

      <h3>Information You Provide</h3>
      <ul>
        <li><strong>Account information:</strong> If you create an account, we collect your name, email address, and authentication credentials.</li>
        <li><strong>Contact information:</strong> When you contact us or request support, we collect your name, email, and the content of your message.</li>
        <li><strong>Payment information:</strong> For paid plans, payment processing is handled by third-party providers. We do not store full payment card details.</li>
      </ul>

      <h3>Information Collected Automatically</h3>
      <ul>
        <li><strong>Usage data:</strong> We may collect anonymized usage patterns, such as CLI command invocation (e.g., verify vs. gate), to improve our product.</li>
        <li><strong>Device and browser data:</strong> When you visit our website, we may collect IP address, browser type, and device information for security and analytics.</li>
      </ul>

      <h3>Information We Do Not Collect</h3>
      <p>
        <strong>Shipgate is local-first.</strong> We do not upload, store, or process your source code on our servers.
        Verification runs locally on your machine. Evidence bundles and reports are generated locally unless you
        explicitly choose to share them (e.g., for support or CI artifact upload).
      </p>

      <h2>How We Use Your Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Services</li>
        <li>To respond to your inquiries and support requests</li>
        <li>To send product updates, security alerts, and (with your consent) marketing communications</li>
        <li>To comply with legal obligations and enforce our terms</li>
      </ul>

      <h2>Data Sharing and Disclosure</h2>
      <p>
        We do not sell your personal information. We may share data with:
      </p>
      <ul>
        <li><strong>Service providers:</strong> Hosting, analytics, and support tools that assist in operating our Services (under contractual data protection obligations)</li>
        <li><strong>Legal requirements:</strong> When required by law, court order, or governmental authority</li>
      </ul>

      <h2>Data Retention</h2>
      <p>
        We retain your information only for as long as necessary to fulfill the purposes described in this policy
        or as required by law. Account data is retained until you request deletion or close your account.
      </p>

      <h2>Security</h2>
      <p>
        We implement industry-standard security measures to protect your data, including encryption in transit
        and at rest where applicable. For more details, see our <a href="/security">Security</a> page.
      </p>

      <h2>Your Rights</h2>
      <p>
        Depending on your location, you may have the right to:
      </p>
      <ul>
        <li>Access, correct, or delete your personal data</li>
        <li>Object to or restrict processing</li>
        <li>Data portability</li>
        <li>Withdraw consent where processing is based on consent</li>
      </ul>
      <p>
        To exercise these rights, contact us at <a href="mailto:privacy@shipgate.dev">privacy@shipgate.dev</a>.
      </p>

      <h2>International Transfers</h2>
      <p>
        If you access our Services from outside the United States, your data may be transferred to and processed
        in the U.S. or other jurisdictions. We ensure appropriate safeguards (e.g., standard contractual clauses)
        where required by applicable law.
      </p>

      <h2>Children</h2>
      <p>
        Our Services are not intended for individuals under 16. We do not knowingly collect personal information
        from children under 16.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes by posting
        the updated policy on this page and updating the &quot;Last updated&quot; date.
      </p>

      <h2>Contact Us</h2>
      <p>
        For questions about this Privacy Policy or our data practices, contact us at{' '}
        <a href="mailto:privacy@shipgate.dev">privacy@shipgate.dev</a>.
      </p>
    </LegalPageLayout>
  );
}
