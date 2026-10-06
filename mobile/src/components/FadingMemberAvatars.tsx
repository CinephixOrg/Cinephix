import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, View, StyleSheet } from "react-native";
import UserAvatar from "./UserAvatar";
import { useTheme } from "../context/ThemeContext";

interface Member {
  _id: string;
  username: string;
  profilePicUrl?: string;
}

interface Props {
  members: Member[];
  size?: number;
}

const VISIBLE_COUNT = 5;
const ROTATE_INTERVAL_MS = 2500;
const FADE_MS = 400;

// "Popular community" card's member-avatar carousel — direct ask, modeled
// on the watch-party attendee stack (StackedAvatars.tsx's own overlap
// convention) but animated: up to 10 members cross-fade through in
// batches of 5 instead of a single static set, since a card this narrow
// can't show 10 at once. Members.length <= VISIBLE_COUNT just renders
// statically — nothing to rotate through.
export default function FadingMemberAvatars({ members, size = 32 }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const [batchIndex, setBatchIndex] = useState(0);

  const batches = useMemo(() => {
    if (members.length <= VISIBLE_COUNT) return [members];
    const out: Member[][] = [];
    for (let i = 0; i < members.length; i += VISIBLE_COUNT) out.push(members.slice(i, i + VISIBLE_COUNT));
    return out;
  }, [members]);

  useEffect(() => {
    setBatchIndex(0);
    if (batches.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        setBatchIndex((i) => (i + 1) % batches.length);
        Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [batches, opacity]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
        avatar: { marginLeft: -8, borderWidth: 2, borderColor: colors.base200, borderRadius: size / 2 + 2 },
      }),
    [colors, size]
  );

  if (members.length === 0) return null;
  const current = batches[batchIndex] ?? [];

  return (
    <Animated.View style={[styles.row, { opacity }]}>
      {current.map((member, i) => (
        <View key={member._id} style={[styles.avatar, i === 0 && { marginLeft: 0 }]}>
          <UserAvatar userId={member._id} username={member.username} profilePicUrl={member.profilePicUrl} size={size} disabled />
        </View>
      ))}
    </Animated.View>
  );
}
