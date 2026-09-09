import { useLocalSearchParams } from "expo-router";
import ConversationScreen from "../../../src/screens/ConversationScreen";

// The DM with this profile's owner, as a page *inside* the public-profile
// stack, opened by that profile's Message button.
//
// Keyed by the person rather than the conversation: at this depth we already
// know who the other party is (they own the profile underneath), and not
// needing a conversation id up front is what lets the Message button
// navigate instantly instead of waiting on a find-or-create round trip
// first. The screen resolves the conversation once it's on screen.
//
// It's a route of its own rather than the Socials tab's copy purely so Back
// behaves: user/[id] is a root-level stack sibling of the (app) tab group,
// so pushing into the tabs' messages route would leave this profile behind
// and send Back to Socials. Nested here, the profile stays underneath.
//
// Header title is inert: the profile it would open is the screen directly
// beneath this one.
export default function UserProfileChatRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ConversationScreen participantId={id} linkTitleToProfile={false} />;
}
