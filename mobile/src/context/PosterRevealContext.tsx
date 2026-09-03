import { createContext, useContext, useState, type ReactNode } from "react";

interface PosterRevealContextValue {
  revealedId: string | null;
  reveal: (id: string) => void;
  close: () => void;
}
const PosterRevealContext = createContext<PosterRevealContextValue | null>(null);

// Shared by every "poster with a covering overlay that reveals a Detail
// pill on tap" card on Discover — ListRailCard's Popular Lists rail *and*
// ReviewSwipeCard's Reviews swiper both register through this, wrapped
// once around both sections in KesfetSection.tsx, so at most one card's
// pill is open anywhere on the page at a time. Tapping a different card's
// poster (in the same section or the other one) switches straight to it
// in one tap — each card's own covered-state Pressable is directly,
// independently tappable at all times (nothing blocks it), so switching
// is just "this card's tap overwrites the shared id, which makes whatever
// card held it before go back to its covered state."
//
// Deliberately NOT a Modal — see ListRailCard.tsx's own history: a Modal
// blocks every touch underneath it while visible, which broke the ability
// to keep scrolling/using the rest of the page while a pill was open. This
// plain-context version trades away "dismissible from literally anywhere
// with zero other interaction" for "the page always stays fully usable" —
// tapping the same poster again, a different card's poster, or (per each
// consumer's own choice) some other part of that same card, closes/
// switches it.
export function PosterRevealProvider({ children }: { children: ReactNode }) {
  const [revealedId, setRevealedId] = useState<string | null>(null);
  return (
    <PosterRevealContext.Provider value={{ revealedId, reveal: setRevealedId, close: () => setRevealedId(null) }}>
      {children}
    </PosterRevealContext.Provider>
  );
}

// `id` should be unique across every card sharing this provider, not just
// within one card's own list — callers prefix it (e.g. `list-${listId}`,
// `review-${reviewId}`) so a list and a review can never collide.
export function usePosterReveal(id: string) {
  const ctx = useContext(PosterRevealContext);
  return {
    isRevealed: ctx?.revealedId === id,
    reveal: () => ctx?.reveal(id),
    close: () => ctx?.close(),
  };
}
