import CommunityListsScreen from "../../../../../../src/screens/CommunityListsScreen";

// /socials/communities/<slug>/lists — "See all" behind Overview's Featured
// Lists rail; the admin's own place to pick which ≤3 lists are featured.
// A single list is lists/[listId].tsx, same directory shape as a user
// profile's own lists/index.tsx + lists/[listId].tsx.
export default function CommunityListsRoute() {
  return <CommunityListsScreen />;
}
