import Group from "../models/Group.js";
import logger from "../middleware/logger.js";

const PRESET_GROUPS = [
  {
    slug: "tarantino-lovers",
    name: "TarantinoLovers",
    description:
      "A community for fans of Quentin Tarantino — discussing his filmography, non-linear storytelling, and cultural impact.",
    category: "director",
    tags: ["quentin-tarantino", "pulp-fiction", "kill-bill", "dialogue-driven"],
  },
  {
    slug: "scorsese-club",
    name: "ScorseseClub",
    description:
      "Dedicated to Martin Scorsese's masterful crime epics, character studies, and unparalleled visual storytelling.",
    category: "director",
    tags: ["martin-scorsese", "goodfellas", "taxi-driver", "crime"],
  },
  {
    slug: "comedy-watchers",
    name: "ComedyWatchers",
    description:
      "For those who believe laughter is the best medicine — all things comedy, from slapstick to sharp satire.",
    category: "genre",
    tags: ["comedy", "satire", "humor", "feel-good"],
  },
  {
    slug: "horror-fanatics",
    name: "HorrorFanatics",
    description:
      "The place for horror enthusiasts — slashers, psychological horror, supernatural dread, and everything in between.",
    category: "genre",
    tags: ["horror", "slasher", "supernatural", "psychological"],
  },
  {
    slug: "action-junkies",
    name: "ActionJunkies",
    description:
      "High-octane thrills, explosive set pieces, and iconic action heroes — welcome to the adrenaline zone.",
    category: "genre",
    tags: ["action", "thriller", "stunts", "blockbuster"],
  },
  {
    slug: "indie-film-lovers",
    name: "IndieFilmLovers",
    description:
      "Celebrating independent cinema — original voices, low budgets, and high artistic ambition.",
    category: "style",
    tags: ["indie", "arthouse", "independent", "film-festival"],
  },
  {
    slug: "classic-cinema-club",
    name: "ClassicCinemaClub",
    description:
      "Appreciating the golden era of cinema — from 1920s silents to New Hollywood, timeless masterworks await.",
    category: "era",
    tags: ["classic", "golden-age", "noir", "new-hollywood"],
  },
  {
    slug: "sci-fi-explorers",
    name: "SciFiExplorers",
    description:
      "Exploring the final frontier of imagination — space operas, dystopias, cyberpunk, and mind-bending concepts.",
    category: "genre",
    tags: ["sci-fi", "space", "dystopia", "cyberpunk"],
  },
  {
    slug: "thriller-addicts",
    name: "ThrillerAddicts",
    description:
      "Edge-of-your-seat tension, twisty plots, and unforgettable suspense — all thrillers, all day.",
    category: "genre",
    tags: ["thriller", "suspense", "mystery", "neo-noir"],
  },
  {
    slug: "animation-nation",
    name: "AnimationNation",
    description:
      "Celebrating the artistry of animation — from Studio Ghibli and Pixar to stop-motion and anime films.",
    category: "style",
    tags: ["animation", "ghibli", "pixar", "anime"],
  },
  {
    slug: "nolan-disciples",
    name: "NolanDisciples",
    description:
      "For fans of Christopher Nolan's mind-bending timelines, practical effects, and blockbuster ambition.",
    category: "director",
    tags: ["christopher-nolan", "inception", "interstellar", "nonlinear-timelines"],
  },
  {
    slug: "kubrick-circle",
    name: "KubrickCircle",
    description:
      "Dissecting Stanley Kubrick's meticulous compositions, unsettling atmospheres, and singular vision.",
    category: "director",
    tags: ["stanley-kubrick", "the-shining", "2001-a-space-odyssey", "meticulous"],
  },
  {
    slug: "documentary-devotees",
    name: "DocumentaryDevotees",
    description:
      "For lovers of nonfiction storytelling — true crime, nature docs, biographical portraits, and everything real.",
    category: "genre",
    tags: ["documentary", "true-story", "nonfiction", "real-life"],
  },
  {
    slug: "romance-watchers",
    name: "RomanceWatchers",
    description:
      "Swooning over love stories big and small — rom-coms, period romances, and everything in between.",
    category: "genre",
    tags: ["romance", "rom-com", "love-story", "heartfelt"],
  },
  {
    slug: "musical-mavens",
    name: "MusicalMavens",
    description:
      "Song-and-dance devotees — Broadway adaptations, jukebox musicals, and every showstopping number.",
    category: "genre",
    tags: ["musical", "broadway", "singing", "dance"],
  },
  {
    slug: "war-film-veterans",
    name: "WarFilmVeterans",
    description:
      "Exploring cinema's most harrowing conflicts — historical epics, combat dramas, and stories of survival.",
    category: "genre",
    tags: ["war", "historical", "combat", "drama"],
  },
  {
    slug: "new-wave-cinephiles",
    name: "NewWaveCinephiles",
    description:
      "Revisiting the French New Wave and its rule-breaking contemporaries — jump cuts, handheld cameras, and rebellion.",
    category: "era",
    tags: ["french-new-wave", "1960s", "godard", "truffaut"],
  },
  {
    slug: "silent-era-society",
    name: "SilentEraSociety",
    description:
      "Honoring the pioneers of silent film — physical comedy, expressionist visuals, and storytelling without a word.",
    category: "era",
    tags: ["silent-film", "1920s", "chaplin", "keaton"],
  },
  {
    slug: "noir-nightowls",
    name: "NoirNightowls",
    description:
      "Smoky rooms, hard-boiled detectives, and moral ambiguity — for lovers of classic and neo film noir alike.",
    category: "style",
    tags: ["film-noir", "shadows", "detective", "moody"],
  },
  {
    slug: "found-footage-fans",
    name: "FoundFootageFans",
    description:
      "Handheld cameras and raw dread — celebrating found-footage horror, mockumentaries, and low-budget ingenuity.",
    category: "style",
    tags: ["found-footage", "mockumentary", "handheld", "low-budget"],
  },
];

// Upsert-by-slug rather than a one-time "insert if the collection is empty"
// check — that original check meant adding new entries to PRESET_GROUPS
// above would silently never reach an already-seeded database. This runs
// safely on every server start: existing groups (and any member/message
// data they've accumulated) are left untouched via $setOnInsert, only
// genuinely new slugs get created.
export const seedGroups = async () => {
  try {
    let seededCount = 0;
    for (const group of PRESET_GROUPS) {
      const result = await Group.updateOne(
        { slug: group.slug },
        { $setOnInsert: { ...group, isPreset: true } },
        { upsert: true }
      );
      if (result.upsertedCount) seededCount += 1;
    }
    if (seededCount > 0) {
      logger.info(`Seeded ${seededCount} new preset community groups`);
    }
  } catch (err) {
    logger.error("Failed to seed groups:", err.message);
  }
};
