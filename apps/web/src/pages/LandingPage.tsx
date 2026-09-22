import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRightIcon,
  BoltIcon,
  CheckIcon,
  ChromeIcon,
  CloseIcon,
  EditIcon,
  FitmentIcon,
  FlagIcon,
  ImageIcon,
  LockIcon,
  PlayIcon,
  QuoteIcon,
  ScrapeIcon,
  ShieldIcon,
} from "../landing/LandingIcons";
import { Reveal } from "../landing/Reveal";
import "../landing/landing.css";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#use-cases", label: "Use Cases" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

const PANEL_STEPS = [
  "Full Scrape Mode",
  "Extracting details...",
  "Image collected",
  "Fitment data found",
  "Populating eBay form...",
  "Complete",
] as const;

function BrandMark() {
  return <img src="/logo.png?v=4" alt="" className="brand-mark" />;
}

export function LandingPage() {
  const [videoOpen, setVideoOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!videoOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setVideoOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoOpen]);

  return (
    <div className="landing-page">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />

      <header className="nav">
        <a className="brand" href="#top">
          <BrandMark />
          <span>eBay Sell Similar</span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="nav-actions">
          <Link className="btn-text" to="/login">
            Login
          </Link>
          <Link className="btn-pill" to="/register">
            Sign Up
          </Link>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <Reveal>
            <p className="chrome-badge">
              <ChromeIcon className="chrome-badge-icon" />
              Chrome Extension for eBay
            </p>
          </Reveal>
          <Reveal delayMs={80}>
            <h1>
              Turn eBay Listings
              <span>Into Opportunities</span>
            </h1>
          </Reveal>
          <Reveal delayMs={160}>
            <p className="lead">
              eBay Sell Similar helps you create new listings faster with powerful
              scraping and form-filling — right inside eBay.
            </p>
          </Reveal>
          <Reveal delayMs={240}>
            <div className="hero-actions">
              <Link className="btn-primary" to="/onboarding/install">
                Install Extension
                <ArrowRightIcon />
              </Link>
              <button className="btn-ghost" type="button" onClick={() => setVideoOpen(true)}>
                <PlayIcon />
                Watch Video
              </button>
            </div>
          </Reveal>

          <div className="stage">
            <span className="scribble scribble-left">From this...</span>
            <span className="scribble scribble-right">
              To a new listing
              <br />
              in minutes!
            </span>
            <Reveal className="laptop-wrap" delayMs={120}>
              <div className="laptop" aria-hidden="true">
                <div className="laptop-screen">
                  <article className="listing-card">
                    <div className="listing-photo">
                      <div className="headlamp" />
                    </div>
                    <div className="listing-copy">
                      <p className="listing-kicker">Shop on eBay</p>
                      <h2>
                        For 2016–2019 Honda Civic
                        <br />
                        LED Headlight Assembly
                        <br />
                        Left Driver Side
                      </h2>
                      <ul>
                        <li>Condition: Used</li>
                        <li>Brand: Honda</li>
                        <li>Manufacturer Part Number: 33150-TBA-A01</li>
                      </ul>
                      <p className="listing-price">US $129.99</p>
                    </div>
                  </article>
                  <aside className="ext-panel">
                    <header>
                      <strong>eBay Sell Similar</strong>
                      <span>×</span>
                    </header>
                    <ol>
                      {PANEL_STEPS.map((step, index) => (
                        <li key={step} style={{ animationDelay: `${1.1 + index * 0.35}s` }}>
                          <CheckIcon />
                          {step}
                        </li>
                      ))}
                    </ol>
                    <div className="ext-progress">
                      <span className="ext-progress-fill" />
                      <em>80%</em>
                    </div>
                  </aside>
                </div>
                <div className="laptop-base" />
              </div>
            </Reveal>
          </div>
        </section>

        <section className="stats" aria-label="Highlights">
          <Reveal>
            <article>
              <strong>5x</strong>
              <span>Faster Listing</span>
            </article>
          </Reveal>
          <Reveal delayMs={80}>
            <article>
              <strong>100%</strong>
              <span>Accurate Data</span>
            </article>
          </Reveal>
          <Reveal delayMs={160}>
            <article>
              <strong>Hours</strong>
              <span>Saved Weekly</span>
            </article>
          </Reveal>
        </section>

        <section className="features" id="features">
          <Reveal>
            <article>
              <ScrapeIcon />
              <h3>Full Scrape or Fitment Only</h3>
            </article>
          </Reveal>
          <Reveal delayMs={70}>
            <article>
              <EditIcon />
              <h3>Works on Create &amp; Edit</h3>
            </article>
          </Reveal>
          <Reveal delayMs={140}>
            <article>
              <LockIcon />
              <h3>Secure Authentication</h3>
            </article>
          </Reveal>
          <Reveal delayMs={210}>
            <article>
              <FlagIcon />
              <h3>Built for eBay US Sellers</h3>
            </article>
          </Reveal>
        </section>

        <section className="how" id="use-cases">
          <Reveal>
            <h2>How It Works</h2>
            <p className="section-lead">
              Go from an existing eBay listing to a new, ready-to-review listing in minutes.
              The fastest, easiest way to list. No copy-paste. No tedious work.
            </p>
          </Reveal>
          <div className="how-grid">
            <Reveal>
              <article className="how-card">
                <span className="step">1</span>
                <h3>Paste a source listing</h3>
                <p>Open any similar listing and let the extension do the heavy lifting.</p>
                <div className="fake-input">https://www.ebay.com/itm/...</div>
              </article>
            </Reveal>
            <Reveal delayMs={90}>
              <article className="how-card how-card-live">
                <span className="step">2</span>
                <h3>Process with live progress</h3>
                <p>
                  We scrape the listing, extract key details, images, and fitment data — then
                  populate the eBay form for you.
                </p>
                <ul className="live-list">
                  <li>
                    <CheckIcon /> Extracting details...
                  </li>
                  <li>
                    <CheckIcon /> Image collected
                  </li>
                  <li className="is-active">Populating eBay form... 80%</li>
                </ul>
              </article>
            </Reveal>
            <Reveal delayMs={180}>
              <article className="how-card">
                <span className="step">3</span>
                <h3>Review and list natively</h3>
                <p>Review the filled-in listing inside eBay, make any changes, and publish when you’re ready.</p>
                <button className="ebay-btn" type="button">
                  Create listing
                </button>
                <p className="fine-print">We never auto-submit. You stay in control.</p>
              </article>
            </Reveal>
          </div>
        </section>

        <section className="love">
          <Reveal>
            <h2>Why Sellers Love It</h2>
            <p className="section-lead">
              Join hundreds of eBay sellers who are saving time and growing their business
              with eBay Sell Similar.
            </p>
          </Reveal>
          <div className="love-grid">
            <Reveal>
              <blockquote className="quote-card">
                <p className="stars" aria-label="5 stars">
                  ★★★★★
                </p>
                <p>
                  “This extension has completely changed my workflow. I can now create listings in a
                  fraction of the time! It saves me hours of manual work every week.”
                </p>
                <footer>
                  <span className="avatar" />
                  <span>
                    <strong>Mike R.</strong>
                    <em>eBay Seller</em>
                  </span>
                </footer>
                <QuoteIcon className="quote-mark" />
              </blockquote>
            </Reveal>
            <div className="love-points">
              <Reveal delayMs={60}>
                <article>
                  <BoltIcon />
                  <div>
                    <h3>Works inside eBay</h3>
                    <p>No switching tabs or copy-pasting. Everything happens directly in eBay.</p>
                  </div>
                </article>
              </Reveal>
              <Reveal delayMs={120}>
                <article>
                  <ImageIcon />
                  <div>
                    <h3>Clean structured data</h3>
                    <p>Accurate, organized details and images for high-quality listings.</p>
                  </div>
                </article>
              </Reveal>
              <Reveal delayMs={180}>
                <article>
                  <FitmentIcon />
                  <div>
                    <h3>Fitment-ready workflow</h3>
                    <p>Automatically extracts and organizes fitment data when available.</p>
                  </div>
                </article>
              </Reveal>
              <Reveal delayMs={240}>
                <article>
                  <ShieldIcon />
                  <div>
                    <h3>Human review always required</h3>
                    <p>You stay in control. We never auto-submit listings.</p>
                  </div>
                </article>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="pricing" id="pricing">
          <Reveal>
            <h2>Simple pricing</h2>
            <p className="section-lead">Start listing faster. Upgrade when your catalog grows.</p>
          </Reveal>
          <div className="price-grid">
            <Reveal>
              <article>
                <h3>Starter</h3>
                <p className="price">
                  $0<span>/mo</span>
                </p>
                <ul>
                  <li>Full scrape &amp; fitment-only</li>
                  <li>Live progress in the panel</li>
                  <li>Create &amp; revise listings</li>
                </ul>
                <Link className="btn-ghost" to="/onboarding/install">
                  Install free
                </Link>
              </article>
            </Reveal>
            <Reveal delayMs={90}>
              <article className="is-featured">
                <p className="ribbon">Most used</p>
                <h3>Pro</h3>
                <p className="price">
                  $19<span>/mo</span>
                </p>
                <ul>
                  <li>Everything in Starter</li>
                  <li>Priority scrape throughput</li>
                  <li>Saved fill presets</li>
                </ul>
                <Link className="btn-primary" to="/register">
                  Sign Up
                </Link>
              </article>
            </Reveal>
            <Reveal delayMs={180}>
              <article>
                <h3>Team</h3>
                <p className="price">
                  $49<span>/mo</span>
                </p>
                <ul>
                  <li>Everything in Pro</li>
                  <li>Shared seller workspace</li>
                  <li>Priority support</li>
                </ul>
                <a className="btn-ghost" href="#cta">
                  Contact us
                </a>
              </article>
            </Reveal>
          </div>
        </section>

        <section className="faq" id="faq">
          <Reveal>
            <h2>FAQ</h2>
          </Reveal>
          <div className="faq-list">
            <Reveal>
              <details>
                <summary>Does this auto-list on eBay?</summary>
                <p>No. We fill the listing editor. You review and publish natively on eBay.</p>
              </details>
            </Reveal>
            <Reveal delayMs={70}>
              <details>
                <summary>Does it scrape vehicle compatibility?</summary>
                <p>
                  Yes. Full scrape reads paginated compatibility on the source listing and persist
                  writes it to your draft when that option is enabled.
                </p>
              </details>
            </Reveal>
            <Reveal delayMs={140}>
              <details>
                <summary>Which marketplace is supported?</summary>
                <p>Fitment scrape currently supports eBay US listings.</p>
              </details>
            </Reveal>
            <Reveal delayMs={210}>
              <details>
                <summary>How do I install the extension?</summary>
                <p>
                  Create a free account, then download the extension from your dashboard and load it into Chrome.
                  After install, return here so we can connect the extension to your account. Pin
                  the icon, then open eBay’s Create or Edit Listing page.
                </p>
              </details>
            </Reveal>
          </div>
        </section>

        <section className="cta" id="cta">
          <Reveal>
            <p className="cta-kicker">READY TO LIST SMARTER?</p>
            <h2>Save Hours. List Faster. Grow Bigger.</h2>
            <p className="section-lead">
              Join hundreds of eBay sellers already using eBay Sell Similar.
            </p>
            <div className="hero-actions">
              <Link className="btn-primary" to="/onboarding/install">
                Install Extension
                <ArrowRightIcon />
              </Link>
              <button className="btn-ghost" type="button" onClick={() => setVideoOpen(true)}>
                <PlayIcon />
                Watch Video
              </button>
            </div>
          </Reveal>
          <div className="cta-aside">
            <p className="scribble">
              Same listings.
              <br />
              New possibilities.
            </p>
            <img src="/logo.png?v=4" alt="" className="cta-tiles" />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top">
          <a className="brand" href="#top">
            <BrandMark />
            <span>eBay Sell Similar</span>
          </a>
          <nav aria-label="Footer">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
            <Link to="/login">Login</Link>
            <Link to="/register">Sign Up</Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} eBay Sell Similar. Not affiliated with eBay. Built for eBay
            sellers.
          </p>
          <p>
            <a href="/privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <Link to="/help">Support</Link>
          </p>
        </div>
      </footer>

      {videoOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <button className="modal-backdrop" type="button" aria-label="Close video" onClick={() => setVideoOpen(false)} />
          <div className="modal-card">
            <header>
              <h2 id={titleId}>Watch Sell Similar</h2>
              <button type="button" onClick={() => setVideoOpen(false)} aria-label="Close">
                <CloseIcon />
              </button>
            </header>
            <div className="modal-frame">
              <p>Product walkthrough video will play here.</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
