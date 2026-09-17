import { useTranslation } from "react-i18next";
import WaitlistForm from "./WaitlistForm";

export default function FinalCta() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-zinc-950 px-6 py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,201,74,0.12),transparent_60%)]" />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
          <span className="text-glow-gold">{t("Meet Your Movie Match")}</span>
        </h2>
        <p className="mt-4 max-w-md text-white/60">
          {t(
            "Cinephix finds people who share your exact taste in movies and shows — sync your CineGraph, discover your next favorite, and build your watch circle."
          )}
        </p>
        <WaitlistForm className="mt-8 flex flex-col items-center" />
      </div>
    </section>
  );
}
