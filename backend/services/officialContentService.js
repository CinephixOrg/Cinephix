import mongoose from "mongoose";
import Share from "../models/Share.js";
import User from "../models/User.js";
import Rating from "../models/Rating.js";
import Review from "../models/Review.js";
import OfficialContent from "../models/OfficialContent.js";
import OfficialContentLapState from "../models/OfficialContentLapState.js";
import { computeLeaderboard, getPeopleThreePodiums } from "../controllers/feedController.js";
import { logger } from "../middleware/logger.js";

const getMovie = () => mongoose.connection.model("Movie");
const getSeries = () => mongoose.connection.model("Series");

// On lap completion, soft-retire (never hard-delete — kept for history/
// reversibility) up to this many of the oldest "active" trivia_rich items
// and activate up to that many "pending" ones to backfill — flexible, not
// rigid: fewer are swapped in if fewer pending items are actually ready,
// rather than forcing in low-quality filler. Exactly the dynamic agreed on:
// fixed pool size, no stacking new facts on top of the old ones.
const RETIRE_BATCH = 30;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Category 1 (trivia) only — every post gets a randomly-picked opener
// prepended at post time (see postOfficialContent's own "trivia" branch),
// not baked into the stored fact text. Applies uniformly to pool-drawn
// facts AND both DB-native templates.
const TRIVIA_OPENERS = ["Did you know?", "Fun fact:", "Here's one for you:"];
function withTriviaOpener(fact) {
  return `${choice(TRIVIA_OPENERS)} ${fact}`;
}

async function getOfficialUserId() {
  const user = await User.findOne({ isOfficial: true }).select("_id").lean();
  if (!user) throw new Error("Official Cinephix account not found — run scripts/seedOfficialAccount.js first");
  return user._id;
}

async function hydrateContentData(contentId, contentType) {
  const model = contentType === "movie" ? getMovie() : getSeries();
  const doc = await model.findById(contentId).select("title name poster_path release_date first_air_date").lean();
  if (!doc) return null;
  const date = contentType === "movie" ? doc.release_date : doc.first_air_date;
  return {
    title: doc.title || doc.name,
    posterUrl: doc.poster_path || null,
    releaseYear: date ? new Date(date).getFullYear() : undefined,
  };
}

// ── Fixed-size lap rotation for pool-backed categories ──────────────────
// Shuffle the active pool into a "lap" order, post through it with no
// repeats, and on lap completion (trivia_rich only) rotate in fresh content
// before reshuffling for the next lap — the exact dynamic agreed on.
async function pickFromPool(category) {
  let lapState = await OfficialContentLapState.findOne({ category });
  if (!lapState) lapState = await OfficialContentLapState.create({ category, order: [], position: 0 });

  if (lapState.position >= lapState.order.length) {
    if (category === "trivia_rich") {
      const oldestActive = await OfficialContent.find({ category, status: "active" }).sort({ addedAt: 1 }).limit(RETIRE_BATCH);
      const pending = await OfficialContent.find({ category, status: "pending" })
        .sort({ addedAt: 1 })
        .limit(oldestActive.length || RETIRE_BATCH);
      const swapCount = Math.min(oldestActive.length, pending.length);
      if (swapCount > 0) {
        await OfficialContent.updateMany(
          { _id: { $in: oldestActive.slice(0, swapCount).map((d) => d._id) } },
          { $set: { status: "retired" } }
        );
        await OfficialContent.updateMany(
          { _id: { $in: pending.slice(0, swapCount).map((d) => d._id) } },
          { $set: { status: "active", addedAt: new Date() } }
        );
        logger.info(`officialContentService: rotated ${swapCount} trivia_rich items (oldest retired, pending activated)`);
      }
    }
    const active = await OfficialContent.find({ category, status: "active" }).select("_id").lean();
    lapState.order = shuffle(active.map((d) => d._id));
    lapState.position = 0;
  }

  if (lapState.order.length === 0) {
    await lapState.save();
    return null;
  }

  const contentId = lapState.order[lapState.position];
  lapState.position += 1;
  await lapState.save();

  const content = await OfficialContent.findById(contentId);
  if (content) {
    content.lastUsedAt = new Date();
    await content.save();
  }
  return content;
}

