import GroupContentPickerScreen from "../src/screens/GroupContentPickerScreen";

// ?slug=<group slug> — a partner community's admin picking titles for its
// active challenge. Root-level, same convention as list-editor.tsx. (A
// community poll has its own screen now, create-poll.tsx — see
// GroupContentPickerScreen's own comment for why.)
export default function GroupContentPickerRoute() {
  return <GroupContentPickerScreen />;
}
