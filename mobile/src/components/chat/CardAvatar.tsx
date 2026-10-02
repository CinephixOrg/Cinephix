import { memo, useMemo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { fonts } from "../../theme/typography";
import { CARD } from "./PremiumChatCard";

interface Props {
  uri?: string | null;
  username: string;
  size: number;
  /** The ring's colour — white by default, a match's tone on a Sync card. */
  ringColor?: string;
}

// A round avatar ringed for a dark card, with the username's initials when
// there's no picture.
function CardAvatar({ uri, username, size, ringColor = CARD.white }: Props) {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        ring: {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: ringColor,
          backgroundColor: "#262633",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        image: { width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 },
        initials: { fontFamily: fonts.bold, fontSize: Math.round(size * 0.34), color: CARD.white },
      }),
    [size, ringColor]
  );
  return (
    <View style={styles.ring}>
      {uri ? (
        <Image source={{ uri }} style={styles.image} />
      ) : (
        <Text style={styles.initials}>{username.slice(0, 2).toUpperCase()}</Text>
      )}
    </View>
  );
}

export default memo(CardAvatar);
