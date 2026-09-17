import { useTranslation } from "react-i18next";
import discoverScreenshot from "../../assets/screenshots/discover.jpeg";
import sharesScreenshot from "../../assets/screenshots/shares.jpeg";
import syncScreenshot from "../../assets/screenshots/sync.jpeg";

// Real screenshots from the running app now (were gradient placeholders —
// this environment has no simulator/browser control to capture one itself,
// so the user supplied these directly).
const MOCKUPS = [
  { key: "sync", image: syncScreenshot },
  { key: "discover", image: discoverScreenshot },
  { key: "feed", image: sharesScreenshot },
];

function PhoneFrame({ image, label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-[420px] w-[210px] overflow-hidden rounded-[2rem] border-4 border-white/10 bg-zinc-900 p-2 shadow-2xl sm:h-[480px] sm:w-[240px]">
        <img src={image} alt={label} className="h-full w-full rounded-[1.5rem] object-cover object-top" />
      </div>
      <span className="text-sm font-medium text-white/50">{label}</span>
    </div>
  );
}

export default function ScreenshotShowcase() {
  const { t } = useTranslation();

  const labels = {
    sync: t("Sync With Your Taste Twin"),
    discover: t("See What's Actually Trending"),
    feed: t("Share the Way You Actually Talk About Movies"),
  };

  return (
    <section className="bg-zinc-950 px-6 py-20">
      <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">{t("See It In Action")}</h2>
      <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-start justify-center gap-8">
        {MOCKUPS.map((m) => (
          <PhoneFrame key={m.key} image={m.image} label={labels[m.key]} />
        ))}
      </div>
    </section>
  );
}
