import { Redirect } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? "/movies" : "/login"} />;
}
