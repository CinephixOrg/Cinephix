import { useLocalSearchParams } from "expo-router";
import ReviewWriteScreen from "../../../../../../src/screens/ReviewWriteScreen";
import type { ContentType } from "../../../../../../src/types";

export default function ReviewWriteRoute() {
  const { type, id } = useLocalSearchParams<{ type: ContentType; id: string }>();
  return <ReviewWriteScreen contentType={type} contentId={id} />;
}
