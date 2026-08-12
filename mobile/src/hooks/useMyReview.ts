import { useCallback, useEffect, useState } from "react";
import { getContentReviews } from "../api/reviewService";
import type { Review } from "../types";

// No "my review for this content" endpoint exists on the backend — web
// itself scans GET /reviews/content/:id for the logged-in user's own entry,
// mobile does the same, packaged as a hook so screens get clean state
// instead of hand-rolling the scan.
export function useMyReview(contentId: string, userId?: string) {
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setMyReview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { items } = await getContentReviews(contentId, { sort: "recent", limit: 50 });
      setMyReview(items.find((r) => r.user._id === userId) ?? null);
    } catch {
      setMyReview(null);
    } finally {
      setLoading(false);
    }
  }, [contentId, userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { myReview, myReviewLoading: loading, refetchMyReview: refetch, setMyReview };
}
