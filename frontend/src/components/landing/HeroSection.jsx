import { useTranslation } from "react-i18next";
import PosterCollage from "./PosterCollage";
import WaitlistForm from "./WaitlistForm";

export default function HeroSection() {
  const { t } = useTranslation();

  return (
    <section className="relative flex min-h-screen items-center overflow-hidden bg-zinc-950">
      <PosterCollage />

      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-24 text-center">
        <span className="inline-block rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-amber-200">
          {t("Coming Soon")}
        </span>

        <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl">
          <span className="text-glow-gold">{t("Meet Your Movie Match")}</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
          {t(
            "Cinephix finds people who share your exact taste in movies and shows — sync your CineGraph, discover your next favorite, and build your watch circle."
          )}
        </p>

        <div id="waitlist" className="mt-10 flex flex-col items-center gap-4">
          <WaitlistForm className="flex flex-col items-center" />

          <div className="mt-4 flex items-center gap-2 text-xs uppercase tracking-widest text-white/40">
            <span className="h-px w-8 bg-white/20" />
            {t("Available Soon On")}
            <span className="h-px w-8 bg-white/20" />
          </div>

          {/* Real App Store/Google Play badges swap in here once the
              listings are live — plain text placeholders for now rather
              than linking a store page that doesn't exist yet. */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/50">
              App Store
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/50">
              Google Play
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
