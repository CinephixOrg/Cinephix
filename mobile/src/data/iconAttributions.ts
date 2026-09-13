// Every third-party icon used anywhere in the app (badges first, more may
// join this list later) needs its IconScout attribution shown SOMEWHERE
// reachable in the product — this file plus profile/credits.tsx is that
// place, matching how most apps handle Flaticon/Freepik-style license
// requirements (a dedicated in-app Credits page) rather than trying to fit
// a visible "by X on IconScout" link under every 44px badge, which isn't
// physically legible at that size. Wording/urls copied verbatim from
// IconScout's own required-attribution snippets — don't reword these.
export interface IconAttribution {
  name: string;
  iconUrl: string;
  authorName: string;
  authorUrl: string;
}

export const ICON_ATTRIBUTIONS: IconAttribution[] = [
  { name: "Jester Hat", iconUrl: "https://iconscout.com/icons/jester-hat", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Jester", iconUrl: "https://iconscout.com/icons/jester", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Carnival Mask", iconUrl: "https://iconscout.com/icons/carnival-mask", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Skull", iconUrl: "https://iconscout.com/icons/skull", authorName: "Jemis Mali", authorUrl: "https://iconscout.com/contributors/jemismali" },
  { name: "Bat", iconUrl: "https://iconscout.com/icons/bat", authorName: "Vector Place", authorUrl: "https://iconscout.com/contributors/icon-click" },
  { name: "Love Letter", iconUrl: "https://iconscout.com/icons/love-letter", authorName: "graficon", authorUrl: "https://iconscout.com/contributors/graficon" },
  { name: "Love Story", iconUrl: "https://iconscout.com/icons/love-story", authorName: "iconkanan", authorUrl: "https://iconscout.com/contributors/iconkanan" },
  { name: "Hipster", iconUrl: "https://iconscout.com/icons/hipster", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Magnifying Glass", iconUrl: "https://iconscout.com/icons/magnifying-glass", authorName: "Theos Studio", authorUrl: "https://iconscout.com/contributors/theos-studio" },
  { name: "Meteor", iconUrl: "https://iconscout.com/icons/meteor", authorName: "Heykiyou", authorUrl: "https://iconscout.com/contributors/heykiyou" },
  { name: "Rocket", iconUrl: "https://iconscout.com/icons/rocket", authorName: "Kerismaker Studio", authorUrl: "https://iconscout.com/contributors/kerismaker" },
  { name: "Dynamite", iconUrl: "https://iconscout.com/icons/dynamite", authorName: "Iconix Inc.", authorUrl: "https://iconscout.com/contributors/iconix" },
  { name: "Bombs", iconUrl: "https://iconscout.com/icons/bombs", authorName: "Sergei Kokota", authorUrl: "https://iconscout.com/contributors/sergei-kokota" },
  { name: "Tiger", iconUrl: "https://iconscout.com/icons/tiger", authorName: "Iconix Inc.", authorUrl: "https://iconscout.com/contributors/iconix" },
  { name: "Volcano", iconUrl: "https://iconscout.com/icons/volcano", authorName: "Fluent Emoji — Microsoft", authorUrl: "https://iconscout.com/contributors/fluent-emoji" },
  { name: "Mask", iconUrl: "https://iconscout.com/icons/mask", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  // Volume badges (movies/series watched, bronze->diamond) — de-duplicated
  // from what was pasted (a couple of icons were reused across more than
  // one tier and so appeared more than once in the raw list); crediting
  // each distinct icon once, same as the license itself asks for, not
  // once per place it's reused.
  { name: "TV", iconUrl: "https://iconscout.com/icons/tv", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Tv", iconUrl: "https://iconscout.com/icons/tv", authorName: "Elegant Themes", authorUrl: "https://iconscout.com/contributors/elegant-themes" },
  { name: "Television", iconUrl: "https://iconscout.com/icons/television", authorName: "Mohit Gandhi", authorUrl: "https://iconscout.com/contributors/mcgandhi61" },
  { name: "Clapperboard", iconUrl: "https://iconscout.com/icons/clapperboard", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Video Shooting Camera", iconUrl: "https://iconscout.com/icons/video-shooting-camera", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Movie", iconUrl: "https://iconscout.com/icons/ui", authorName: "Chamestudio", authorUrl: "https://iconscout.com/contributors/chamedesign" },
  { name: "Oscar", iconUrl: "https://iconscout.com/icons/oscar", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  // New badge categories (activity/social/sync/loyalty/seasonal/special —
  // rating count, review writing, list creation, followers, influencer,
  // podium, sync, streaks, anniversary, founding cinephile, seasonal and
  // one-off achievement badges). Pasted list checked against every entry
  // above (and against itself) for exact icon-page duplicates first — none
  // found, so nothing here needed de-duplicating this time.
  { name: "Pencil", iconUrl: "https://iconscout.com/icons/pencil", authorName: "Ateeq Ahmed", authorUrl: "https://iconscout.com/contributors/ateeq" },
  { name: "Writing", iconUrl: "https://iconscout.com/icons/writing", authorName: "Fluent Emoji — Microsoft", authorUrl: "https://iconscout.com/contributors/fluent-emoji" },
  { name: "Letter Writing", iconUrl: "https://iconscout.com/icons/letter-writing", authorName: "Lutfi Achmad", authorUrl: "https://iconscout.com/contributors/lutfix" },
  { name: "Pencil", iconUrl: "https://iconscout.com/icons/pencil", authorName: "Dinosoft Lab", authorUrl: "https://iconscout.com/contributors/dinosoftlabs" },
  { name: "List", iconUrl: "https://iconscout.com/icons/list", authorName: "Icon Fly", authorUrl: "https://iconscout.com/contributors/iconfly" },
  { name: "List Board", iconUrl: "https://iconscout.com/icons/list-board", authorName: "Martin Setiawan", authorUrl: "https://iconscout.com/contributors/martinps" },
  { name: "List", iconUrl: "https://iconscout.com/icons/list", authorName: "Iyikon", authorUrl: "https://iconscout.com/contributors/iyikon" },
  { name: "Hourglass", iconUrl: "https://iconscout.com/icons/hourglass", authorName: "Punloka", authorUrl: "https://iconscout.com/contributors/punloka" },
  { name: "Color", iconUrl: "https://iconscout.com/icons/color", authorName: "Thalita Torres", authorUrl: "https://iconscout.com/contributors/thalita-torres" },
  { name: "Movie", iconUrl: "https://iconscout.com/icons/movie", authorName: "Jemis Mali", authorUrl: "https://iconscout.com/contributors/jemismali" },
  { name: "Diamond", iconUrl: "https://iconscout.com/icons/diamond", authorName: "Moudesain", authorUrl: "https://iconscout.com/contributors/moudesain" },
  { name: "Cial Media Gallery", iconUrl: "https://iconscout.com/3d-icons/cial-media-gallery", authorName: "StudioMR", authorUrl: "https://iconscout.com/contributors/midnightrender" },
  { name: "Rainbow Social Media", iconUrl: "https://iconscout.com/3d-icons/rainbow-social-media", authorName: "StudioMR", authorUrl: "https://iconscout.com/contributors/midnightrender" },
  { name: "Online Marketing", iconUrl: "https://iconscout.com/3d-icons/online-marketing", authorName: "StudioMR", authorUrl: "https://iconscout.com/contributors/midnightrender" },
  { name: "Social Media Announcement", iconUrl: "https://iconscout.com/3d-icons/social-media-announcement", authorName: "StudioMR", authorUrl: "https://iconscout.com/contributors/midnightrender" },
  { name: "Megaphone", iconUrl: "https://iconscout.com/icons/megaphone", authorName: "LT", authorUrl: "https://iconscout.com/contributors/lt29" },
  { name: "Megaphone", iconUrl: "https://iconscout.com/icons/megaphone", authorName: "Elegant Themes", authorUrl: "https://iconscout.com/contributors/elegant-themes" },
  { name: "Megaphone", iconUrl: "https://iconscout.com/icons/megaphone", authorName: "Dinosoft Lab", authorUrl: "https://iconscout.com/contributors/dinosoftlabs" },
  { name: "Trophy", iconUrl: "https://iconscout.com/icons/trophy", authorName: "Dinosoft Lab", authorUrl: "https://iconscout.com/contributors/dinosoftlabs" },
  { name: "Trophy", iconUrl: "https://iconscout.com/icons/trophy", authorName: "Debruder Studio", authorUrl: "https://iconscout.com/contributors/debruder-studio" },
  { name: "Trophy", iconUrl: "https://iconscout.com/icons/trophy", authorName: "Mohit Gandhi", authorUrl: "https://iconscout.com/contributors/mcgandhi61" },
  { name: "Compass", iconUrl: "https://iconscout.com/icons/compass", authorName: "Fluent Emoji — Microsoft", authorUrl: "https://iconscout.com/contributors/fluent-emoji" },
  { name: "Puzzle", iconUrl: "https://iconscout.com/icons/puzzle", authorName: "Pillow Leaf", authorUrl: "https://iconscout.com/contributors/pancaza" },
  { name: "Deals", iconUrl: "https://iconscout.com/icons/deals", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Flag", iconUrl: "https://iconscout.com/icons/flag", authorName: "Ade Nurhidayat", authorUrl: "https://iconscout.com/contributors/enhaa" },
  { name: "Calendar", iconUrl: "https://iconscout.com/icons/calendar", authorName: "Moudesain", authorUrl: "https://iconscout.com/contributors/moudesain" },
  { name: "Explosive", iconUrl: "https://iconscout.com/icons/explosive", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Torch", iconUrl: "https://iconscout.com/icons/torch", authorName: "Rikas Dzihab", authorUrl: "https://iconscout.com/contributors/kamelo-art" },
  { name: "Fire", iconUrl: "https://iconscout.com/icons/fire", authorName: "Rizky Studio", authorUrl: "https://iconscout.com/contributors/rizky-salam" },
  { name: "Jack O Man", iconUrl: "https://iconscout.com/icons/jack-o-man", authorName: "draftphic", authorUrl: "https://iconscout.com/contributors/dreamicons" },
  { name: "Christmas Socks", iconUrl: "https://iconscout.com/icons/christmas-socks", authorName: "IconScout Store", authorUrl: "https://iconscout.com/contributors/iconscout" },
  { name: "Box", iconUrl: "https://iconscout.com/icons/box", authorName: "Fluent Emoji — Microsoft", authorUrl: "https://iconscout.com/contributors/fluent-emoji" },
  { name: "Star Medal", iconUrl: "https://iconscout.com/icons/star-medal", authorName: "Wahya", authorUrl: "https://iconscout.com/contributors/wahyakup" },
  { name: "Star Medal", iconUrl: "https://iconscout.com/icons/star-medal", authorName: "Rank Sol", authorUrl: "https://iconscout.com/contributors/promotion-king" },
  { name: "Star Award", iconUrl: "https://iconscout.com/icons/star-award", authorName: "Martin Setiawan", authorUrl: "https://iconscout.com/contributors/martinps" },
  { name: "5 Star Medal", iconUrl: "https://iconscout.com/icons/5-star-medal", authorName: "HungriCat", authorUrl: "https://iconscout.com/contributors/dxtr" },
  { name: "3 Star Medal", iconUrl: "https://iconscout.com/icons/3-star-medal", authorName: "HungriCat", authorUrl: "https://iconscout.com/contributors/dxtr" },
  { name: "Calendar", iconUrl: "https://iconscout.com/icons/calendar", authorName: "Rank Sol", authorUrl: "https://iconscout.com/contributors/promotion-king" },
  { name: "Calendar", iconUrl: "https://iconscout.com/icons/calendar", authorName: "Ramanaptr", authorUrl: "https://iconscout.com/contributors/ramanaptr" },
  // badge_podium_tier3's original art looked visibly skewed once placed in
  // the app — swapped for a different icon, credited here instead of
  // guessing which of the batch above to remove (the pasted list was never
  // mapped 1:1 to specific badge files, so pulling one out risks dropping
  // a credit an icon still in use actually needs).
  { name: "Cup", iconUrl: "https://iconscout.com/icons/cup", authorName: "Laura Reen", authorUrl: "https://iconscout.com/contributors/laura-reen" },
];
