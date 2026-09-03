import { useLocalSearchParams } from "expo-router";
import ContentListsSection from "../../../../../../src/components/ContentListsSection";
import type { ContentType } from "../../../../../../src/types";

export default function ContentListsRoute() {
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  return <ContentListsSection contentType={type} contentId={id} basePath="/home" />;
}
