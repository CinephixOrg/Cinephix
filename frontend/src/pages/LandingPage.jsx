import LandingNavbar from "../components/landing/LandingNavbar";
import HeroSection from "../components/landing/HeroSection";
import FeaturesShowcase from "../components/landing/FeaturesShowcase";
import ScreenshotShowcase from "../components/landing/ScreenshotShowcase";
import FinalCta from "../components/landing/FinalCta";
import Footer from "../components/Footer";

// The site's new front door — a marketing page for the mobile app, not the
// functional web client WelcomePage.jsx used to lead into. Forces the
// "black" DaisyUI theme regardless of whatever's in localStorage, so
// Footer's own DaisyUI-token classes (text-primary, bg-base-300, ...)
// resolve to the same dark palette this page's own bespoke Tailwind classes
// already commit to, rather than whatever theme a returning visitor
// happened to have picked before the web app was retired.
export default function LandingPage() {
  return (
    <div data-theme="black" className="bg-zinc-950">
      <LandingNavbar />
      <HeroSection />
      <FeaturesShowcase />
      <ScreenshotShowcase />
      <FinalCta />
      <Footer />
    </div>
  );
}
