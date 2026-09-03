import { useLocalSearchParams } from "expo-router";
import ContentReviewsSection from "../../../../../../src/components/ContentReviewsSection";

export default function ContentReviewsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContentReviewsSection contentId={id} />;
}