// ── DB-native trivia (dynamically generated, no pool) ────────────────────
const LANGUAGE_NAMES = {
  en: "English", ko: "South Korean", ja: "Japanese", fr: "French", de: "German",
  es: "Spanish", it: "Italian", tr: "Turkish", zh: "Chinese", hi: "Indian", ru: "Russian",
  pt: "Portuguese", sv: "Swedish", da: "Danish", no: "Norwegian", nl: "Dutch",
  th: "Thai", id: "Indonesian", pl: "Polish", fi: "Finnish",
};
const COUNTRY_NAMES = {
  US: "American", KR: "South Korean", JP: "Japanese", FR: "French", DE: "German",
  ES: "Spanish", IT: "Italian", TR: "Turkish", CN: "Chinese", IN: "Indian", GB: "British",
  RU: "Russian", BR: "Brazilian", SE: "Swedish", DK: "Danish", NO: "Norwegian", NL: "Dutch",
  TH: "Thai", ID: "Indonesian", PL: "Polish", FI: "Finnish", CA: "Canadian", MX: "Mexican",
};

// "a" vs "an" depends on the following word's SOUND, not just spelling
// (e.g. "a European," "an hour"), but a simple vowel-letter check is close
// enough for this fixed, hand-picked name list — every entry above actually
// follows the simple rule correctly (no "European"/"hour"-style exceptions
// in this set).
const articleFor = (word) => (/^[aeiou]/i.test(word) ? "an" : "a");

async function generateSameDayReleaseTrivia() {
  const Movie = getMovie();
  // No poster (tried, then deliberately reverted — no real DB-load reason,
  // the user just preferred keeping this template visually consistent with
  // every other plain-text trivia post), but each title IS linked to its
  // own content detail page — much cheaper than a poster (just the id
  // alongside the title, not the poster_path string), and explicitly
  // requested once the poster idea was dropped. Still keeps the two real
  // fixes discovered while building the poster version, since both are
  // genuine correctness/performance issues independent of what's shown:
  // grouping the ENTIRE 578k+ movie collection by release_date exceeded
  // Mongo's $group memory limit even with allowDiskUse — bounded to a
  // random 8000-doc sample first instead, which caps memory regardless of
  // collection size (a lower chance of finding a coincidence per run is
  // fine, this template is only rolled 25% of the time with a pool
  // fallback on null). Also excludes a few known placeholder/default dates
  // (2000-01-01 alone matched 36 movies in one sample — a dead giveaway of
  // an "unknown date" fallback value in the source data, not a real
  // coincidence) plus a matched-group-size cap as a defensive catch-all
  // against any other undiscovered placeholders.
  const PLACEHOLDER_DATES = ["1970-01-01", "1900-01-01", "1901-01-01", "2000-01-01"];
  const [group] = await Movie.aggregate([
    { $match: { release_date: { $nin: [null, "", ...PLACEHOLDER_DATES] } } },
    { $sample: { size: 8000 } },
    { $group: { _id: "$release_date", items: { $push: { id: "$_id", title: "$title" } }, count: { $sum: 1 } } },
    { $match: { count: { $gte: 2, $lte: 6 } } },
    { $sample: { size: 1 } },
  ]);
  const validItems = (group?.items || []).filter((it) => it.title);
  if (validItems.length < 2) return null;

  const [a, b] = shuffle(validItems).slice(0, 2);
  const dateStr = new Date(group._id).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  return {
    officialText: `${a.title} and ${b.title} were released on the very same day (${dateStr})! 🎬`,
    officialLinks: [
      { word: a.title, contentId: a.id.toString(), contentType: "movie" },
      { word: b.title, contentId: b.id.toString(), contentType: "movie" },
    ],
  };
}

