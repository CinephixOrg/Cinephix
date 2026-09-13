import { memo, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFollowState } from "../hooks/useFollowState";
import UserAvatar from "./UserAvatar";
import type { SuggestedUser } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";
import { TIER_FRAME_STYLES } from "../theme/tierFrames";

const SUGGESTED_GRID_SIZE = 4;

// getSuggestedUsers (backend) is a real mutual-connection ranking (friends-
// of-friends, sorted by shared-follow count), hard-capped at 10 — not an
// arbitrary fixed "always 10" default, and not unlimited either. With only
// up to 10 real candidates and 4 shown per box, rotating through 4-at-a-
// time slices (wrapping around) is the honest way to make repeat
// appearances feel different without inventing fake users past what's
// actually a real, if small, candidate pool. Moved here (was
// SharesFeedSection.tsx's own module-level helper, called inline inside
// `renderItem`) so this component can actually take advantage of
// React.memo below — a `renderItem` callback isn't a component React can
// call hooks in, so the slice had no way to be memoized at the call site;
// computing it in here off a stable `pool` + primitive `occurrence` lets
// `useMemo` (and therefore memo's own prop comparison one level up) work
// as intended.
function suggestedSlice(pool: SuggestedUser[], occurrence: number): SuggestedUser[] {
  if (pool.length <= SUGGESTED_GRID_SIZE) return pool;
  const start = (occurrence * SUGGESTED_GRID_SIZE) % pool.length;
  const doubled = [...pool, ...pool];
  return doubled.slice(start, start + SUGGESTED_GRID_SIZE);
}

interface Props {
  pool: SuggestedUser[];
  occurrence: number;
}

// Non-scrollable, fixed-4-across replacement for the old horizontal-rail
// suggested-users insert (ContentRail + SuggestedUserCard.tsx, which is
// still used as-is elsewhere, e.g. network.tsx — its fixed 130px card
// width is exactly what made it unsuitable to reuse here, where up to 4
// need to fit side by side in one row). The user found the old rail bland
// and disliked it being scrollable — this is a self-contained module (its
// own darker `colors.base200` box against the feed's `base100`) instead of
// blending into the post stream.
function SuggestedUsersBox({ pool, occurrence }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const users = useMemo(() => suggestedSlice(pool, occurrence), [pool, occurrence]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        box: { backgroundColor: colors.base200, borderRadius: 16, padding: 12 },
        title: { fontFamily: fonts.bold, fontSize: 14, color: colors.baseContent, marginBottom: 10 },
        // A bit more breathing room between the 4 cells than the initial
        // pass (8 → 14) — the user's own ask.
        row: { flexDirection: "row", gap: 14 },
        cell: { flex: 1, alignItems: "center" },
        usernameRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 6 },
        username: { fontFamily: fonts.bold, fontSize: 11, color: colors.baseContent, textAlign: "center" },
        mutual: { fontSize: 10, color: colors.placeholder, marginTop: 1, textAlign: "center" },
        followLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary, marginTop: 6, paddingVertical: 2 },
      }),
    [colors]
  );

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t("Suggested Users")}</Text>
      <View style={styles.row}>
        {users.map((u) => (
          <Pressable key={u._id} style={styles.cell} onPress={() => router.push(`/user/${u._id}`)}>
            {/* No `tier` prop here (no ring) — same reasoning as
                PeoplePodiumCard.tsx's own avatar: in a compact, multi-
                avatar-per-row layout like this one, the inline diamond
                mark right below is this box's one tier signal, not a
                second copy of a ring that would otherwise crowd 4 tight
                48px avatars side by side. Direct ask, for consistency with
                Podium's already-established diamond-only precedent. */}
            <UserAvatar userId={u._id} username={u.username} profilePicUrl={u.profile_pic_url} size={48} disabled />
            <View style={styles.usernameRow}>
              {(u.accountTier === "plus" || u.accountTier === "premium") && (
                <Ionicons name="diamond" size={10} color={TIER_FRAME_STYLES[u.accountTier]?.glowColor} />
              )}
              <Text style={styles.username} numberOfLines={1}>
                {u.username}
              </Text>
            </View>
            <Text style={styles.mutual} numberOfLines={1}>
              {t("mutual_count", { count: u.mutualCount })}
            </Text>
            <SuggestedFollowLabel userId={u._id} style={styles.followLabel} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// React.memo — `pool`/`occurrence` are both stable now (the pool only
// changes when SharesFeedSection.tsx's own suggestions actually refetch,
// occurrence is a plain number), so this box no longer re-renders on an
// unrelated ancestor re-render either.
export default memo(SuggestedUsersBox);

// Plain colored text instead of FollowButton's own bordered/filled button
// chrome — the user found buttons here too heavy for a 4-across compact
// grid; tapping just flips the label straight to "Following" via the same
// useFollowState hook FollowButton itself uses, no separate button shape
// needed. A distinct component (not inlined in the .map() above) since
// hooks can't be called from inside a callback.
function SuggestedFollowLabel({ userId, style }: { userId: string; style: TextStyle }) {
  const { t } = useTranslation();
  const { status, pending, follow, unfollow } = useFollowState(userId);

  if (status === "self") return null;

  const label = status === "following" ? t("Following") : status === "requested" ? t("Requested") : t("Follow");
  const onPress = () => (status === "not-following" ? follow() : unfollow());

  return (
    <Pressable onPress={onPress} disabled={pending} hitSlop={6}>
      <Text style={style}>{pending ? "…" : label}</Text>
    </Pressable>
  );
}
