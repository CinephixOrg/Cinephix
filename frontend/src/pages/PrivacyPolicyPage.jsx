export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-primary mb-2">Privacy Policy</h1>
      <p className="text-xs text-base-content/40 mb-8">Last updated: May 2025</p>

      <div className="space-y-8 text-base-content/80 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">1. Introduction</h2>
          <p>
            Welcome to Cinephix. We respect your privacy and are committed to protecting the
            personal information you share with us. This Privacy Policy explains what data we
            collect, how we use it, and the choices you have regarding your information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">2. Information We Collect</h2>
          <p className="mb-2">We collect information you provide directly, including:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Account details such as your username and email address when you register</li>
            <li>Profile information you choose to add (profile picture, bio)</li>
            <li>Content you create — reviews, ratings, watchlist entries, and messages</li>
            <li>Activity on the platform such as follows, likes, and community participation</li>
          </ul>
          <p className="mt-2">
            We also automatically collect limited technical data such as your browser type and
            general usage patterns to help us improve the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>To create and manage your account</li>
            <li>To provide and personalize platform features (e.g., CineMatch recommendations)</li>
            <li>To send notifications relevant to your activity</li>
            <li>To improve and debug the platform</li>
            <li>To communicate with you about important updates</li>
          </ul>
          <p className="mt-2">We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">4. Data Sharing</h2>
          <p>
            Cinephix does not share your personal information with third parties except where
            necessary to operate the service (e.g., hosting providers) or where required by law.
            Content you post publicly — such as reviews and ratings — may be visible to other users.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">5. Data Security</h2>
          <p>
            We take reasonable technical and organizational measures to protect your data from
            unauthorized access, loss, or misuse. Passwords are stored using industry-standard
            hashing algorithms and are never stored in plain text.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">6. Your Rights</h2>
          <p className="mb-2">You have the right to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent at any time by closing your account</li>
          </ul>
          <p className="mt-2">
            To exercise any of these rights, contact us at{" "}
            <a href="mailto:cinephix3@gmail.com" className="text-primary hover:underline">
              cinephix3@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">7. Cookies</h2>
          <p>
            Cinephix uses minimal cookies and local storage to keep you logged in and to remember
            your preferences. We do not use cookies for advertising or cross-site tracking.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Significant changes will be
            communicated via the platform or by email. Continued use of Cinephix after changes
            are posted constitutes your acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">9. Contact</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:cinephix3@gmail.com" className="text-primary hover:underline">
              cinephix3@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
