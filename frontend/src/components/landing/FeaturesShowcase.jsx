import { useTranslation } from "react-i18next";
import { FiUsers, FiTrendingUp, FiMessageCircle, FiAward } from "react-icons/fi";
import FeatureSection from "./FeatureSection";

// The 4 features the user picked out of the app's full feature set for this
// showcase — Sync/CineMatch, Leaderboards, Social sharing, Badges.
export default function FeaturesShowcase() {
  const { t } = useTranslation();

  return (
    <section className="bg-zinc-950 px-6">
      <div className="mx-auto max-w-5xl divide-y divide-white/5">
        <FeatureSection
          icon={<FiUsers />}
          accent="#FFC94A"
          title={t("Sync With Your Taste Twin")}
          body={t(
            "Every person's CineGraph is unique. Cinephix matches you with people whose taste genuinely lines up with yours — not just genres, but how you rate, watch, and react."
          )}
        />
        <FeatureSection
          reverse
          icon={<FiTrendingUp />}
          accent="#6EE7B7"
          title={t("See What's Actually Trending")}
          body={t(
            "Real leaderboards for what your community is watching, rating, and loving right now — not a generic algorithm feed."
          )}
        />
        <FeatureSection
          icon={<FiMessageCircle />}
          accent="#93C5FD"
          title={t("Share the Way You Actually Talk About Movies")}
          body={t(
            "Post reviews, recommend hidden gems, or start a poll asking what to watch tonight — your feed, your taste, your people."
          )}
        />
        <FeatureSection
          reverse
          icon={<FiAward />}
          accent="#F0ABFC"
          title={t("Turn Watching Into a Game")}
          body={t(
            "Earn badges as you explore genres, build streaks, and grow your taste — a whole achievement system built around how you actually watch."
          )}
        />
      </div>
    </section>
  );
}
