import React, { createContext, useCallback, useContext, useState } from "react";

// Step-by-step walkthroughs started from the Shares feed's "+" compose menu
// (PostComposeMenu.tsx) — each category replaces a plain navigate+toast with
// a real guide: highlight the right UI (TutorialSpotlight.tsx), show what to
// do (TutorialInfoBox.tsx), and — where the normal flow would otherwise ask
// "share to Media or send to someone?" — skip straight to Media, since using
// the + button already answered that question. One variant per category,
// added as each one's exact steps got agreed rather than guessing a fully
// generic step shape up front:
//  - recommend: Search's Movies/Series tabs -> search bar -> Content
//    Detail's gift button (skips its picker)
//  - review: same Search steps -> Content Detail's Add/Edit Review button
//    -> the Write Review screen's own Save button (skips its Save-menu)
//  - poll: Watchlist's poll button only — tapping it already enters the
//    in-grid selection mode built for this, which carries its own
//    instructions from there
//  - analyze: Profile's Analyze Profile button -> the result modal's own
//    Share button (skips its picker)
//  - badge: no single correct tile to point at (depends which badges are
//    earned) — one info-only step on the Badges tab, then the detail
//    modal's own Share button once any badge is opened (badges have no
//    picker to skip — sharing one is already a single direct action)
//  - list: same "no single correct tile" reasoning as badge — one info-only
//    step on the Lists tab, then the list detail page's own "Share your
//    list" button (skips its picker). Only shows at all once the list is
//    public, same as the button it's highlighting.
export type ComposeTutorialState =
  | { id: "recommend"; step: "pickCategory" | "search" | "tapGift" }
  | { id: "review"; step: "pickCategory" | "search" | "tapWrite" | "tapSave" }
  | { id: "poll"; step: "tapPollButton" }
  | { id: "analyze"; step: "tapAnalyze" | "tapShare" }
  | { id: "badge"; step: "pickBadge" | "tapShare" }
  | { id: "list"; step: "pickList" | "tapShare" }
  | null;

interface ComposeTutorialContextValue {
  tutorial: ComposeTutorialState;
  startRecommendTutorial: () => void;
  startReviewTutorial: () => void;
  startPollTutorial: () => void;
  startAnalyzeTutorial: () => void;
  startBadgeTutorial: () => void;
  startListTutorial: () => void;
  // Each setter is idempotent and scoped to its own tutorial id by design —
  // a screen calls its own setter unconditionally whenever that id is
  // active, regardless of which step it left off on elsewhere, since
  // arriving at that screen during that specific tutorial unambiguously
  // means "now show this step." No separate cross-screen handoff needed.
  setRecommendStep: (step: "pickCategory" | "search" | "tapGift") => void;
  setReviewStep: (step: "pickCategory" | "search" | "tapWrite" | "tapSave") => void;
  setAnalyzeStep: (step: "tapAnalyze" | "tapShare") => void;
  setBadgeStep: (step: "pickBadge" | "tapShare") => void;
  setListStep: (step: "pickList" | "tapShare") => void;
  endTutorial: () => void;
}

const ComposeTutorialContext = createContext<ComposeTutorialContextValue | undefined>(undefined);

export function ComposeTutorialProvider({ children }: { children: React.ReactNode }) {
  const [tutorial, setTutorial] = useState<ComposeTutorialState>(null);

  const startRecommendTutorial = useCallback(() => setTutorial({ id: "recommend", step: "pickCategory" }), []);
  const startReviewTutorial = useCallback(() => setTutorial({ id: "review", step: "pickCategory" }), []);
  const startPollTutorial = useCallback(() => setTutorial({ id: "poll", step: "tapPollButton" }), []);
  const startAnalyzeTutorial = useCallback(() => setTutorial({ id: "analyze", step: "tapAnalyze" }), []);
  const startBadgeTutorial = useCallback(() => setTutorial({ id: "badge", step: "pickBadge" }), []);
  const startListTutorial = useCallback(() => setTutorial({ id: "list", step: "pickList" }), []);

  const setRecommendStep = useCallback((step: "pickCategory" | "search" | "tapGift") => {
    setTutorial((prev) => (prev?.id === "recommend" ? { id: "recommend", step } : prev));
  }, []);
  const setReviewStep = useCallback((step: "pickCategory" | "search" | "tapWrite" | "tapSave") => {
    setTutorial((prev) => (prev?.id === "review" ? { id: "review", step } : prev));
  }, []);
  const setAnalyzeStep = useCallback((step: "tapAnalyze" | "tapShare") => {
    setTutorial((prev) => (prev?.id === "analyze" ? { id: "analyze", step } : prev));
  }, []);
  const setBadgeStep = useCallback((step: "pickBadge" | "tapShare") => {
    setTutorial((prev) => (prev?.id === "badge" ? { id: "badge", step } : prev));
  }, []);
  const setListStep = useCallback((step: "pickList" | "tapShare") => {
    setTutorial((prev) => (prev?.id === "list" ? { id: "list", step } : prev));
  }, []);

  const endTutorial = useCallback(() => setTutorial(null), []);

  return (
    <ComposeTutorialContext.Provider
      value={{
        tutorial,
        startRecommendTutorial,
        startReviewTutorial,
        startPollTutorial,
        startAnalyzeTutorial,
        startBadgeTutorial,
        startListTutorial,
        setRecommendStep,
        setReviewStep,
        setAnalyzeStep,
        setBadgeStep,
        setListStep,
        endTutorial,
      }}
    >
      {children}
    </ComposeTutorialContext.Provider>
  );
}

export function useComposeTutorial() {
  const ctx = useContext(ComposeTutorialContext);
  if (!ctx) throw new Error("useComposeTutorial must be used within a ComposeTutorialProvider");
  return ctx;
}
