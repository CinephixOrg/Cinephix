import { useLocalSearchParams } from "expo-router";
import ContentWatchedSection from "../../../../../../src/components/ContentWatchedSection";
import type { ContentType } from "../../../../../../src/types";

export default function ContentWatchedRoute() {
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  return <ContentWatchedSection contentType={type} contentId={id} />;
}

