import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import Pressable from "../components/common/TapSafePressable";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useCommunity } from "../hooks/useCommunities";
import { listGroupLists, setFeaturedLists } from "../api/groupService";
import DiscoverListCard from "../components/DiscoverListCard";
import type { GroupListSummary } from "../types";
import { fonts } from "../theme/typography";

const MAX_FEATURED = 3;

// Every list this community has — the "See all" behind Overview's Featured
// Lists rail (which only ever shows up to 3). The admin's own settings
// icon opens a selection mode here ("pin the lists you want shown on
// Overview") to choose exactly which ones those 3 are, direct ask.
export default function CommunityListsScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { group } = useCommunity(slug ?? "");
  const isOwner = !!user && group?.owner?._id === user._id;

  const [lists, setLists] = useState<GroupListSummary[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!slug) return;
    listGroupLists(slug)
      .then(setLists)
      .catch(() => setLists((current) => current ?? []));
  }, [slug]);

  useFocusEffect(load);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("Community Lists") });
  }, [navigation, t]);

  const startSelecting = () => {
    setSelectedIds((lists ?? []).filter((l) => l.isFeatured).map((l) => l._id));
    setSelecting(true);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= MAX_FEATURED) return current;
      return [...current, id];
    });
  };

  const save = async () => {
    if (!slug || saving) return;
    setSaving(true);
    try {
      await setFeaturedLists(slug, selectedIds);
      setLists((current) => (current ? current.map((l) => ({ ...l, isFeatured: selectedIds.includes(l._id) })) : current));
      setSelecting(false);
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.base100 },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },
        headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
        headerHint: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.placeholder, paddingRight: 10 },
        manageText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
        list: { paddingHorizontal: 16, paddingBottom: 28, paddingTop: 4 },
        cardWrap: { position: "relative" },
        cardSelectedRing: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 10,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.primary,
        },
        featuredPill: {
          position: "absolute",
          top: 8,
          right: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          backgroundColor: colors.base100,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        featuredPillText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.primary },
        checkbox: {
          position: "absolute",
          top: 8,
          right: 8,
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: colors.border,
          backgroundColor: colors.base100,
          alignItems: "center",
          justifyContent: "center",
        },
        checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
        empty: { textAlign: "center", color: colors.placeholder, marginTop: 60, paddingHorizontal: 32 },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 28,
          backgroundColor: colors.base100,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        saveButton: { height: 50, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
        saveButtonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.primaryContent },
      }),
    [colors]
  );

  return (
    <View style={styles.screen}>
      {isOwner ? (
        <View style={styles.headerRow}>
          <Text style={styles.headerHint}>
            {selecting ? t("Pin the lists you want shown on Overview — up to 3.") : t("{{count}} lists", { count: lists?.length ?? 0 })}
          </Text>
          <Pressable onPress={selecting ? () => setSelecting(false) : startSelecting} hitSlop={8}>
            <Text style={styles.manageText}>{selecting ? t("Cancel") : t("Settings")}</Text>
          </Pressable>
        </View>
      ) : null}

      {lists === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item._id}
          contentContainerStyle={[styles.list, selecting && { paddingBottom: 120 }]}
          ListEmptyComponent={<Text style={styles.empty}>{t("No lists yet.")}</Text>}
          renderItem={({ item }) => {
            const checked = selectedIds.includes(item._id);
            return (
              <View style={styles.cardWrap}>
                <DiscoverListCard
                  list={{ ...item, owner: null }}
                  communityIdentity={group ? { name: group.name, coverImage: group.coverImage } : undefined}
                  basePath="/socials"
                  // Nested under this community's own stack — see
                  // CommunityHubTab.tsx's own identical fix/comment.
                  onPress={() =>
                    selecting ? toggleSelected(item._id) : router.push(`/socials/communities/${slug}/lists/${item._id}` as never)
                  }
                />
                {selecting ? (
                  <>
                    {checked ? <View style={styles.cardSelectedRing} pointerEvents="none" /> : null}
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]} pointerEvents="none">
                      {checked ? <Ionicons name="checkmark" size={14} color={colors.primaryContent} /> : null}
                    </View>
                  </>
                ) : item.isFeatured ? (
                  <View style={styles.featuredPill} pointerEvents="none">
                    <Ionicons name="star" size={11} color={colors.primary} />
                    <Text style={styles.featuredPillText}>{t("Featured")}</Text>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {selecting ? (
        <View style={styles.footer}>
          <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={colors.primaryContent} /> : <Text style={styles.saveButtonText}>{t("Save")}</Text>}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
