import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - IntentOS',
  description: 'Privacy policy for IntentOS Dashboard',
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">1. Data Collection</h2>
        <p className="text-muted-foreground mb-4">
          We collect information that you provide directly to us, including:
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Account information (email, username)</li>
          <li>Verification reports and domain data</li>
          <li>Usage analytics and performance metrics</li>
          <li>Cookies and similar tracking technologies</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Data</h2>
        <p className="text-muted-foreground mb-4">We use the collected data to:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Provide and maintain our services</li>
          <li>Process verification requests</li>
          <li>Improve user experience</li>
          <li>Send important notifications</li>
          <li>Comply with legal obligations</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">3. Data Storage and Security</h2>
        <p className="text-muted-foreground">
          We implement industry-standard security measures to protect your data, including
          encryption at rest and in transit. Data is stored securely and access is restricted to
          authorized personnel only.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">4. Your Rights</h2>
        <p className="text-muted-foreground mb-4">You have the right to:</p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Access your personal data</li>
          <li>Request correction of inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Export your data in a standard format</li>
          <li>Opt-out of non-essential cookies</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">5. Cookies</h2>
        <p className="text-muted-foreground">
          We use cookies to enhance your experience. Essential cookies are required for the site to
          function. You can manage cookie preferences through your browser settings or our cookie
          consent banner.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">6. Contact Us</h2>
        <p className="text-muted-foreground">
          If you have questions about this privacy policy or wish to exercise your rights, please
          contact us at privacy@intentlang.dev
        </p>
      </section>

      <p className="text-sm text-muted-foreground mt-8">
        Last updated: {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}