async function generateOriginCountryTrivia() {
  const useMovie = Math.random() < 0.5;
  if (useMovie) {
    const Movie = getMovie();
    const [doc] = await Movie.aggregate([{ $match: { original_language: { $exists: true, $ne: null, $ne: "" } } }, { $sample: { size: 1 } }]);
    if (!doc) return null;
    const langName = LANGUAGE_NAMES[doc.original_language] || doc.original_language?.toUpperCase();
    return {
      officialText: `${doc.title} is ${articleFor(langName)} ${langName} production. 🌏`,
      // No contentData/poster — tried, then dropped for the same
      // consistency reason same-day-release trivia never got one: every
      // other trivia post (the 300-item pool, same-day-release) is plain
      // text, and having just this one template show an image read as
      // inconsistent within the category. contentId/contentType stay (the
      // whole box still navigates on tap, via handleContentPress in
      // ShareCard.tsx), and the title word is still its own explicit link
      // below — just no picture.
      contentId: doc._id.toString(),
      contentType: "movie",
      officialLinks: [{ word: doc.title, contentId: doc._id.toString(), contentType: "movie" }],
    };
  }
  const Series = getSeries();
  const [doc] = await Series.aggregate([
    { $match: { origin_country: { $exists: true, $ne: [], $ne: null } } },
    { $sample: { size: 1 } },
  ]);
  if (!doc) return null;
  const code = Array.isArray(doc.origin_country) ? doc.origin_country[0] : doc.origin_country;
  const countryName = COUNTRY_NAMES[code] || code;
  return {
    officialText: `${doc.name} is ${articleFor(countryName)} ${countryName} production. 🌏`,
    contentId: doc._id.toString(),
    contentType: "series",
    officialLinks: [{ word: doc.name, contentId: doc._id.toString(), contentType: "series" }],
  };
}

async function generateDbNativeTrivia() {
  const template = Math.random() < 0.5 ? generateSameDayReleaseTrivia : generateOriginCountryTrivia;
  try {
    return await template();
  } catch (err) {
    logger.error(`officialContentService: db-native trivia generation failed: ${err.message}`);
    return null;
  }
}

// ── Fully dynamic categories (no pool, generated fresh each post) ───────
// Deliberately restricted to ONLY the two rankings that are free-tier-open
// on BOTH podiums (Discover's "Highest Rated" and Medya's "Most Reviewed")
// — a real tier-integrity issue caught live: the original 5-candidate
// version included Most Favorited/Most Recommended (content) and Most
// Followed/Top Recommenders (people), three of which are Premium-only (and
// one Plus+) podium categories. Broadcasting "X is the most-favorited
// title right now" to every viewer for free would hand Free/Plus users
// exactly the paid answer the podium's own paywall is built to withhold —
// undermining the whole tier-gating feature this session built earlier.
// These 2 leak nothing: a Free viewer can already see both on their own
// podium, so announcing them changes nothing about what's paywalled.
async function generateHighlight() {
  const [leaderboard, people] = await Promise.all([computeLeaderboard(null), getPeopleThreePodiums(null)]);
  const candidates = [];

  if (leaderboard.highestRated[0]) {
    const c = leaderboard.highestRated[0].content;
    // Closing CTA instead of a separate poster-side title heading — the
    // title only needs to appear once. ShareCard.tsx's own officialBox no
    // longer renders a heading above the sentence for content-linked
    // official posts (direct fix: showing "Oppenheimer" as a bold heading
    // right next to a sentence that already says "...right now:
    // Oppenheimer!" read as a flat-out repeat).
    candidates.push({
      officialText: `The highest-rated title right now: ${c.title}! ⭐ Tap to check it out!`,
      contentId: c.id,
      contentType: c.type,
      contentData: await hydrateContentData(c.id, c.type),
    });
  }
  if (people.mostReviewed[0]) {
    const u = people.mostReviewed[0].user;
    candidates.push({
      officialText: `${u.username} is this period's most active reviewer! ✍️`,
      officialLinks: [{ word: u.username, href: `/user/${u.id}` }],
    });
  }

  if (!candidates.length) return null;
  return choice(candidates);
}

async function generateOnThisDayForModel(model, dateField, titleField) {
  const now = new Date();
  const [doc] = await model.aggregate([
    { $addFields: { _date: { $convert: { input: `$${dateField}`, to: "date", onError: null, onNull: null } } } },
    { $match: { _date: { $ne: null } } },
    { $addFields: { _month: { $month: "$_date" }, _day: { $dayOfMonth: "$_date" } } },
    { $match: { _month: now.getMonth() + 1, _day: now.getDate() } },
    { $sample: { size: 1 } },
  ]);
  if (!doc) return null;
  const title = doc[titleField];
  const year = new Date(doc[dateField]).getFullYear();
  const contentType = dateField === "release_date" ? "movie" : "series";
  return {
    officialText: `On this day in ${year}, ${title} was released! 🎬 Tap to check it out!`,
    contentId: doc._id.toString(),
    contentType,
    contentData: await hydrateContentData(doc._id.toString(), contentType),
  };
}

