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
];

export const seedGroups = async () => {
  try {
    const count = await Group.countDocuments({ isPreset: true });
    if (count > 0) return;
    await Group.insertMany(PRESET_GROUPS);
    logger.info(`Seeded ${PRESET_GROUPS.length} preset community groups`);
  } catch (err) {
    logger.error("Failed to seed groups:", err.message);
  }
};
