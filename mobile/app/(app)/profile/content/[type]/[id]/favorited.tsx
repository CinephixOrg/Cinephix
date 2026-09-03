import { useLocalSearchParams } from "expo-router";
import ContentFavoritedSection from "../../../../../../src/components/ContentFavoritedSection";
import type { ContentType } from "../../../../../../src/types";

export default function ContentFavoritedRoute() {
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  return <ContentFavoritedSection contentType={type} contentId={id} />;
}

