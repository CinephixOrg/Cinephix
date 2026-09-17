import { useTranslation } from "react-i18next";
import cinephixLogo from "../../assets/cinephix_logo.svg";

// The marketing site's own nav — deliberately not the app's real `TopBar`
// (that one assumes a logged-in user: notifications, DM badge, avatar menu,
// none of which apply to an anonymous visitor on the landing page). Sticky,
// transparent-to-solid isn't needed here since the hero itself is already
// dark — just sits on top of it.
export default function LandingNavbar() {
  const { t } = useTranslation();

  const scrollToWaitlist = () => {
    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <img src={cinephixLogo} alt="Cinephix" className="h-8 w-8" />
          <span className="text-lg font-bold tracking-tight text-white">Cinephix</span>
        </div>
        <button
          onClick={scrollToWaitlist}
          className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          {t("Download")}
        </button>
      </div>
    </header>
  );
}
