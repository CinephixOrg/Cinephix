import { useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import UserAvatar from "./UserAvatar";
import PosterCascade, { CASCADE_OFFSET_STEP, posterHeightFor } from "./PosterCascade";
import { usePosterReveal } from "../context/PosterRevealContext";
import type { DiscoverListItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

// Matches AddedByCard's own Trending-rail poster width exactly, per the
// user's own ask for these to read as the same size class.
const CARD_WIDTH = 84;
const POSTER_HEIGHT = posterHeightFor(CARD_WIDTH);
const MAX_STACK = 5;
const FAN_HEIGHT = POSTER_HEIGHT + (MAX_STACK - 1) * CASCADE_OFFSET_STEP;
// Generous margin over the footer row's own tight content height (~22px
// including its marginTop) — 24, then 32, both still clipped the
// avatar/username against the rail's fixed height on real devices (likely
// system font-scaling pushing the username's real rendered height past
// what a tight budget assumed). 40 trades a little blank space for
// definitely not clipping.
const FOOTER_HEIGHT = 40;
// Exported so the parent rail can reserve a fixed height sized for the
// tallest possible fan (a full 5-item stack) plus this card's own footer —
// cards with fewer items just top-align within it, same as every other
// ContentRail height prop usage.
export const LIST_RAIL_CARD_HEIGHT = FAN_HEIGHT + FOOTER_HEIGHT;

interface Props {
  list: DiscoverListItem;
  onPress: () => void;
}

// The poster stack itself is PosterCascade.tsx (shared with ShareCard's own
// list-post box) — this component just layers its own interaction on top:
// the front poster starts covered by a dark overlay (list name, then like
// count and view count stacked — heart/eye icon + number, matching
// ShareCard's own iconography), tap it to reveal a centered "Detail" pill
// in the same spot. The back layers (`dimBackLayers`) carry a permanent
// fade — purely so they read as "stacked behind" the interactive front
// card. Reveal state is shared app-wide via `PosterRevealContext` (not a
// local Provider scoped to just this rail) — see that file's own doc
// comment for why: it's the same coordination Reviews' poster cards now
// need too, so only one pill (list or review) is ever open anywhere on
// Discover, switching in one tap regardless of which section you tap next.
export default function ListRailCard({ list, onPress }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const stack = list.previewItems.slice(0, MAX_STACK);
  const { isRevealed, reveal, close } = usePosterReveal(`list-${list._id}`);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { width: CARD_WIDTH, marginRight: 12 },
        fan: { height: FAN_HEIGHT },
        // Sized to exactly match PosterCascade's front-poster bounds (it's
        // always drawn at this container's own top-left origin, regardless
        // of direction) — the covered-state dark tint + text.
        overlay: {
          position: "absolute",
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: POSTER_HEIGHT,
          backgroundColor: "rgba(0,0,0,0.55)",
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          zIndex: MAX_STACK + 1,
        },
        listName: { color: "#fff", fontFamily: fonts.bold, fontSize: 13, textAlign: "center" },
        statRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
        statText: { color: "#fff", fontFamily: fonts.medium, fontSize: 11 },
        // Same box as `overlay` — tapping anywhere in it (other than the
        // pill itself, a nested Pressable) re-covers the card. Scoped to
        // just the poster, not the whole page: confirmed reliable at this
        // scope already (this exact tap target worked in every round so
        // far — it's tapping *outside* the card that a Modal was chasing,
        // and that's the part traded away).
        detailsCatcher: {
          position: "absolute",
          top: 0,
          left: 0,
          width: CARD_WIDTH,
          height: POSTER_HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          zIndex: MAX_STACK + 1,
        },
        detailsButton: {
          backgroundColor: colors.primary,
          borderRadius: 16,
          paddingVertical: 7,
          paddingHorizontal: 16,
        },
        detailsButtonText: { color: colors.primaryContent, fontFamily: fonts.bold, fontSize: 12 },
        footer: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 5 },
        username: { fontSize: 11, color: colors.placeholder, flexShrink: 1 },
      }),
    [colors]
  );

  return (
    <View style={styles.card}>
      <View style={styles.fan}>
        <PosterCascade
          items={stack}
          direction="vertical"
          posterWidth={CARD_WIDTH}
          maxStack={MAX_STACK}
          itemCount={list.items.length}
          dimBackLayers
        />
      </View>

      {!isRevealed && (
        <Pressable style={styles.overlay} onPress={reveal}>
          <Text style={styles.listName} numberOfLines={2}>
            {list.name}
          </Text>
          <View style={styles.statRow}>
            <Ionicons name="heart" size={12} color="#fff" />
            <Text style={styles.statText}>{list.likeCount}</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="eye" size={12} color="#fff" />
            <Text style={styles.statText}>{list.views}</Text>
          </View>
        </Pressable>
      )}

      {isRevealed && (
        <Pressable style={styles.detailsCatcher} onPress={close}>
          <Pressable style={styles.detailsButton} onPress={onPress}>
            <Text style={styles.detailsButtonText}>{t("Detail")}</Text>
          </Pressable>
        </Pressable>
      )}

      <View style={styles.footer}>
        <UserAvatar userId={list.owner._id} username={list.owner.username} profilePicUrl={list.owner.profile_pic_url} size={16} />
        <Text style={styles.username} numberOfLines={1}>
          {list.owner.username}
        </Text>
      </View>
    </View>
  );
}
