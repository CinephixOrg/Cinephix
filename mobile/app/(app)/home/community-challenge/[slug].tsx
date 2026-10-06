import ChallengeDetailScreen from "../../../../src/screens/ChallengeDetailScreen";

// A challenge opened from Home's own Discover rail (Community Announcements)
// rather than that community's own page, nested in Home's own stack so Back
// returns there instead of crossing into the Socials tab's stack — same
// reasoning as home/watch-party/[id].tsx's own comment.
export default function HomeCommunityChallengeRoute() {
  return <ChallengeDetailScreen />;
}
