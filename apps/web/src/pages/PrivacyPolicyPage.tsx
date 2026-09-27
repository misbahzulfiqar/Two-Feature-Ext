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
          This policy covers the Sell Similar website at two-feature-ext.vercel.app and the Sell
          Similar Chrome extension. It explains what we collect, why, and what we do not do.
          Sell Similar is an independent tool and is not affiliated with, endorsed by, or
          operated by eBay Inc.
        </p>

        <Section title="What we collect">
          <p>
            <strong className="text-ink">Account information.</strong> When you create an
            account we store your email address and a hashed password. We never store your
            password in readable form. When you sign in we store a session so you stay signed
            in.
          </p>
          <p>
            <strong className="text-ink">Listings you choose to copy.</strong> When you run
            the extension we receive the eBay listing URL or item ID you enter, and the public
            listing details read from it: title, price, photos, item specifics, condition,
            description, and vehicle compatibility. These are stored against your account so
            you can see your own history.
          </p>
          <p>
            <strong className="text-ink">Local extension state.</strong> The extension records
            which account it is paired with in your browser&apos;s local storage. That stays on
            your device.
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
            To copy listing details into your own eBay draft, to keep a history of your runs so
            you can revisit them, to sign you in, and to send account emails such as email
            verification and password resets.
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
            database for accounts and listing history, an email provider for account emails,
            and hosting providers for the website and API. They process data on our
            instructions only.
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
            <strong className="text-ink">Storage</strong> to remember which account the
            extension is paired with.
          </p>
          <p>
            <strong className="text-ink">Tabs</strong> to open the setup page once, when the
            extension is installed.
          </p>
        </Section>

        <Section title="Retention and deletion">
          <p>
            We keep your account and listing history until you ask us to delete it. To request
            deletion of your account and its data, email{" "}
            <a className="text-ink underline" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . Uninstalling the extension removes the local pairing state from your browser
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
            and where the change is significant we will notify you by email.
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
