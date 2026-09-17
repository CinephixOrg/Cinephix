// The official Cinephix account's own "FAQ" profile tab (PublicProfileCategoryTabs.tsx,
// gated on `profile.isOfficial`) — a real, in-app help page reached by visiting
// Cinephix's own public profile, direct ask. English-only by explicit agreement,
// same precedent LegalPage.tsx's About/Privacy/Terms pages already established
// (static explanatory prose, not worth translating into all 12 locales).
export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection {
  title: string;
  items: FaqItem[];
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    title: "Getting Started",
    items: [
      {
        question: "What is Cinephix?",
        answer:
          "Cinephix is a social platform for film and series lovers — rate and review what you watch, track your Watched List and Watchlist, discover new titles, sync your taste with friends, and share it all with people who care.",
      },
      {
        question: "How does the rating system work?",
        answer:
          "Ratings are shown as 5 stars (including half stars) throughout the app, but stored on a 1-10 scale under the hood — the same scale Content Detail's own slider uses. A half star on screen equals one whole point on that 1-10 scale.",
      },
      {
        question: "How do I mark something as watched or add it to my Watchlist?",
        answer:
          "On any Content Detail page, use \"Add to Watched List\" once you've actually seen it (this is also what lets you rate and review it), or \"Add to Watchlist\" to queue it for later. Both are separate lists — the Watched List is what you've seen, the Watchlist is what you plan to see.",
      },
    ],
  },
  {
    title: "Badges",
    items: [
      {
        question: "How do I earn badges?",
        answer:
          "Badges track real activity — genres you watch, how much you've watched, how often you rate/review/build lists, your social reach, Sync usage, loyalty milestones, and a handful of special one-off achievements. Check your Profile's Badges tab to see progress toward each one.",
      },
      {
        question: "How many badge categories are there?",
        answer:
          "Eight: Genres, Volume (movies/series watched), Activity (ratings/reviews/lists), Social (followers/likes/podium placements), Sync, Loyalty (founding member/membership length/streak), Seasonal, and Special one-offs like Hidden Gem Hunter or Time Traveler.",
      },
      {
        question: "How does the streak badge work, and when does it reset?",
        answer:
          "Rating something, writing a review, creating a list, or adding to your Watched List all count as \"showing up\" for the day and extend your streak. Miss a full day with none of those, and it resets back to 0 the next time you're active.",
      },
      {
        question: "How do I share my badges?",
        answer:
          "Open any earned badge from your Profile's Badges tab and tap Share to post it to Medya.",
      },
      {
        question: "How do I get on the \"Most Badges\" podium?",
        answer:
          "It's ranked purely by total badge count across every category — the more you earn, the higher you climb. Check the podium on the Shares page to see where you stand.",
      },
    ],
  },
  {
    title: "Sync / CineMatch",
    items: [
      {
        question: "What is Sync, and how do I see my compatibility with someone?",
        answer:
          "Sync compares your taste with another user's — shared genres, ratings, and more — and gives you a real compatibility score. Find candidates on the Sync tab, or tap Analyze on someone's profile to run it directly.",
      },
      {
        question: "How is the Sync score calculated?",
        answer:
          "It blends several signals — genre overlap, rating similarity, and shared favorites among them — into one overall percentage, with a fuller breakdown available once you open a result.",
      },
      {
        question: "How do I share my Sync result?",
        answer:
          "After running an analysis, use the Share button to post it to Medya or send it directly to the person you synced with.",
      },
      {
        question: "What Sync-related badges are there?",
        answer:
          "First Sync (your very first analysis), High Match (reaching a strong compatibility score with someone), and Sync Explorer (analyzing several different people).",
      },
    ],
  },
  {
    title: "Currently Watching",
    items: [
      {
        question: "What does \"Currently Watching\" do?",
        answer:
          "It's a real-time status — tap the play icon on a Content Detail page to let others see what you're watching right now, shown in a dedicated section on the Shares page.",
      },
      {
        question: "How long does it stay active, and when does it stop automatically?",
        answer:
          "It stays live for up to 4 hours, and stops automatically the moment you add that same title to your Watched List — no need to remember to turn it off once you're actually done.",
      },
      {
        question: "How do I stop it manually?",
        answer:
          "Tap the same button on that title's Content Detail page again — useful if you're pausing partway through and haven't finished yet, since a series is rarely watched in one sitting.",
      },
      {
        question: "Who can see it (Everyone vs. Friends)?",
        answer:
          "The Currently Watching section on the Shares page has an All/Friends toggle, so you (and everyone else) can choose to browse either everyone active right now or just the people you follow.",
      },
    ],
  },
  {
    title: "Medya (Shares) & Posts",
    items: [
      {
        question: "What can I share on Medya?",
        answer:
          "Reviews, recommendations, lists, your Profile Analysis or Sync results, earned badges, and polls built from your Watchlist — each renders as its own kind of post in the feed.",
      },
      {
        question: "How do I delete a post I shared?",
        answer:
          "Open the post from your own profile's Shares tab and use the delete option there.",
      },
      {
        question: "What do the like and view counts mean?",
        answer:
          "Views count everyone who's seen the post in their feed; likes are a direct signal from people who tapped the heart — both also factor into how prominently a post ranks in Medya.",
      },
    ],
  },
  {
    title: "Polls",
    items: [
      {
        question: "How do I create a poll from my Watchlist?",
        answer:
          "Open your Watchlist and tap the poll icon in the toolbar, pick your titles, then tap Create Poll — it posts straight to Medya with real posters, not just text.",
      },
      {
        question: "How many titles can I add to a poll?",
        answer:
          "2 or 3 — your pick.",
      },
      {
        question: "How do I change my vote?",
        answer:
          "Tap a different option on the poll — your vote moves, it doesn't add a second one.",
      },
    ],
  },
  {
    title: "Recommend",
    items: [
      {
        question: "How do I recommend a movie or series?",
        answer:
          "From any Content Detail page, tap the gift icon to send it to a specific person, a group, or straight to Medya.",
      },
    ],
  },
  {
    title: "Profile",
    items: [
      {
        question: "How do I edit my favorite movies/series?",
        answer:
          "Open your Profile's Favorites tab and tap the pencil icon to add or remove titles — up to 5 each for movies and series.",
      },
      {
        question: "What is CineGraph, and how do I read it?",
        answer:
          "It's a donut chart of your genre breakdown, built from what you've watched and rated. Tap a slice (or the legend) to drill into your own watched titles and ratings for that genre.",
      },
      {
        question: "What is Profile Analysis, and how do I generate one?",
        answer:
          "An AI-written read on your taste — a persona, a fun fact, and a few real stats about your habits. Generate a fresh one from your Profile's Analyses tab (how often depends on your plan).",
      },
    ],
  },
  {
    title: "Subscription",
    items: [
      {
        question: "What's the difference between the plans?",
        answer:
          "Free, Plus, and Premium mainly differ in Sync limits (how many searches/analyses per day, and how often you can re-run them), Profile Analysis depth and history, search/match filters, and a few visual perks like frame color and extra podium categories across Discover and Medya.",
      },
      {
        question: "How do I upgrade or switch plans?",
        answer:
          "Go to Settings → Subscription to see the full comparison and change your plan.",
      },
    ],
  },
  {
    title: "Importing Your Data",
    items: [
      {
        question: "How do I import my data from Letterboxd, TV Time, or IMDb?",
        answer:
          "Open the Import page from your Profile drawer, pick your source, and upload the export file that service gives you — Cinephix matches titles against its own catalog and adds them to your Watched List.",
      },
      {
        question: "How long does import take, and what if something goes wrong?",
        answer:
          "It runs in the background and can take a few minutes for a large export. If something doesn't look right afterward, your Activity Log can undo individual imported entries.",
      },
    ],
  },
  {
    title: "Groups & Social",
    items: [
      {
        question: "How do I join a group?",
        answer:
          "Browse Groups from the Socials tab and tap Join on any community that fits your taste.",
      },
      {
        question: "How do I follow someone?",
        answer:
          "Visit their profile and tap Follow — Cinephix profiles are all public, so this takes effect right away.",
      },
      {
        question: "How do I manage notifications?",
        answer:
          "Open Notifications from the bell icon to review, mark read, or clear them; device push notifications can be toggled from Settings.",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        question: "How do I change my password or email?",
        answer:
          "Both are in Settings → Account.",
      },
      {
        question: "How do I delete my account?",
        answer:
          "Settings → Account has a Delete Account option — this is permanent, so double-check before confirming.",
      },
      {
        question: "How do I undo an action, like a rating or a list add?",
        answer:
          "Your Profile drawer's Activity Log lists your recent actions with an undo option next to each one.",
      },
    ],
  },
];
