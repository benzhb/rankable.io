import { LegalContact, LegalPageLayout } from "../components/legal/LegalPageLayout.js";

export function TermsOfServicePage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Terms of Service"
      summary="These terms govern your use of the Rankable.io Discord Activity. By launching or using it, you agree to these terms."
    >
      <section>
        <h2>1. The Service</h2>
        <p>
          Rankable.io is an independently operated multiplayer Discord Activity that lets
          participants collaboratively rank an operator-curated catalog of media cards.
          “Service” means the Rankable.io Activity, website, real-time game features, and
          related services. Rankable.io is not operated, sponsored, or endorsed by Discord Inc.
        </p>
      </section>

      <section>
        <h2>2. Eligibility and acceptance</h2>
        <p>
          You may use the Service only if you are permitted to use Discord, are at least 13
          years old and meet any higher minimum age required in your country, and can
          legally agree to these terms. If you use the Service for an organization, you
          represent that you are authorized to bind that organization.
        </p>
        <p>
          Your use of Discord remains governed by Discord’s{" "}
          <a href="https://discord.com/terms" target="_blank" rel="noreferrer">Terms of Service</a>
          {" "}and{" "}
          <a href="https://discord.com/guidelines" target="_blank" rel="noreferrer">Community Guidelines</a>.
        </p>
      </section>

      <section>
        <h2>3. Account and Activity access</h2>
        <p>
          The Service uses your Discord identity to authenticate you and place you in the
          correct Activity instance. You are responsible for keeping your Discord account
          secure. Do not share Rankable session credentials or attempt to use another
          person’s identity. We may refuse or terminate access when reasonably necessary
          to protect users, Discord, the Service, or third parties.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>use the Service unlawfully or violate Discord’s rules;</li>
          <li>harass other players or use profile information to target or harm anyone;</li>
          <li>interfere with gameplay, overload the Service, automate abusive traffic, or exploit bugs;</li>
          <li>attempt unauthorized access to accounts, servers, databases, credentials, or private storage;</li>
          <li>bypass security, access controls, rate limits, or restrictions;</li>
          <li>introduce malware or otherwise disrupt the Service; or</li>
          <li>use the Service in a way that infringes privacy, intellectual-property, or other legal rights.</li>
        </ul>
      </section>

      <section>
        <h2>5. Media, names, and intellectual property</h2>
        <p>
          The Rankable.io name, interface, and original software and design are owned by
          the Service operator or its licensors. Card titles, artwork, characters,
          trademarks, and other third-party materials remain the property of their
          respective owners. Their appearance does not imply sponsorship or endorsement.
        </p>
        <p>
          You may use the Service for personal, non-commercial gameplay. These terms do
          not grant you permission to extract, redistribute, sell, or commercially reuse
          the media catalog or third-party materials. Rights holders may report a concern
          through the contact method below for prompt review.
        </p>
      </section>

      <section>
        <h2>6. Privacy</h2>
        <p>
          Our <a href="/privacy">Privacy Policy</a> explains the information we process,
          how multiplayer information is displayed, the providers we use, retention, and
          how to request deletion. It is incorporated into these terms by reference.
        </p>
      </section>

      <section>
        <h2>7. Changes, availability, and beta features</h2>
        <p>
          The Service may change, experience interruptions, lose an in-progress game, or
          be discontinued. Features may be experimental. We may add, remove, or modify
          features and may suspend access for maintenance, security, legal compliance, or
          abuse prevention. We do not promise that the Service or any game record will
          always be available, error-free, or preserved.
        </p>
      </section>

      <section>
        <h2>8. Disclaimer</h2>
        <p>
          To the extent permitted by applicable law, the Service is provided “as is” and
          “as available,” without warranties of merchantability, fitness for a particular
          purpose, non-infringement, or uninterrupted operation. Nothing in these terms
          excludes warranties or consumer rights that cannot legally be excluded.
        </p>
      </section>

      <section>
        <h2>9. Limitation of liability</h2>
        <p>
          To the extent permitted by applicable law, the Service operator will not be
          liable for indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for lost data, profits, goodwill, or opportunities arising from the
          Service. Any direct liability will be limited to the greater of the amount you
          paid to use the Service during the twelve months before the event giving rise to
          the claim or USD $50. These limits do not apply where liability cannot legally
          be limited, including liability resulting from fraud or willful misconduct.
        </p>
      </section>

      <section>
        <h2>10. Ending access</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access
          if you violate these terms, create security or legal risk, or if the Service is
          discontinued. Provisions that by their nature should survive termination—including
          intellectual-property, disclaimer, liability, and dispute provisions—will survive.
        </p>
      </section>

      <section>
        <h2>11. Applicable law and disputes</h2>
        <p>
          Applicable mandatory consumer and privacy laws remain in effect. Before filing
          a formal claim, please contact us and give us a reasonable opportunity to resolve
          the issue informally. Nothing here prevents either party from seeking urgent
          injunctive relief or using a court or tribunal where applicable law preserves
          that right.
        </p>
      </section>

      <section>
        <h2>12. Changes to these terms</h2>
        <p>
          We may update these terms to reflect changes to the Service, Discord’s rules, or
          applicable law. The effective date above will be updated. Continuing to use the
          Service after revised terms take effect constitutes acceptance where permitted
          by law; if you do not agree, stop using the Service.
        </p>
      </section>

      <section>
        <h2>13. Contact</h2>
        <p>
          For support, legal questions, privacy requests, or intellectual-property notices,
          contact <LegalContact />. Use a private channel when sharing personal information.
        </p>
      </section>
    </LegalPageLayout>
  );
}
