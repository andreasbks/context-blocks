import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Context Blocks",
  description: "Privacy policy pursuant to GDPR",
};

export default function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>

      {/* 1. Controller */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">1. Controller</h2>
        <p className="text-muted-foreground leading-relaxed">
          Controller within the meaning of the General Data Protection
          Regulation (GDPR):
        </p>
        <p>
          Andreas Bakakis
          <br />
          Fasanenstraße 23a
          <br />
          53179 Bonn
          <br />
          Email:{" "}
          <a
            href="mailto:andreas.bakakis@gmail.com"
            className="text-primary underline underline-offset-4"
          >
            andreas.bakakis@gmail.com
          </a>
        </p>
      </section>

      {/* 2. Overview */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">2. Overview</h2>
        <p className="text-muted-foreground leading-relaxed">
          Context Blocks is an AI-powered conversational platform. We only
          process personal data to the extent necessary to provide our service.
          This privacy policy explains the nature, scope, and purpose of
          personal data processing.
        </p>
      </section>

      {/* 3. Legal bases */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">3. Legal bases for processing</h2>
        <p className="text-muted-foreground leading-relaxed">
          Your data is processed on the following legal bases:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>
            <strong>Art. 6(1)(b) GDPR</strong> &mdash; Performance of a
            contract: processing necessary to provide the service (e.g. account
            creation, AI conversations).
          </li>
          <li>
            <strong>Art. 6(1)(f) GDPR</strong> &mdash; Legitimate interest:
            ensuring operations, abuse prevention, and service improvement.
          </li>
        </ul>
      </section>

      {/* 4. Data collected */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Types of data collected</h2>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">
            a) Registered users (via Clerk)
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            When you register, the following data is processed through our
            authentication provider Clerk: email address, first name, last name,
            and authentication credentials. This data is necessary for account
            creation and management.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">b) Demo mode (no account)</h3>
          <p className="text-muted-foreground leading-relaxed">
            Demo mode allows you to use the service without registering. A
            pseudonymised record is created (identifier:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              demo_&lt;UUID&gt;
            </code>
            ) that cannot be linked to a real person. Demo data is automatically
            deleted after 24 hours. A functional cookie (
            <code className="text-xs bg-muted px-1 py-0.5 rounded">
              demo-session
            </code>
            ) is set to identify the session.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">c) Usage data</h3>
          <p className="text-muted-foreground leading-relaxed">
            When you access our website, the following data is automatically
            processed: IP address (stored in hashed form), timestamp, and
            requested URL. This data is used for abuse prevention and is not
            used to identify individual users.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-medium">d) Conversation data</h3>
          <p className="text-muted-foreground leading-relaxed">
            Messages you enter in the chat are sent to OpenAI to generate AI
            responses. Please do not enter sensitive personal data in the chat.
            Conversation data of registered users is stored in our database.
            Demo conversations are automatically deleted after 24 hours.
          </p>
        </div>
      </section>

      {/* 5. Processors */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">
          5. Processors and third-party providers
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          We use the following service providers that process personal data on
          our behalf:
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-semibold">Provider</th>
                <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
                <th className="text-left py-2 font-semibold">Location</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="py-2 pr-4">OpenAI, LLC</td>
                <td className="py-2 pr-4">
                  Generating AI responses from user messages
                </td>
                <td className="py-2">USA</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Vercel Inc.</td>
                <td className="py-2 pr-4">Web application hosting</td>
                <td className="py-2">USA</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Clerk Inc.</td>
                <td className="py-2 pr-4">
                  Authentication and user management
                </td>
                <td className="py-2">USA</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4">Langfuse GmbH</td>
                <td className="py-2 pr-4">
                  Observability and prompt management (optional)
                </td>
                <td className="py-2">Germany / EU</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Third-country transfers */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          6. Data transfers to third countries
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Some of our processors are based in the USA. Data transfers are
          conducted on the basis of the EU-US Data Privacy Framework (adequacy
          decision by the European Commission pursuant to Art. 45 GDPR) and
          supplemented by Standard Contractual Clauses (Art. 46(2)(c) GDPR).
        </p>
      </section>

      {/* 7. Cookies */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">7. Cookies</h2>
        <p className="text-muted-foreground leading-relaxed">
          We only use technically necessary cookies that are required for the
          operation of the service:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>
            <strong>Clerk authentication cookies</strong> &mdash; For session
            management of logged-in users.
          </li>
          <li>
            <strong>
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                demo-session
              </code>
            </strong>{" "}
            &mdash; Functional cookie to identify the demo session. HttpOnly,
            24-hour lifetime.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          As these are exclusively technically necessary cookies, no consent is
          required pursuant to § 25(2) no. 2 TTDSG.
        </p>
      </section>

      {/* 8. Retention */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">8. Data retention</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>
            <strong>Demo data:</strong> Automatically deleted after 24 hours.
          </li>
          <li>
            <strong>Registered users:</strong> Data is stored as long as the
            account exists. All associated data is removed upon account
            deletion.
          </li>
          <li>
            <strong>Server logs:</strong> IP addresses are stored only in hashed
            form and are not used to identify individual users.
          </li>
        </ul>
      </section>

      {/* 9. Your rights */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">9. Your rights</h2>
        <p className="text-muted-foreground leading-relaxed">
          Under the GDPR, you have the following rights:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-1">
          <li>
            <strong>Access</strong> (Art. 15 GDPR) &mdash; Right to information
            about your stored data.
          </li>
          <li>
            <strong>Rectification</strong> (Art. 16 GDPR) &mdash; Right to
            correct inaccurate data.
          </li>
          <li>
            <strong>Erasure</strong> (Art. 17 GDPR) &mdash; Right to deletion of
            your data.
          </li>
          <li>
            <strong>Restriction</strong> (Art. 18 GDPR) &mdash; Right to
            restrict processing.
          </li>
          <li>
            <strong>Data portability</strong> (Art. 20 GDPR) &mdash; Right to
            receive your data in a common format.
          </li>
          <li>
            <strong>Objection</strong> (Art. 21 GDPR) &mdash; Right to object to
            processing based on legitimate interests.
          </li>
        </ul>
        <p className="text-muted-foreground leading-relaxed">
          To exercise your rights, please contact:{" "}
          <a
            href="mailto:andreas.bakakis@gmail.com"
            className="text-primary underline underline-offset-4"
          >
            andreas.bakakis@gmail.com
          </a>
        </p>
      </section>

      {/* 10. Supervisory authority */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          10. Right to lodge a complaint
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          You have the right to lodge a complaint with a data protection
          supervisory authority regarding the processing of your personal data.
          The competent authority is:
        </p>
        <p>
          Landesbeauftragte für Datenschutz und Informationsfreiheit
          Nordrhein-Westfalen
          <br />
          Kavalleriestraße 2–4
          <br />
          40213 Düsseldorf
          <br />
          <a
            href="https://www.ldi.nrw.de"
            className="text-primary underline underline-offset-4"
            target="_blank"
            rel="noopener noreferrer"
          >
            www.ldi.nrw.de
          </a>
        </p>
      </section>

      {/* 11. Updates */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">11. Changes to this policy</h2>
        <p className="text-muted-foreground leading-relaxed">
          Last updated: March 2026. We reserve the right to update this privacy
          policy to reflect changes in legal requirements or to our service.
        </p>
      </section>

      <div className="pt-8 border-t">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Back to homepage
        </Link>
      </div>
    </div>
  );
}
