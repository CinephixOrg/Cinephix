import ListDetailScreen from "../../../../../../src/screens/ListDetailScreen";

// A list opened from a community's own Featured Lists rail or its "See
// all" page, nested in that community's own stack so Back returns there
// — same reasoning as user/[id]/lists/[listId].tsx (a profile's own
// nested list route), which this mirrors. The list's own id arrives as
// `listId` because the bare `id` convention is reserved at shallower
// depths elsewhere in this app.
export default function CommunityListDetailRoute() {
  return <ListDetailScreen basePath="/socials" />;
}