async function generateOnThisDay() {
  const useMovie = Math.random() < 0.5;
  const primary = useMovie
    ? await generateOnThisDayForModel(getMovie(), "release_date", "title")
    : await generateOnThisDayForModel(getSeries(), "first_air_date", "name");
  if (primary) return primary;
  // Fall back to the other content type if today has no match there
  return useMovie
    ? await generateOnThisDayForModel(getSeries(), "first_air_date", "name")
    : await generateOnThisDayForModel(getMovie(), "release_date", "title");
}

async function generateStats() {
  const [userCount, ratingCount, reviewCount, shareCount] = await Promise.all([
    User.countDocuments({}),
    Rating.countDocuments({}),
    Review.countDocuments({}),
    Share.countDocuments({}),
  ]);
  return {
    officialText: `The Cinephix community is growing: ${userCount} users, ${ratingCount} ratings, ${reviewCount} reviews, and ${shareCount} shares! 📊`,
  };
}

// ── Orchestrator ──────────────────────────────────────────────────────
// One of the 7 approved content categories → one new Share doc, posted as
// the official Cinephix account. Returns null (never throws for "no content
// available yet") when a pool is empty or a dynamic generator finds nothing
// to say this run — callers should log and move on, not treat it as fatal.
export async function postOfficialContent(category) {
  const officialUserId = await getOfficialUserId();

  const createOfficial = (officialCategory, payload) =>
    Share.create({ user: officialUserId, type: "official", isOfficialPost: true, officialCategory, ...payload });

  if (category === "trivia") {
    let payload = Math.random() < 0.25 ? await generateDbNativeTrivia() : null;
    if (!payload) {
      const pooled = await pickFromPool("trivia_rich");
      if (!pooled) {
        logger.warn("officialContentService: trivia_rich pool empty, skipping post");
        return null;
      }
      payload = { officialText: pooled.text };
    }
    // One shared opener pool for ALL of category 1 — pool-drawn facts and
    // both DB-native templates alike — applied here at post time rather
    // than baked into the 300 stored strings, so it stays random per post
    // instead of frozen to whichever opener a fact happened to be seeded
    // with. A fixed "Did you know?" on literally every single post read as
    // repetitive; rotating a few keeps the same trivia "voice" without the
    // fatigue of the exact same three words every time.
    payload.officialText = withTriviaOpener(payload.officialText);
    return createOfficial("trivia", payload);
  }

  if (category === "tip" || category === "announcement") {
    const pooled = await pickFromPool(category === "tip" ? "tip" : "announcement");
    if (!pooled) {
      logger.warn(`officialContentService: ${category} pool empty, skipping post`);
      return null;
    }
    return createOfficial(category, {
      officialText: pooled.text,
      officialLinks: pooled.linkWord && pooled.linkHref ? [{ word: pooled.linkWord, href: pooled.linkHref }] : [],
    });
  }

  if (category === "highlight") {
    const payload = await generateHighlight();
    if (!payload) return null;
    return createOfficial("highlight", payload);
  }

  if (category === "on_this_day") {
    const payload = await generateOnThisDay();
    if (!payload) return null;
    return createOfficial("on_this_day", payload);
  }

  if (category === "stats") {
    return createOfficial("stats", await generateStats());
  }

  if (category === "poll") {
    const pooled = await pickFromPool("poll");
    if (!pooled) {
      logger.warn("officialContentService: poll pool empty, skipping post");
      return null;
    }
    return Share.create({
      user: officialUserId,
      type: "poll",
      isOfficialPost: true,
      pollData: { question: pooled.pollQuestion, options: (pooled.pollOptions || []).map((text) => ({ text, votes: [] })) },
    });
  }

  throw new Error(`Unknown official content category: ${category}`);
}
