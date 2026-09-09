import { useLocalSearchParams } from "expo-router";
import ListDetailScreen from "../../../../src/screens/ListDetailScreen";

// A list opened from someone's public profile, nested in that profile's own
// stack so Back returns to their Lists tab — same reasoning as the genre and
// messages routes beside it. The list's own id arrives as `listId` because
// the bare `id` belongs to the profile owner at this depth.
export default function UserProfileListDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ListDetailScreen basePath={`/user/${id}`} />;
}
