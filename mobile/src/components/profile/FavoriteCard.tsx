import { useMemo } from "react";
import { View, Text, Image, Pressable, StyleSheet, ViewStyle } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import StarRatingDisplay from "../StarRatingDisplay";
import type { RailDragHandle } from "../ContentRail";
import type { ContentType } from "../../types";
import { useTheme } from "../../context/ThemeContext";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

interface Props {
  id: string;
  type: ContentType;
  posterPath?: string | null;
  rating?: number | null;
  style?: ViewStyle;
  basePath: "/profile" | `/user/${string}`;
  // When true, the poster is no longer tappable-to-navigate — it's covered
  // by a translucent red remove overlay with a centered X instead. Only
  // ever true on the owner's own profile (edit mode toggled by the rail's
  // pencil icon).
  editing?: boolean;
  onRemove?: () => void;
  // Present only while this card's rail is drag-to-reorder enabled (see
  // ContentRail's own dragEnabled/RailDragHandle) — pressing down on the
  // poster (not the remove button) picks the card up immediately, no
  // long-press wait.
  drag?: RailDragHandle;
}

// Favorites-rail counterpart to ContentCard — shows the profile owner's own
// rating for the item instead of its title (favorites are a curated pick,
// not a browsing list, so "what did I rate this" is the more useful line
// under the poster than the title, which the poster art already conveys),
// and knows how to render as a removable tile in edit mode.
export default function FavoriteCard({ id, type, posterPath, rating, style, basePath, editing, onRemove, drag }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: { width: "48%", marginBottom: 16 },
        // Picked-up feedback while dragging to reorder — a plain scale/
        // opacity nudge rather than react-native-draggable-flatlist's own
        // ScaleDecorator wrapper, so this stays a single inline style
        // change instead of introducing another wrapping component.
        dragging: { opacity: 0.85, transform: [{ scale: 1.06 }] },
        poster: {
          width: "100%",
          aspectRatio: 2 / 3,
          borderRadius: 8,
          backgroundColor: colors.base200,
        },
        posterFallback: { alignItems: "center", justifyContent: "center" },
        posterFallbackText: { color: colors.placeholder, fontSize: 12 },
        removeOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 8,
          backgroundColor: "rgba(220,38,38,0.45)",
          alignItems: "center",
          justifyContent: "center",
        },
        removeButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
        },
        ratingRow: { marginTop: 6, minHeight: 16, alignItems: "center" },
        unrated: { fontSize: 12, color: colors.placeholder, fontStyle: "italic" },
      }),
    [colors]
  );

  return (
    <View style={[styles.card, style, drag?.isActive && styles.dragging]}>
      {/* Not `disabled={editing}` — that would also block onPressIn below.
          Omitting onPress while editing has the same "poster does nothing"
          effect, but leaves this Pressable free to pick the card up the
          instant a press starts. Direct ask: dragging used to require a
          long-press-and-wait (even after an earlier delayLongPress:250
          trim) — onPressIn removes the wait entirely, since onPress alone
          never fires while editing anyway, there's no tap-vs-drag gesture
          to disambiguate. The remove button just below is its own separate,
          nested Pressable and keeps working exactly as before either way. */}
      <Pressable
        onPress={editing ? undefined : () => router.push(`${basePath}/content/${type}/${id}` as any)}
        onPressIn={editing ? drag?.onActivate : undefined}
      >
        {posterPath ? (
          <Image source={{ uri: `${POSTER_BASE}${posterPath}` }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Text style={styles.posterFallbackText}>{t("No image")}</Text>
          </View>
        )}

        {editing && (
          <View style={styles.removeOverlay}>
            <Pressable style={styles.removeButton} onPress={onRemove} hitSlop={8} accessibilityLabel={t("Remove")}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        )}
      </Pressable>

      <View style={styles.ratingRow}>
        {rating != null ? (
          // 9, not the app-wide default 13 — this card's own poster is only
          // ~1/5 of screen width (5-across grid), narrow enough that 5 stars
          // at the default size were actually WIDER than the poster itself
          // (5*13 + 4 ≈ 69px vs. a ~65px-wide poster on a typical phone),
          // overflowing the card. 5*9 + 4 ≈ 49px comfortably fits under it.
          <StarRatingDisplay value={rating} size={9} />
        ) : (
          <Text style={styles.unrated}>{t("Not rated")}</Text>
        )}
      </View>
    </View>
  );
}
