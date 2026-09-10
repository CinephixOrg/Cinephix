import { useLocalSearchParams } from "expo-router";
import ContentReviewsSection, { type ReviewMode } from "../../../../../../src/components/ContentReviewsSection";

export default function ContentReviewsRoute() {
  const { id, mode, reviewId } = useLocalSearchParams<{ id: string; mode?: ReviewMode; reviewId?: string }>();
  return <ContentReviewsSection contentId={id} initialMode={mode} scrollToReviewId={reviewId} />;
}
