import { LegalContact, LegalPageLayout } from "../components/legal/LegalPageLayout.js";

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Privacy Policy"
      summary="This policy explains what Rankable.io collects, why it is used, where it is processed, and how you can request access or deletion."
    >
      <section>
        <h2>1. Who operates Rankable.io</h2>
        <p>
          Rankable.io is an independently operated Discord Activity (the “Service,” “we,”
          “us,” or “our”). It lets people in the same Discord Activity instance build a
          shared media tier list. Rankable.io is not operated, sponsored, or endorsed by
          Discord Inc.
        </p>
      </section>

      <section>
        <h2>2. Information we process</h2>
        <h3>Discord account information</h3>
        <p>
          When you launch the Activity, we use Discord OAuth with the <code>identify</code>
          scope. We receive and store your Discord user ID, username, global display name
          (if set), avatar identifier, and avatar URL. We also receive the Discord Activity
          instance identifier needed to put participants in the correct lobby.
        </p>

        <h3>Lobby and gameplay information</h3>
        <p>
          We store your lobby membership, join and leave times, leader status, rounds,
          randomized queue position, turns, selected categories and game modes, card
          placements, skips, claims, and tier votes. Other participants in the same
          Activity instance can see your username, avatar, lobby status, queue position,
          gameplay actions, placements, votes after they are revealed, and reactions as
          required for multiplayer play.
        </p>

        <h3>Authentication and live events</h3>
        <p>
          We issue a short-lived random session credential after authentication. The raw
          credential is kept in the open page’s memory; only a one-way hash is stored in
          our database. Discord OAuth access tokens are used transiently to authenticate
          the launch and are not stored in our database. Live cursor/card-drag positions
          and emoji reactions are broadcast to the current game and are not intentionally
          persisted as gameplay records.
        </p>

        <h3>Technical information</h3>
        <p>
          Our hosting providers necessarily receive network and request information such
          as IP addresses, timestamps, browser or device details, and error or security
          logs when you connect. Rankable.io does not currently set its own advertising
          cookies or use analytics or advertising SDKs.
        </p>

        <h3>Information we do not request</h3>
        <p>
          Rankable.io does not request access to Discord messages, voice or video content,
          friend lists, email addresses, or payment information. Players cannot upload
          files or media through the Service.
        </p>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <p>We process information only as reasonably necessary to:</p>
        <ul>
          <li>authenticate launches and associate players with the correct Activity instance;</li>
          <li>operate lobbies, real-time multiplayer games, timers, voting, reactions, and results;</li>
          <li>restore authoritative game state after a temporary connection or server interruption;</li>
          <li>protect the Service, prevent misuse, diagnose errors, and maintain reliability;</li>
          <li>respond to support, privacy, legal, or safety requests; and</li>
          <li>comply with applicable law and Discord’s developer requirements.</li>
        </ul>
        <p>
          Where applicable, our legal bases are performance of the service you request,
          our legitimate interests in operating and securing the Service, compliance with
          legal obligations, and consent where the law requires it.
        </p>
      </section>

      <section>
        <h2>4. How information is disclosed</h2>
        <p>We do not sell personal information or disclose Discord API data to advertisers or data brokers.</p>
        <p>Information may be disclosed in these limited circumstances:</p>
        <ul>
          <li>
            <strong>Other players:</strong> profile and gameplay information is shown to
            participants in your Activity instance so the multiplayer game works.
          </li>
          <li>
            <strong>Service providers:</strong> Discord provides authentication and the
            Activity platform; Render hosts the application and PostgreSQL database; and
            Supabase provides private storage for the operator-supplied media catalog.
            These providers process information on our behalf or as independent providers
            under their own terms and privacy policies.
          </li>
          <li>
            <strong>Legal and safety reasons:</strong> information may be preserved or
            disclosed when reasonably necessary to comply with law, respond to valid legal
            process, investigate abuse, protect users, or defend legal rights.
          </li>
          <li>
            <strong>Service transfer:</strong> if the Service is reorganized or transferred,
            information may transfer with it subject to this policy and applicable law.
          </li>
        </ul>
        <p>
          Provider policies are available from{" "}
          <a href="https://discord.com/privacy" target="_blank" rel="noreferrer">Discord</a>,{" "}
          <a href="https://render.com/privacy" target="_blank" rel="noreferrer">Render</a>, and{" "}
          <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase</a>.
        </p>
      </section>

      <section>
        <h2>5. Retention and deletion</h2>
        <p>
          Session credentials expire after a limited period. Live drag positions and
          reactions disappear when their real-time use ends. Discord profile fields,
          lobby participation, and gameplay records are retained while reasonably needed
          to operate, secure, and maintain the Service. Leaving a lobby does not by itself
          delete historical database records.
        </p>
        <p>
          We delete or de-identify personal information when it is no longer needed for
          the Service, when Discord requires deletion, when required by law, or after a
          valid user request unless a legal obligation requires limited continued
          retention. Backups and provider logs may persist for a limited additional period
          before rotating out.
        </p>
      </section>

      <section>
        <h2>6. Your choices and rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or
          obtain a copy of personal information, or to object to or restrict certain
          processing. To make a request, contact <LegalContact />. Include your Discord
          user ID so we can locate the correct records, but never send your password,
          access token, bot token, or session credential. We may need to verify that the
          Discord account belongs to you before acting on a request.
        </p>
        <p>
          You can stop new collection by not launching the Activity. You may also contact
          your local privacy regulator if you believe a request was not handled properly.
        </p>
      </section>

      <section>
        <h2>7. Children</h2>
        <p>
          The Service is not directed to children under 13 or the higher minimum age
          required to use Discord in their country. We do not knowingly collect personal
          information from anyone who is not permitted to use Discord. Contact us if you
          believe such information has been collected.
        </p>
      </section>

      <section>
        <h2>8. Security and international processing</h2>
        <p>
          We use measures appropriate to this Service, including OAuth authentication,
          hashed session credentials, access-controlled APIs, a private media bucket, and
          encrypted HTTPS/WSS transport. No system is completely secure, so we cannot
          guarantee absolute security. Discord, Render, Supabase, and their subprocessors
          may process information in countries different from yours, where local laws may
          differ.
        </p>
      </section>

      <section>
        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy when the Service or legal requirements change. The
          effective date above will be revised, and material changes will be communicated
          through the Service or its Discord application profile when reasonably possible.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          For privacy questions, data requests, or security reports, contact <LegalContact />.
          Use a private channel for any personal information.
        </p>
      </section>
    </LegalPageLayout>
  );
}
