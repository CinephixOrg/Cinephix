import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { FAQ_SECTIONS } from "../../data/faqData";
import { useTheme } from "../../context/ThemeContext";
import type { ColorPalette } from "../../theme/palettes";
import { fonts } from "../../theme/typography";

// The official Cinephix account's own profile tab — a real in-app FAQ,
// direct ask, reached by visiting Cinephix's own public profile rather
// than a separate Settings-style page. Grouped accordion (tap a question
// to expand its answer in place; several can be open at once, no
// "only one at a time" restriction — nothing here is mutually exclusive
// content the way, say, a single-select filter sheet would be). English
// only, same precedent LegalPage.tsx's About/Privacy/Terms pages already
// established for static explanatory prose.
export default function ProfileFaqTab() {
  const { colors } = useTheme();
  const styles = useMemo(() => buildStyles(colors), [colors]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      {FAQ_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, i) => {
              const key = `${section.title}-${i}`;
              const open = openKeys.has(key);
              return (
                <View key={key}>
                  <Pressable style={styles.row} onPress={() => toggle(key)}>
                    <Text style={styles.question}>{item.question}</Text>
                    <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.placeholder} />
                  </Pressable>
                  {open && (
                    <View style={styles.answerWrap}>
                      <Text style={styles.answer}>{item.answer}</Text>
                    </View>
                  )}
                  {i < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

function buildStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 },
    section: { marginBottom: 18 },
    sectionTitle: {
      fontFamily: fonts.bold,
      fontSize: 12.5,
      color: colors.placeholder,
      letterSpacing: 0.5,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    card: { backgroundColor: colors.base200, borderRadius: 14, overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    question: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.baseContent },
    answerWrap: { paddingHorizontal: 14, paddingBottom: 14 },
    answer: { fontSize: 13, lineHeight: 19, color: colors.baseContent, opacity: 0.8 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginHorizontal: 14 },
  });
}
