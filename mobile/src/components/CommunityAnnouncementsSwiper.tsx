import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Pressable from "./common/TapSafePressable";
// From react-native-gesture-handler, not react-native — nests inside
// Discover's outer horizontal page-switcher, same reason ListsSwiper.tsx/
// ReviewsSwiper.tsx both already use it.
import { ScrollView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import CommunityRailCard from "./CommunityRailCard";
import type { CommunityRailItem } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const SIDE_PADDING = 16;
const HINT_BOB_MS = 900;
const HINT_BOB_DISTANCE = 5;
// Matches CommunityRailCard's own CARD_HEIGHT — only "list" cards (the
// real DiscoverListCard, its own natural height) differ, a minor
// cosmetic tradeoff accepted for reusing that exact card verbatim.
const CARD_HEIGHT_HINT = 232;

interface Props {
  items: CommunityRailItem[];
}

// Discover's "Community Announcements" rail — same real full-width,
// one-card-per-swipe pager as ListsSwiper.tsx/ReviewsSwiper.tsx (direct
// ask to match that same "one at a time" feel, and the SAME fixed-height
// card shell as both — see CommunityRailCard.tsx's own comment). One
// heading, one rail, mixing two kinds of card (built by
// KesfetSection.tsx's own interleave): a community's own event, member-
// only, and a "popular community" discovery card shown to everyone —
// direct ask, after an earlier version split these into two separate
// rails/headings, which wasn't what was meant. Doesn't render at all when
// there's nothing in either list, same as every other empty rail on this
// page.
export default function CommunityAnnouncementsSwiper({ items }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const bobAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bobAnim, { toValue: 1, duration: HINT_BOB_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue: 0, duration: HINT_BOB_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bobAnim]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    if (next !== page) setPage(next);
  };
  const goToPage = (index: number) => scrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: { marginBottom: 24 },
        titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
        title: { fontFamily: fonts.bold, fontSize: 17, color: colors.baseContent },
        swiperWrap: { position: "relative" },
        page: { width: screenWidth, paddingHorizontal: SIDE_PADDING },
        arrowHintRight: { position: "absolute", right: 4, top: CARD_HEIGHT_HINT / 2 - 14 },
        arrowHintLeft: { position: "absolute", left: 4, top: CARD_HEIGHT_HINT / 2 - 14 },
        arrowCircle: {
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: `${colors.placeholder}29`,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, screenWidth]
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{t("Community Announcements")}</Text>
      </View>

      <View style={styles.swiperWrap}>
        <ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
          {items.map((item) => (
            <View key={item.key} style={styles.page}>
              <CommunityRailCard item={item} />
            </View>
          ))}
        </ScrollView>

        {page < items.length - 1 && (
          <Animated.View
            style={[styles.arrowHintRight, { transform: [{ translateX: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, HINT_BOB_DISTANCE] }) }] }]}
          >
            <Pressable style={styles.arrowCircle} onPress={() => goToPage(page + 1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={16} color={colors.baseContent} />
            </Pressable>
          </Animated.View>
        )}
        {page > 0 && (
          <Animated.View
            style={[styles.arrowHintLeft, { transform: [{ translateX: bobAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -HINT_BOB_DISTANCE] }) }] }]}
          >
            <Pressable style={styles.arrowCircle} onPress={() => goToPage(page - 1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={16} color={colors.baseContent} />
            </Pressable>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
