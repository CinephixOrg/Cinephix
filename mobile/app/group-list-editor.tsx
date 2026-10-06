import GroupListEditorScreen from "../src/screens/GroupListEditorScreen";

// ?slug=<group slug> — a partner community's admin creating a list that
// belongs to the community, not to them personally. Root-level, same
// convention as create-poll.tsx/group-content-picker.tsx.
export default function GroupListEditorRoute() {
  return <GroupListEditorScreen />;
}
