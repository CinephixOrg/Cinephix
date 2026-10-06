import CommunityLeaderboardScreen from "../../../../src/screens/CommunityLeaderboardScreen";

// Same reasoning as home/community-challenge/[slug].tsx — opened from
// Home's own Discover rail, nested in Home's own stack so Back returns
// there.
export default function HomeCommunityLeaderboardRoute() {
  return <CommunityLeaderboardScreen />;
}
