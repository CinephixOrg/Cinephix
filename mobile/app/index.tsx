import { Redirect } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

export default function Index() {
  const { user, needsProfileSetup } = useAuth();
  // A cold boot lands here before anywhere else — a logged-in user who
  // never finished the onboarding wizard (TC-133) must resume it here too,
  // same check (auth)/_layout.tsx already makes, or a relaunch mid-wizard
  // would silently drop straight to /home instead of resuming.
  const href = !user ? "/login" : needsProfileSetup ? "/setup-profile" : "/home";
  return <Redirect href={href} />;
}
