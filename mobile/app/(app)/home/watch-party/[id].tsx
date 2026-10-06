import WatchPartyRoomScreen from "../../../../src/screens/WatchPartyRoomScreen";

// A watch party opened from Home's own Shares feed (CurrentlyWatchingCard's
// live rail), nested in Home's own stack so Back returns there — real bug,
// reported live: pushing straight to the community-nested route
// (/socials/communities/<slug>/watch-party/<id>) crossed into a different
// tab's stack, and Back landed on whatever that tab's own root happened to
// be (Messages), not back here. `slug` arrives as a query param
// (?slug=<group slug>), same convention create-poll.tsx etc. already use.
export default function HomeWatchPartyRoute() {
  return <WatchPartyRoomScreen />;
}
