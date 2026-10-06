import CreatePollScreen from "../src/screens/CreatePollScreen";

// ?slug=<group slug> — a partner community's admin creating a poll: a
// free-text question plus 2-5 options, each either a catalog pick or the
// admin's own written text. Root-level, same convention as
// list-editor.tsx/group-content-picker.tsx.
export default function CreatePollRoute() {
  return <CreatePollScreen />;
}
