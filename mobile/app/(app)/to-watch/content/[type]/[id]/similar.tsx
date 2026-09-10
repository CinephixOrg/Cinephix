import { useLocalSearchParams } from "expo-router";
import ContentSimilarSection from "../../../../../../src/components/ContentSimilarSection";
import type { ContentType } from "../../../../../../src/types";

export default function ContentSimilarRoute() {
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  return <ContentSimilarSection contentType={type} contentId={id} />;
}
