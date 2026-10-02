import { useMemo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import Pressable from "./common/TapSafePressable";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import UserAvatar from "./UserAvatar";
import TierGradientText from "./TierGradientText";
import StarRatingDisplay from "./StarRatingDisplay";
import { timeAgo } from "../utils/timeAgo";
import type { ActivityEvent } from "../types";
import { useTheme } from "../context/ThemeContext";
import { fonts } from "../theme/typography";

const POSTER_BASE = "https://image.tmdb.org/t/p/w92";

// Same icon choices as PersonalActivityRow.tsx's own ICON map (profile's
// self-activity log) for every type the two share — direct ask to reuse
// that "nicer" design rather than this file's own previous bare "-outline"
// glyphs. towatch_added/followed/shared/podium have no equivalent there
// (Personal doesn't track any of the four), picked fresh in the same
// solid-glyph style.
const ICON: Record<ActivityEvent["type"], keyof typeof Ionicons.glyphMap> = {
  rated: "star",
  reviewed: "pencil",
  watchlist_added: "checkmark-done",
  favorited: "heart",
  list_item_added: "list",
  towatch_added: "bookmark",
  followed: "person-add",
  shared: "share-social",
  podium: "trophy",
};

interface Props {
  event: ActivityEvent;
  basePath: "/home" | "/search";
}

// One row of network activity — every type here leads with a small circular
// icon badge (`ICON` above, same solid-glyph choices as PersonalActivityRow
// — this file's own icons used to be bare "-outline" glyphs with no
// background, changed on direct ask to match that "nicer" design), followed
// by a real, dimmed sentence embedding the title, translated across this
// app's ~12 languages via the same {{var}}-interpolated-key convention used
// elsewhere (e.g. "Created list \"{{name}}\"").
// `rated` reads "Rated ★★★★☆ for {{title}}" as ONE reflowing `Text` — "Rated"
// and "for {{title}}" as plain text, the stars as a *plain string*
// (`ratingStars()`, same 1-10→0.5-5/full-stars/"1/2" logic
// StarRatingDisplay.tsx uses) nested inside via its own styled `Text`, not
// the `StarRatingDisplay` component itself. Two earlier attempts at this
// both wrapped wrong: (1) 4 separate flex-row siblings (icon/"Rated"
// word/StarRatingDisplay/trailing text) — flexbox treats each sibling as
// an atomic block, so as soon as the trailing text didn't fit in the
// remaining space on line 1 it jumped *entirely* to line 2 rather than
// filling out the rest of line 1 first, which read as wrapping too early;
// (2) making the row `flexWrap: "wrap"` on top of that — same atomic-child
// problem, just moved to a different sibling boundary. True "fill to the
// end of line 1, only wrap what doesn't fit" behavior needs real text
// reflow, which means everything living inside one `Text`. The actual
// `StarRatingDisplay` component couldn't be nested in there directly — it
// renders a `View` wrapping several of its own `Text` stars, and RN's
// support for an arbitrary View-with-children (vs. a single atomic inline
// image) rendered inline inside `Text` has known, inconsistent behavior on
// Android — so this uses a plain star *string* instead, which nests safely
// since it's just characters. Reuses the app's existing bare "Rated" key
// (a filter-chip label elsewhere, `WatchlistGrid.tsx`) rather than the
// pre-existing "Rated {{title}}" key — that one is 2nd-person in most
// locales ("you rated X"), wrong under someone else's username here, while
// the bare "Rated" is just a past-participle/label in every locale checked
// (no person/tense conjugation to get backwards).
// `favorited`/`list_item_added` make part of their sentence (the word
// "favorites", or the list name) independently tappable via
// `renderLinkedSentence` below — a `Pressable` embedded *inline inside*
// the same reflowing sentence `Text` (not a separate flex-row sibling,
// which — like `rated`'s own early attempts above — wrapped too early;
// and not a nested `Text` with its own `onPress`, which silently lost the
// tap to the row's outer Pressable every time). See that function's own
// comment for why inline-Pressable-in-Text is expected to work on this
// app's actual RN version despite an earlier round's more cautious
// avoidance of it, and what specifically about it is still unverified.
// Also deliberately not the react-i18next `Trans` component (never used
// anywhere else in this app, and would need every locale's translation
// re-authored with embedded component tags at the exact right position);
// splitting the already-*resolved* sentence string on a known substring
// works for any locale's word order automatically instead.
// `watchlist_added` keeps its render branch (and its own bonus-rating
// sub-line, still on its own line since it's optional/supplementary rather
// than the event's core subject) even though `getNetworkActivity` no
// longer generates it — see types/index.ts's own comment for why it's
// still reachable via ContentWatchedSection.tsx. `list_created` was fully
// removed (no longer generated by any endpoint this component's callers use).
export default function ActivityRow({ event, basePath }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  // `followed`/`shared`/`podium` have no content — the most useful tap
  // target for each is a relevant person's profile instead: `followed`
  // goes to whoever got followed (more interesting than the actor, already
  // shown by the row's own avatar/username), `shared`/`podium` go to the
  // actor's own profile (see their Shares tab / confirm the podium spot).
  const goToTarget = () => {
    if ("content" in event) {
      router.push(`${basePath}/content/${event.content.type}/${event.content.id}` as any);
    } else if (event.type === "followed") {
      if (event.targetUser) router.push(`/user/${event.targetUser._id}` as any);
    } else {
      router.push(`/user/${event.actor._id}` as any);
    }
  };

  // Same tier signal as ShareCard.tsx's own posts and ReviewFeedCard.tsx's/
  // ReviewSwipeCard.tsx's own reviewer rows now: UserAvatar's TierAvatarFrame
  // ring plus a gradient-filled username (TierGradientText) — no separate
  // diamond mark, direct ask to bring this row in line with every other
  // single-avatar-per-row context in the app (one avatar, room for a name,
  // as opposed to Podium/Suggested Users' tight multi-avatar rows, which
  // keep the diamond-only treatment on purpose).

  // Same star-count logic as StarRatingDisplay.tsx (1-10 -> 0.5-5 scale,
  // full stars only, "1/2" for a half) but built as a plain string instead
  // of that component's own <View> of nested <Text> stars — this needs to
  // sit *inline inside* the "Rated ... for {{title}}" sentence as part of
  // one continuous, reflowing paragraph (see `detailRow`'s "rated" comment
  // below for why a flex-row-of-siblings version wraps wrong), and a
  // string can nest inside Text safely where an arbitrary View can't.
  const ratingStars = (value: number) => {
    const scaled = value / 2;
    const full = Math.floor(scaled);
    const hasHalf = scaled - full >= 0.5;
    return "★".repeat(full) + (hasHalf ? " 1/2" : "");
  };

  // Splits an already-*resolved* (post-t()) sentence around one substring
  // and renders it as ONE reflowing `Text` — before-text, the tappable
  // segment, after-text, all as children of the same outer Text — rather
  // than a flex-row of separate pieces. A flex-row version was tried first
  // and, like `rated`'s own earlier attempts (see that comment above),
  // wrapped too early: flexbox treats each sibling as an atomic block, so
  // the link+after piece jumped *entirely* to line 2 the moment it didn't
  // fit next to `before`, rather than filling the rest of line 1 first.
  // True "fill the line, then wrap" needs everything inside one Text.
  // The tappable segment used to be a `Pressable` embedded inline inside
  // Text (with a hand-guessed `top: 2` nudge on its wrapper, ever a genuine
  // pixel measurement) — reported live as visibly shifted out of position,
  // confirming the concern this file's own earlier comment already flagged
  // as unverified. `ShareCard.tsx`'s own inline "watchlist" link had hit
  // this *exact* problem in an earlier round and settled on a plain nested
  // `Text` with its own `onPress` instead of a `Pressable` — no wrapper
  // View sitting inside Text with its own layout quirks to fight, just
  // another run of text that happens to be tappable, so it shares the
  // surrounding line's real baseline automatically. Ported that fix here
  // rather than re-guessing another nudge value. Nested Text-in-Text still
  // correctly claims its own tap before the row's outer Pressable sees it,
  // confirmed by that same ShareCard precedent.
  // Also deliberately not the react-i18next `Trans` component (never used
  // anywhere else in this app, and would need every locale's translation
  // re-authored with embedded component tags at the exact right position).
  // Splitting the *resolved* string works for any locale's word order
  // automatically, since i18next already ordered the sentence correctly —
  // this only has to find where the known substring landed.
  const renderLinkedSentence = (fullText: string, linkText: string, onLinkPress: () => void) => {
    const idx = fullText.toLowerCase().indexOf(linkText.toLowerCase());
    if (idx === -1) {
      // Substring not found (shouldn't happen given how these are called,
      // but stay safe) — the sentence still renders, just without a link.
      return (
        <Text style={styles.sentence} numberOfLines={2}>
          {fullText}
        </Text>
      );
    }
    return (
      <Text style={styles.sentence} numberOfLines={2}>
        {fullText.slice(0, idx)}
        <Text style={styles.link} onPress={onLinkPress}>
          {fullText.slice(idx, idx + linkText.length)}
        </Text>
        {fullText.slice(idx + linkText.length)}
      </Text>
    );
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
        avatarWrap: {},
        textCol: { flex: 1 },
        headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        time: { fontSize: 11, color: colors.placeholder },
        // flex-start (not center) so the icon aligns with the sentence's
        // *first* line when it wraps to 2 lines.
        detailRow: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginTop: 3 },
        // Small circular badge around each type's icon — same treatment as
        // PersonalActivityRow.tsx's own `iconWrap` (colors.base200 chip,
        // solid glyph in colors.primary), scaled down to fit inline with
        // the sentence text instead of that file's own bigger row-leading
        // version (this row already has UserAvatar for "who", the icon here
        // only ever needs to say "what").
        iconWrap: {
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: colors.base200,
          alignItems: "center",
          justifyContent: "center",
        },
        sentence: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.placeholder },
        // The star-string nested inside `sentence` for `rated` — same
        // filled-star color StarRatingDisplay itself uses. Explicit
        // fontSize/lineHeight (matching `sentence`) rather than just
        // inheriting: a nested Text with only `color` set falls back to
        // its own default font metrics, which don't share a baseline with
        // the surrounding custom-font text and reads as sitting a little
        // off-line — same fix `link` below needs for the same reason.
        starsInline: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
        // The tappable substring within a sentence (a list name, or the
        // word "favorites") — same font metrics as `sentence`, same reason
        // as `starsInline` above. A plain nested `Text` with its own
        // `onPress` (no wrapping Pressable/View) — that wrapper used to be
        // exactly what threw its vertical position off, per this file's own
        // `renderLinkedSentence` comment.
        link: { fontFamily: fonts.medium, fontSize: 13, color: colors.primary },
        // Secondary line under a sentence's own star rating (rated always;
        // watchlist_added only when the bonus rating is present) — indented
        // to align under the sentence text rather than the icon (20px badge
        // + 5px detailRow gap), since it's supplementary detail about the
        // sentence, not its own new row.
        ratingRow: { marginTop: 3, marginLeft: 25 },
        poster: { width: 32, height: 48, borderRadius: 5, backgroundColor: colors.base300 },
      }),
    [colors]
  );

  return (
    <Pressable style={styles.row} onPress={goToTarget}>
      <UserAvatar
        userId={event.actor._id}
        username={event.actor.username}
        profilePicUrl={event.actor.profile_pic_url}
        size={32}
        tier={event.actor.accountTier}
      />
      <View style={styles.textCol}>
        <View style={styles.headerRow}>
          <TierGradientText
            text={event.actor.username}
            tier={event.actor.accountTier}
            fontSize={13}
            bold
            color={colors.baseContent}
            gradientId={`activityRowUsernameGradient-${event.actor._id}-${event.createdAt}`}
          />
          {/* Absent for a `favorited` event whose actor favorited this
              before FavoriteEvent's log existed (see that type's own
              comment in types/index.ts) — omitted rather than showing a
              fake/wrong time. Every other event type always has a real one. */}
          {event.createdAt && <Text style={styles.time}>{timeAgo(event.createdAt)}</Text>}
        </View>

        {event.type === "rated" && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.rated} size={11} color={colors.primary} />
            </View>
            <Text style={styles.sentence} numberOfLines={2}>
              {t("Rated")} <Text style={styles.starsInline}>{ratingStars(event.value)}</Text>{" "}
              {t("for {{title}}", { title: event.content.title })}
            </Text>
          </View>
        )}

        {event.type === "watchlist_added" && (
          <>
            <View style={styles.detailRow}>
              <View style={styles.iconWrap}>
                <Ionicons name={ICON.watchlist_added} size={11} color={colors.primary} />
              </View>
              <Text style={styles.sentence} numberOfLines={2}>
                {t("Added {{title}} to their watched list", { title: event.content.title })}
              </Text>
            </View>
            {event.rating != null && (
              <View style={styles.ratingRow}>
                <StarRatingDisplay value={event.rating} size={11} />
              </View>
            )}
          </>
        )}

        {event.type === "reviewed" && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.reviewed} size={11} color={colors.primary} />
            </View>
            <Text style={styles.sentence} numberOfLines={2}>
              {t("Wrote a review for {{title}}", { title: event.content.title })}
            </Text>
          </View>
        )}

        {event.type === "favorited" &&
          (() => {
            // The standalone "Favorites" key is already correctly declined/
            // cased for every locale (it's the app's own nav-tab label) —
            // reused here purely to know what substring to search for
            // inside the resolved sentence, not re-translated for this.
            const favoritesWord = t("Favorites");
            const sentence = t("Added {{title}} to their favorites", { title: event.content.title });
            return (
              <View style={styles.detailRow}>
                <View style={styles.iconWrap}>
                  <Ionicons name={ICON.favorited} size={11} color={colors.primary} />
                </View>
                {renderLinkedSentence(sentence, favoritesWord, () =>
                  router.push(`/user/${event.actor._id}?tab=favorites` as any)
                )}
              </View>
            );
          })()}

        {event.type === "list_item_added" && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.list_item_added} size={11} color={colors.primary} />
            </View>
            {renderLinkedSentence(
              t('Added {{title}} to their list "{{listName}}"', { title: event.content.title, listName: event.listName }),
              event.listName,
              () => router.push(`${basePath}/lists/${event.listId}` as any)
            )}
          </View>
        )}

        {event.type === "towatch_added" && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.towatch_added} size={11} color={colors.primary} />
            </View>
            <Text style={styles.sentence} numberOfLines={2}>
              {t("Added {{title}} to their watchlist", { title: event.content.title })}
            </Text>
          </View>
        )}

        {event.type === "followed" && event.targetUser && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.followed} size={11} color={colors.primary} />
            </View>
            {renderLinkedSentence(
              t("Started following {{username}}", { username: event.targetUser.username }),
              event.targetUser.username,
              () => router.push(`/user/${event.targetUser!._id}` as any)
            )}
          </View>
        )}

        {event.type === "shared" && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.shared} size={11} color={colors.primary} />
            </View>
            <Text style={styles.sentence} numberOfLines={2}>
              {/* {{media}} pulls the already-translated "Media" nav-tab
                  label (theme/typography's own convention elsewhere in
                  this file — reuse an existing key for a proper-noun/brand
                  word rather than re-translating it inside 4 new keys). */}
              {event.shareType === "review"
                ? t("Shared a review to {{media}}", { media: t("Media") })
                : event.shareType === "recommendation"
                  ? t("Shared a recommendation to {{media}}", { media: t("Media") })
                  : event.shareType === "list"
                    ? t("Shared a list to {{media}}", { media: t("Media") })
                    : t("Shared an analysis to {{media}}", { media: t("Media") })}
            </Text>
          </View>
        )}

        {event.type === "podium" && (
          <View style={styles.detailRow}>
            <View style={styles.iconWrap}>
              <Ionicons name={ICON.podium} size={11} color={colors.primary} />
            </View>
            <Text style={styles.sentence} numberOfLines={2}>
              {/* Reuses PeoplePodium.tsx's own already-translated category
                  titles ("Most Followed"/"Most Watched"/"Most Reviewed")
                  via interpolation instead of 3 separate hardcoded
                  sentences — one new template key covers all 3 categories. */}
              {t("Made the {{category}} podium — #{{rank}}", {
                category: t(
                  event.category === "followed" ? "Most Followed" : event.category === "watched" ? "Most Watched" : "Most Reviewed"
                ),
                rank: event.rank,
              })}
            </Text>
          </View>
        )}
      </View>
      {"content" in event &&
        (event.content.poster_path ? (
          <Image source={{ uri: `${POSTER_BASE}${event.content.poster_path}` }} style={styles.poster} />
        ) : (
          <View style={styles.poster} />
        ))}
    </Pressable>
  );
}
