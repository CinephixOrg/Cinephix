import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { toHashtag } from "../../utils/communities";
import { fonts } from "../../theme/typography";
import type { CategoryTone } from "./communityCategory";

interface Props {
  tags: string[];
  tone: CategoryTone;
  /** How many to show; the rest are summarised as "+N". */
  limit?: number;
  size?: "small" | "regular";
}

// A community's tags as hashtags in its category's colour: the "#" a shade
// softer than the word, on a faint tint of the same hue.
function CommunityTags({ tags, tone, limit = tags.length, size = "small" }: Props) {
  const styles = useMemo(() => {
    const regular = size === "regular";
    return StyleSheet.create({
      row: { flexDirection: "row", flexWrap: "wrap", gap: regular ? 8 : 6 },
      tag: {
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 999,
        paddingHorizontal: regular ? 11 : 9,
        paddingVertical: regular ? 5 : 3.5,
        backgroundColor: tone.tint,
      },
      hash: { fontFamily: fonts.bold, fontSize: regular ? 13 : 12, color: tone.color, opacity: 0.6 },
      word: { fontFamily: fonts.bold, fontSize: regular ? 13 : 12, color: tone.color, letterSpacing: 0.1 },
      more: { fontFamily: fonts.bold, fontSize: regular ? 13 : 12, color: tone.color, opacity: 0.75 },
    });
  }, [tone, size]);

  const shown = tags.map(toHashtag).filter(Boolean).slice(0, limit);
  const hidden = tags.length - shown.length;
  if (shown.length === 0) return null;

  return (
    <View style={styles.row}>
      {shown.map((hashtag) => (
        <View key={hashtag} style={styles.tag}>
          <Text style={styles.hash}>#</Text>
          <Text style={styles.word}>{hashtag.slice(1)}</Text>
        </View>
      ))}
      {hidden > 0 ? (
        <View style={styles.tag}>
          <Text style={styles.more}>+{hidden}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default memo(CommunityTags);
