import { Link } from "react-router-dom";
import { AppLogo } from "./AppLogo";
import { GradientButton, SecondaryButton } from "./Buttons";
import { PageContainer } from "./LayoutBits";

export function PublicFooter() {
  return (
    <footer className="border-t border-line py-8">
      <PageContainer className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <AppLogo />
        <nav className="flex flex-wrap gap-5 text-sm text-mute">
          <a href="/#features">Features</a>
          <a href="/#use-cases">Use Cases</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#faq">FAQ</a>
        </nav>
        <div className="flex gap-2">
          <SecondaryButton href="/login">Login</SecondaryButton>
          <GradientButton href="/register">Sign Up</GradientButton>
        </div>
      </PageContainer>
      <PageContainer className="mt-6 flex flex-col gap-2 text-xs text-faint md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} eBay Sell Similar. Not affiliated with eBay. Built for eBay sellers.</p>
        <p className="flex gap-4">
          <Link to="/privacy">Privacy</Link>
          <Link to="/help">Terms</Link>
          <Link to="/help">Support</Link>
        </p>
      </PageContainer>
    </footer>
  );
}
