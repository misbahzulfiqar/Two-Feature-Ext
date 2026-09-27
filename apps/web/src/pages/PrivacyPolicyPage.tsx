import type { ReactNode } from "react";
import { PageContainer } from "../components/LayoutBits";
import { PublicFooter } from "../components/PublicFooter";
import { PublicNavbar } from "../components/PublicNavbar";

const LAST_UPDATED = "22 September 2026";
const CONTACT_EMAIL = "noreply@ebaysellsimilar.com";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-mute">{children}</div>
    </section>
  );
}

/**
 * Public, unauthenticated page. The Chrome Web Store requires a reachable
 * privacy policy URL and reviewers will not have an account, so this route must
 * never sit behind the Protected wrapper.
 */
export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-page">
      <PublicNavbar />
      <PageContainer className="py-12">
        <h1 className="text-3xl font-semibold text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-faint">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-sm leading-relaxed text-mute">
          This policy covers the Sell Similar website at two-feature-ext-web.vercel.app and the Sell
          Similar Chrome extension. It explains what we collect, why, and what we do not do.
          Sell Similar is an independent tool and is not affiliated with, endorsed by, or
          operated by eBay Inc.
        </p>

        <Section title="What we collect">
          <p>
            <strong className="text-ink">No account.</strong> You do not create an account or
            sign in. We do not collect an email address or password to use scrape and fill.
          </p>
          <p>
            <strong className="text-ink">Listings you choose to copy.</strong> When you run
            the extension we receive the eBay listing URL or item ID you enter, and the public
            listing details read from it: item specifics and vehicle compatibility. Those
            details are used to fill the listing you are editing.
          </p>
        </Section>

        <Section title="What we do not collect">
          <p>
            We do not collect your eBay password or eBay session cookies. The extension never
            reads your eBay credentials, and the website never copies login cookies into eBay
            pages.
          </p>
          <p>
            We do not collect your browsing history. The extension runs only on eBay listing
            pages, and only acts when you ask it to.
          </p>
          <p>We do not collect payment card details.</p>
        </Section>

        <Section title="How we use it">
          <p>
            To copy item specifics and vehicle compatibility into your own eBay draft when you
            ask the extension to scrape and fill.
          </p>
          <p>
            Recently scraped listings are cached for a few minutes so repeating the same
            request does not re-fetch the same page. That cache expires automatically.
          </p>
        </Section>

        <Section title="What we never do">
          <p>
            We do not sell your personal information. We do not share it with third parties for
            advertising. We do not use it to build profiles unrelated to the service, and we do
            not use it for creditworthiness or lending decisions.
          </p>
        </Section>

        <Section title="Who processes data for us">
          <p>
            We use a small number of service providers purely to run the product: a cloud
            hosting providers for the website and API. They process data on our instructions
            only.
          </p>
        </Section>

        <Section title="Permissions the extension asks for">
          <p>
            <strong className="text-ink">eBay site access</strong> so the panel can appear on
            the listing editor, read the source listing you name, and fill your draft.
          </p>
          <p>
            <strong className="text-ink">Scripting</strong> because eBay&apos;s form fields are
            rendered by its own framework, so values must be written directly into the page for
            eBay to register them.
          </p>
          <p>
            <strong className="text-ink">Web navigation</strong> because eBay renders vehicle
            compatibility inside a nested frame, which has to be located before it can be
            filled.
          </p>
          <p>
            <strong className="text-ink">Storage</strong> to remember extension settings in
            this browser.
          </p>
          <p>
            <strong className="text-ink">Tabs</strong> to open the setup page once, when the
            extension is installed.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            Scrape results are cached briefly so the same listing is not fetched again right
            away. To ask about data, email{" "}
            <a className="text-ink underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . Uninstalling the extension removes its local settings from your browser
            immediately.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Sell Similar is a tool for eBay sellers and is not directed at children under 13.
            We do not knowingly collect information from children.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If this policy changes materially we will update the date at the top of this page,
            and where the change is significant we will update this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data:{" "}
            <a className="text-ink underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
          </p>
        </Section>
      </PageContainer>
      <PublicFooter />
    </div>
  );
}
