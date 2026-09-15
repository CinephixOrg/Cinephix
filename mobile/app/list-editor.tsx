import ListEditorScreen from "../src/screens/ListEditorScreen";

// Creating a list (no params) or editing one (?listId=), from any tab. A
// root-level route so every place that creates or edits a list opens the same
// screen the same way.
export default function ListEditorRoute() {
  return <ListEditorScreen />;
}
