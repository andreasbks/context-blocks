import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal Notice | Context Blocks",
  description: "Legal notice pursuant to § 5 TMG",
};

export default function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-10">
      <h1 className="text-3xl font-bold">Legal Notice (Impressum)</h1>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          Information pursuant to § 5 TMG
        </h2>
        <p>
          Andreas Bakakis
          <br />
          Fasanenstraße 23a
          <br />
          53179 Bonn
          <br />
          Germany
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p>
          Email:{" "}
          <a
            href="mailto:andreas.bakakis@gmail.com"
            className="text-primary underline underline-offset-4"
          >
            andreas.bakakis@gmail.com
          </a>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">
          Editorially responsible (§ 18 para. 2 MStV)
        </h2>
        <p>
          Andreas Bakakis
          <br />
          Fasanenstraße 23a
          <br />
          53179 Bonn
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Disclaimer</h2>

        <h3 className="text-lg font-medium">Liability for content</h3>
        <p className="text-muted-foreground leading-relaxed">
          The contents of our pages were created with the utmost care. However,
          we cannot guarantee the accuracy, completeness, or timeliness of the
          content. As a service provider, we are responsible for our own content
          on these pages under general law pursuant to § 7 para. 1 TMG. However,
          pursuant to §§ 8–10 TMG, we are not obligated to monitor transmitted
          or stored third-party information or to investigate circumstances that
          indicate illegal activity.
        </p>

        <h3 className="text-lg font-medium">Liability for links</h3>
        <p className="text-muted-foreground leading-relaxed">
          Our website contains links to external third-party websites, over
          whose content we have no influence. Therefore, we cannot accept any
          liability for this external content. The respective provider or
          operator of the linked pages is always responsible for their content.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Copyright</h2>
        <p className="text-muted-foreground leading-relaxed">
          The content and works on these pages created by the site operator are
          subject to German copyright law. Duplication, processing,
          distribution, and any form of use beyond the scope of copyright law
          require the written consent of the respective author or creator.
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
