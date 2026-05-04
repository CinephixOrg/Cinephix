export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-primary mb-2">Terms of Service</h1>
      <p className="text-xs text-base-content/40 mb-8">Last updated: May 2025</p>

      <div className="space-y-8 text-base-content/80 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using Cinephix, you agree to be bound by these Terms of
            Service. If you do not agree to these terms, please do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">2. Eligibility</h2>
          <p>
            You must be at least 13 years old to use Cinephix. By using the platform, you confirm
            that you meet this age requirement. If you are under 18, you should have parental
            consent before registering.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">3. Your Account</h2>
          <p>
            You are responsible for maintaining the security of your account credentials. Do not
            share your password with others. You are responsible for all activity that occurs
            under your account. Notify us immediately at{" "}
            <a href="mailto:cinephix3@gmail.com" className="text-primary hover:underline">
              cinephix3@gmail.com
            </a>{" "}
            if you suspect unauthorized access.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">4. Acceptable Use</h2>
          <p className="mb-2">When using Cinephix, you agree not to:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Post content that is abusive, hateful, harassing, or discriminatory</li>
            <li>Impersonate other users or public figures</li>
            <li>Spam, flood, or otherwise disrupt community spaces</li>
            <li>Attempt to access accounts, systems, or data that are not yours</li>
            <li>Upload malware or any code designed to harm the platform or its users</li>
            <li>Use the platform for any unlawful purpose</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">5. User Content</h2>
          <p>
            You retain ownership of the content you post on Cinephix (reviews, ratings,
            messages, etc.). By posting, you grant Cinephix a non-exclusive, royalty-free license
            to display and distribute that content on the platform. You are solely responsible
            for ensuring that your content does not infringe the rights of any third party.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">6. Intellectual Property</h2>
          <p>
            The Cinephix name, logo, and platform design are the property of the Cinephix team.
            You may not copy, reproduce, or distribute any part of the platform without explicit
            written permission.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">7. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms of
            Service, without prior notice. You may delete your account at any time through the
            Settings page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">8. Disclaimer of Warranties</h2>
          <p>
            Cinephix is provided "as is" without warranties of any kind. We do not guarantee
            uninterrupted or error-free operation of the platform. We are not liable for any
            loss of data or damages arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">9. Changes to Terms</h2>
          <p>
            We may revise these Terms at any time. Continued use of Cinephix after changes
            are posted means you accept the revised terms. We will notify you of significant
            changes via the platform or email.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-base-content mb-2">10. Contact</h2>
          <p>
            Questions about these Terms? Reach us at{" "}
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
