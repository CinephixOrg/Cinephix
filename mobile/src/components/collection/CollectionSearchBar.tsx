import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// The main Search page waits 400ms because every query is a network request.
// This one runs in memory in well under a frame, so the debounce only needs
// to be long enough to skip the intermediate states of a fast typist.
const DEBOUNCE_MS = 120;

interface Props {
  placeholder: string;
  /** The text to start with, read on mount — restores a search when a sheet reopens. */
  initialQuery?: string;
  onChangeQuery: (query: string) => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
}

// Search box for a collection, with the filter button at its trailing edge
// the way the main Search page places it. Searches only the list on screen.
//
// Owns its own text. The screen only hears about the debounced value, so a
// keystroke re-renders this bar and nothing else.
function CollectionSearchBar({ placeholder, initialQuery = "", onChangeQuery, onOpenFilters, activeFilterCount }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [value, setValue] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const clearVisibility = useRef(new Animated.Value(0)).current;
  const hasText = value.length > 0;

  useEffect(() => {
    // Clearing is applied immediately — waiting to show the full list again
    // after the box is already empty reads as lag.
    if (value.length === 0) {
      onChangeQuery("");
      return;
    }
    const timer = setTimeout(() => onChangeQuery(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, onChangeQuery]);

  useEffect(() => {
    Animated.timing(clearVisibility, { toValue: hasText ? 1 : 0, duration: 140, useNativeDriver: true }).start();
  }, [clearVisibility, hasText]);

  const filtering = activeFilterCount > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          flexDirection: "row",
          alignItems: "center",
          height: 48,
          borderRadius: 14,
          borderWidth: 1.5,
          backgroundColor: colors.base200,
          paddingLeft: 14,
          paddingRight: 5,
          gap: 8,
        },
        input: {
          flex: 1,
          height: "100%",
          fontFamily: fonts.regular,
          fontSize: 15,
          color: colors.baseContent,
          paddingVertical: 0,
        },
        clear: { padding: 4 },
        filterButton: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
        badge: {
          position: "absolute",
          top: -4,
          right: -4,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.baseContent,
          borderWidth: 2,
          borderColor: colors.base200,
        },
        badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.base100 },
      }),
    [colors]
  );

  return (
    <View style={[styles.bar, { borderColor: focused ? colors.primary : colors.border }]}>
      <Ionicons name="search" size={18} color={focused ? colors.primary : colors.placeholder} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <Animated.View style={{ opacity: clearVisibility }} pointerEvents={hasText ? "auto" : "none"}>
        <Pressable
          style={styles.clear}
          onPress={() => {
            setValue("");
            inputRef.current?.focus();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("Clear search")}
        >
          <Ionicons name="close-circle" size={18} color={colors.placeholder} />
        </Pressable>
      </Animated.View>
      <Pressable
        onPress={onOpenFilters}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t("Filters")}
        style={({ pressed }) => [
          styles.filterButton,
          { backgroundColor: filtering ? colors.primary : colors.base300 },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <Ionicons name="options-outline" size={19} color={filtering ? colors.primaryContent : colors.baseContent} />
        {filtering ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

export default memo(CollectionSearchBar);
