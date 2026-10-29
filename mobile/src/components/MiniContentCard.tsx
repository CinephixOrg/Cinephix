import { useMemo } from "react";
import { View, Image, Text, StyleSheet, ViewStyle } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ContentType } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w154";

interface Props {
  id: string;
  type: ContentType;
  posterPath?: string | null;
  // Optional — List Detail's grid deliberately omits it (poster-only, by
  // design); Search's Films/Series grid passes it since browsing by title
  // matters more there than in an already-curated list.
  title?: string;
  // `/user/<id>` included so a list opened from someone's public profile
  // pushes content inside that profile's own stack, keeping Back pointed at
  // the list you came from rather than jumping tabs.
  basePath: "/lists" | "/home" | "/search" | "/profile" | "/watchlist" | "/to-watch" | `/user/${string}`;
  onRemove?: () => void;
  // Quick add-to-watchlist overlay (WhatToWatchRail's "Suggested for you"
  // enhancement, TC-133) — symmetric with onRemove above, a small "+"
  // instead of an "x", flipping to a checkmark once `added` so a second tap
  // can't double-POST. Tapping it does NOT navigate (stopPropagation'd via
  // its own Pressable, same as onRemove's).
  onAdd?: () => void;
  added?: boolean;
  // Multi-select overlay for the onboarding suggestion grid (TC-133 Step
  // 5) — mutually exclusive with onAdd/onRemove in practice (no caller
  // passes both), but kept as its own independent prop pair rather than
  // overloading onAdd/added, since "selected, pending one batched submit"
  // and "already added, this instant" are different states with different
  // icons (checkbox vs. checkmark-done).
  onToggleSelect?: () => void;
  selected?: boolean;
  // Explicit pixel width + spacing from the grid (fixed values computed by
  // the caller from screen width) rather than a percentage — keeps the gap
  // between cards constant regardless of how many items land in the last,
  // possibly-incomplete row.
  style?: ViewStyle;
}

// Small card for dense grids (List Detail's 6-per-row, Search's 5-per-row)
// — poster-only unless a title is passed.
export default function MiniContentCard({
  id,
  type,
  posterPath,
  title,
  basePath,
  onRemove,
  onAdd,
  added,
  onToggleSelect,
  selected,
  style,
}: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        // Thin gray border, direct ask — matches the same colors.border
        // frame AddedByCard.tsx's own poster already uses (Trending/
        // Friends' Choice), so all of Discover's poster cards read as one
        // consistent design rather than this one being the odd one out.
        poster: {
          width: "100%",
          aspectRatio: 2 / 3,
          borderRadius: 4,
          backgroundColor: colors.base200,
          borderWidth: 1,
          borderColor: colors.border,
        },
        removeButton: {
          position: "absolute",
          top: 2,
          right: 2,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 8,
          width: 16,
          height: 16,
          alignItems: "center",
          justifyContent: "center",
        },
        // Bigger than removeButton (20 vs 16) — this is a primary tappable
        // action on the card (add/select), not an edit-mode affordance, so
        // it needs a more comfortable hit target.
        cornerButton: {
          position: "absolute",
          top: 4,
          right: 4,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 10,
          width: 20,
          height: 20,
          alignItems: "center",
          justifyContent: "center",
        },
        cornerButtonActive: { backgroundColor: colors.primary },
        title: { fontFamily: fonts.medium, fontSize: 11, color: colors.baseContent, marginTop: 4, textAlign: "center" },
      }),
    [colors]
  );

  return (
    <View style={style}>
      <Pressable onPress={() => router.push(`${basePath}/content/${type}/${id}` as any)}>
        {posterPath ? (
          <Image source={{ uri: `${POSTER_BASE}${posterPath}` }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        )}
        {onRemove && (
          <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={6}>
            <Ionicons name="close" size={11} color="#fff" />
          </Pressable>
        )}
        {onAdd && (
          <Pressable
            style={[styles.cornerButton, added && styles.cornerButtonActive]}
            onPress={added ? undefined : onAdd}
            disabled={added}
            hitSlop={6}
          >
            <Ionicons name={added ? "checkmark" : "add"} size={14} color="#fff" />
          </Pressable>
        )}
        {onToggleSelect && (
          <Pressable style={[styles.cornerButton, selected && styles.cornerButtonActive]} onPress={onToggleSelect} hitSlop={6}>
            <Ionicons name={selected ? "checkmark" : "add"} size={14} color="#fff" />
          </Pressable>
        )}
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
