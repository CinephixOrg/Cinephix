import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText, Line } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import MatchCloudBubble from "./MatchCloudBubble";
import MatchAnalysisPanel from "./MatchAnalysisPanel";
import { prefetchMatchAnalysis, type MatchFilters } from "../../api/matchService";
import type { SyncCandidate } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { fonts } from "../../theme/typography";

// Which cloud ranks (0-indexed: #1 is rank 0) are tier-gated — Free only
// ever gets its #1 match locked (the most enticing one, and already the
// cloud's own largest/most-central bubble); Plus gets #4-5 locked instead,
// keeping its own top 3 fully open. Premium/dev: nothing locked.
function lockedRanksFor(tier: string): Set<number> {
  if (tier === "free") return new Set([0]);
  if (tier === "plus") return new Set([3, 4]);
  return new Set();
}

const RANK_RATIO = [1.0, 0.82, 0.68, 0.56, 0.56];
const EDGE_PAD = 8;
const MIN_GAP = 10;
// A selected bubble grows by this many px of *diameter* (7px of radius per
// side) — computeCloudLayout below guarantees MIN_GAP=10px of edge-to-edge
// clearance to the nearest neighbor for every bubble, and only the selected
// one ever grows, so this stays safely under that bound (3px of margin left
// even in the tightest real layout) by construction, not by observation.
// Deliberately a fixed pixel amount, not a flat scale percentage — a flat
// percentage would add far more than 10px of radius to the largest (rank 0)
// bubble than to the smallest, breaking the guarantee for the big one.
const SELECTED_GROWTH_PX = 14;

const AnimatedLine = Animated.createAnimatedComponent(Line);

interface BubblePosition {
  id: string;
  x: number;
  y: number;
  rank: number;
  diameter: number;
}

// Deterministic "ring-of-4-around-1" layout with a randomized global
// rotation + an analytically-bounded per-bubble jitter, rather than
// rejection-sampling — N is always <=5, so a closed-form placement that
// guarantees non-overlap by construction is simpler and has no risk of an
// unbounded retry loop on a narrow screen.
//
// The boundary is an ELLIPSE (cloudWidth x cloudHeight), not a circle — the
// cloud spreads further toward the horizontal edges while vertical spread
// stays tighter. maxDist per outer bubble is computed from the ellipse's
// own radius *at that bubble's angle* (wider allowance near 0°/180°,
// unchanged near 90°/270°), using the standard ellipse-radius-at-angle
// formula, rather than one flat radius.
function computeCloudLayout(
  candidates: SyncCandidate[],
  cloudWidth: number,
  cloudHeight: number,
  bubbleBaseDiameter: number
): Record<string, BubblePosition> {
  const cloudCenterX = cloudWidth / 2;
  const cloudCenterY = cloudHeight / 2;
  const ellipseA = cloudWidth / 2 - EDGE_PAD;
  const ellipseB = cloudHeight / 2 - EDGE_PAD;
  const radiusAtAngle = (angleRad: number) => {
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return (ellipseA * ellipseB) / Math.sqrt((ellipseB * cos) ** 2 + (ellipseA * sin) ** 2);
  };
  const diameterFor = (rank: number) => bubbleBaseDiameter * RANK_RATIO[rank];
  const radiusFor = (rank: number) => diameterFor(rank) / 2;

  const positions: Record<string, BubblePosition> = {};
  if (candidates.length === 0) return positions;

  const first = candidates[0];
  positions[first.user._id] = { id: first.user._id, x: cloudCenterX, y: cloudCenterY, rank: 0, diameter: diameterFor(0) };
  if (candidates.length === 1) return positions;

  const rest = candidates.slice(1);
  const baseAngles = [0, 90, 180, 270].slice(0, rest.length);
  const angleStep = 360 / rest.length;
  const globalOffsetDeg = Math.random() * 360;
  const r0 = radiusFor(0);

  const outer = baseAngles.map((baseDeg, idx) => {
    const rank = idx + 1;
    const rI = radiusFor(rank);
    const minDist = r0 + rI + MIN_GAP;
    const maxDist = Math.max(radiusAtAngle((baseDeg * Math.PI) / 180) - rI, minDist);
    return { rank, baseDeg, rI, minDist, maxDist, maxJitterDeg: 0 };
  });

  outer.forEach((b, i) => {
    const next = outer[(i + 1) % outer.length];
    const worstDist = Math.min(b.minDist, next.minDist);
    const ratio = (b.rI + next.rI + MIN_GAP) / (2 * worstDist);
    const thetaMinDeg = ratio >= 1 ? angleStep : (2 * Math.asin(Math.min(1, ratio)) * 180) / Math.PI;
    b.maxJitterDeg = Math.max(0, (angleStep - thetaMinDeg) / 2);
  });

  outer.forEach((b) => {
    const angleJitter = (Math.random() * 2 - 1) * b.maxJitterDeg;
    const radiusJitter = 0.15 + Math.random() * 0.7;
    const dist = b.minDist + radiusJitter * (b.maxDist - b.minDist);
    const angleRad = ((b.baseDeg + globalOffsetDeg + angleJitter) * Math.PI) / 180;
    const candidate = rest[b.rank - 1];
    positions[candidate.user._id] = {
      id: candidate.user._id,
      x: cloudCenterX + dist * Math.cos(angleRad),
      y: cloudCenterY + dist * Math.sin(angleRad),
      rank: b.rank,
      diameter: diameterFor(b.rank),
    };
  });

  return positions;
}

interface Props {
  candidates: SyncCandidate[];
  filters: MatchFilters;
}

// The top-5 matches as a "profile cloud": #1 centered, the rest scattered
// non-overlapping around it (sized by rank), each with a gray %-ring and a
// gentle idle drift, linked to #1 by thin decorative dotted lines. Tapping a
// bubble reveals MatchAnalysisPanel inline below the cloud (not a separate
// screen/modal) — tapping the same bubble again collapses it. (A previous
// round auto-scrolled the page down to the analysis section on selection —
// removed per direct ask; tapping a bubble no longer moves the page at all.)
export default function MatchResultsCloud({ candidates, filters }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Which candidate ids are currently tier-locked — kept in a ref (assigned
  // fresh every render, not a dependency of handleSelectCandidate below) so
  // the callback's own identity stays stable for MatchCloudBubble's memo,
  // the same reasoning activeCandidateIdRef-style refs already use elsewhere
  // in this feature for "read latest value inside a stable callback."
  const lockedIdsRef = useRef<Set<string>>(new Set());
  const lockedRanks = lockedRanksFor(user?.accountTier ?? "free");
  lockedIdsRef.current = new Set(
    candidates.filter((_, i) => lockedRanks.has(i)).map((c) => c.user._id)
  );

  // Stable across renders (empty dep array — it only ever reads/writes via
  // the updater-function form of setSelectedId, never closes over selectedId
  // itself) so MatchCloudBubble's own React.memo can actually take effect —
  // a fresh inline arrow function passed as a prop on every render would
  // make every bubble re-render on every selection change regardless of
  // memo, since a changed prop identity always defeats a shallow-compare
  // memo even when nothing else about that bubble actually changed.
  const handleSelectCandidate = useCallback((id: string) => {
    if (lockedIdsRef.current.has(id)) {
      router.push("/match/subscription" as any);
      return;
    }
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // Wider than tall on purpose — the cloud spreads further toward the
  // horizontal edges. cloudWidth trims its own side margin and raises its
  // cap so it reliably ends up larger than cloudHeight on any real phone
  // width. The 8px trimmed off each side here is made up for by
  // computeCloudLayout's own inner EDGE_PAD, so total clearance from the
  // actual screen edge is unchanged.
  const cloudWidth = Math.min(screenWidth - 16, 480);
  const cloudHeight = Math.min(screenWidth - 32, 380);
  // RANK_RATIO controls the relative size difference between ranks.
  const bubbleBaseDiameter = cloudHeight * 0.3;

  // Stable across re-renders for the same result set — only recomputed if
  // the actual candidate set changes (a fresh search).
  const layoutKey = candidates.map((c) => c.user._id).join(",");
  const layout = useMemo(
    () => computeCloudLayout(candidates, cloudWidth, cloudHeight, bubbleBaseDiameter),
    [layoutKey, cloudWidth, cloudHeight, bubbleBaseDiameter]
  );

  // One idle-bob Animated.ValueXY per candidate (native-driven, smooth —
  // MatchCloudBubble's own transform reads this directly), plus a second,
  // JS-mirrored value per candidate the connecting lines below read instead
  // — a native-driven value only updates the one native view it's attached
  // to, and an SVG Line's x1/y1/x2/y2 is a different native view, so it
  // needs its own JS-thread copy (kept in sync by a throttled listener
  // inside MatchCloudBubble) rather than sharing the native-driven one
  // directly.
  const bobAnimsRef = useRef<Record<string, Animated.ValueXY>>({});
  const getBobAnim = (id: string) => {
    if (!bobAnimsRef.current[id]) bobAnimsRef.current[id] = new Animated.ValueXY({ x: 0, y: 0 });
    return bobAnimsRef.current[id];
  };
  const lineBobAnimsRef = useRef<Record<string, Animated.ValueXY>>({});
  const getLineBobAnim = (id: string) => {
    if (!lineBobAnimsRef.current[id]) lineBobAnimsRef.current[id] = new Animated.ValueXY({ x: 0, y: 0 });
    return lineBobAnimsRef.current[id];
  };
  // Both dictionaries above only ever grow via getBobAnim/getLineBobAnim —
  // this component isn't remounted between searches (the same instance
  // just receives a new `candidates` prop), so with no pruning they'd keep
  // an Animated.ValueXY pair around for every candidate ever seen across
  // the whole session, not just the current 5. Small per-entry (two plain
  // objects), but genuinely unbounded over many re-searches. Pruned
  // whenever the candidate *set* actually changes (layoutKey), not on
  // every render.
  useEffect(() => {
    const currentIds = new Set(candidates.map((c) => c.user._id));
    for (const id of Object.keys(bobAnimsRef.current)) {
      if (!currentIds.has(id)) delete bobAnimsRef.current[id];
    }
    for (const id of Object.keys(lineBobAnimsRef.current)) {
      if (!currentIds.has(id)) delete lineBobAnimsRef.current[id];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  const centerCandidateId = candidates[0]?.user._id;
  const centerPos = centerCandidateId ? layout[centerCandidateId] : undefined;
  // Hoisted here rather than looked up fresh inside the connecting-lines
  // map below — every line shares the same center-anchored bob, so there's
  // no reason to re-run the lookup once per line.
  const centerBob = centerCandidateId ? getLineBobAnim(centerCandidateId) : null;
  const selectedCandidate = candidates.find((c) => c.user._id === selectedId);

  // Fire-and-forget as soon as results are in — the #1 match is the one
  // already centered/most prominent in the cloud, so it's the statistically
  // likeliest tap. A real LLM round-trip (MatchAnalysisPanel's own
  // "Generating your compatibility analysis..." wait, ~seconds) can't be
  // made instant, but starting it *before* the tap instead of *at* the tap
  // means the common case doesn't pay that wait twice over. Nothing here
  // needs the result directly — MatchAnalysisPanel's own effect picks it up
  // from prefetchMatchAnalysis's shared cache once the user actually taps.
  //
  // Keyed on filtersKey (a stable content key), not `filters` itself —
  // match/index.tsx's filters/results pages both stay mounted at once (a
  // deliberate slide-transition choice, not something this fix touches),
  // so it's real: going back to the filters page, toggling a switch off
  // then on again, and returning here *without* re-searching hands this
  // component a brand-new `filters` object reference with the exact same
  // values. Keying on the object itself refired this prefetch — a real
  // network call, now gated by analyzeMatchWithUser's own per-pair
  // cooldown (matchController.js) — for a candidate list that never
  // actually changed, silently eating into that candidate's cooldown
  // budget for zero benefit.
  const filtersKey = `${filters.type}:${filters.genres.join(",")}:${filters.useCount}:${filters.useAvgRating}`;
  useEffect(() => {
    if (centerCandidateId) prefetchMatchAnalysis(centerCandidateId, filters).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerCandidateId, filtersKey]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { width: cloudWidth, alignSelf: "center" },
        headerCaptionSvg: { marginTop: 14, marginBottom: 14 },
        cloudBox: { width: cloudWidth, height: cloudHeight, position: "relative" },
        // Pushed well below the cloud rather than hugging it — this hint is
        // meant to mark the spot the results deck itself will open into
        // once a bubble is tapped (MatchAnalysisPanel's own wrap starts
        // with paddingTop:24 once mounted), not read as a caption on the
        // cloud above it.
        footerCaption: { fontSize: 12, color: colors.placeholder, textAlign: "center", marginTop: 36 },
      }),
    [colors, cloudWidth, cloudHeight]
  );

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={30} style={styles.headerCaptionSvg}>
        <Defs>
          <LinearGradient id="cloudHeaderGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.secondary} />
          </LinearGradient>
        </Defs>
        <SvgText
          x="50%"
          y="22"
          textAnchor="middle"
          fontFamily={fonts.extrabold}
          fontSize={19}
          fontWeight="800"
          letterSpacing={0.4}
          fill="url(#cloudHeaderGradient)"
        >
          {t("Your Top 5 Syncs").toUpperCase()}
        </SvgText>
      </Svg>

      <View style={styles.cloudBox}>
        {/* Purely decorative "cloud" connections — no function, just gives
            the scattered bubbles a linked, cloud-like read. Rendered first
            (and therefore behind every bubble in default paint order) so
            each line visually disappears into its bubble's own center
            rather than drawing over it. Endpoints track each bubble's live
            idle-drift position (base cloud position + that bubble's own
            bob offset), not just its static resting spot, so a line never
            looks disconnected from a bubble that's mid-drift. */}
        {centerPos && (
          <Svg width={cloudWidth} height={cloudHeight} style={{ position: "absolute" }} pointerEvents="none">
            {candidates.slice(1).map((candidate) => {
              const pos = layout[candidate.user._id];
              if (!pos) return null;
              // Same center-anchored bob on every line — hoisted out of
              // the loop body it used to be recomputed inside, since it's
              // the same lookup regardless of which outer candidate this
              // particular line is for.
              const bob = getLineBobAnim(candidate.user._id);
              return (
                <AnimatedLine
                  key={candidate.user._id}
                  x1={Animated.add(centerPos.x, centerBob!.x)}
                  y1={Animated.add(centerPos.y, centerBob!.y)}
                  x2={Animated.add(pos.x, bob.x)}
                  y2={Animated.add(pos.y, bob.y)}
                  stroke={colors.placeholder}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                  strokeDasharray="1, 4"
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        )}

        {candidates.map((candidate) => {
          const pos = layout[candidate.user._id];
          if (!pos) return null;
          return (
            <MatchCloudBubble
              key={candidate.user._id}
              candidate={candidate}
              x={pos.x}
              y={pos.y}
              diameter={pos.diameter}
              rank={pos.rank}
              bobAnim={getBobAnim(candidate.user._id)}
              lineBobAnim={getLineBobAnim(candidate.user._id)}
              onSelect={handleSelectCandidate}
              isSelected={selectedId === candidate.user._id}
              selectedScale={(pos.diameter + SELECTED_GROWTH_PX) / pos.diameter}
              locked={lockedRanks.has(pos.rank)}
            />
          );
        })}
      </View>

      {/* Only meaningful before a selection exists — once a bubble is
          tapped, the deck it's pointing at is right there, so the hint
          would just be stale clutter sitting above it. */}
      {!selectedCandidate && <Text style={styles.footerCaption}>{t("Tap a profile to see details")}</Text>}

      {selectedCandidate && <MatchAnalysisPanel candidate={selectedCandidate} filters={filters} containerWidth={cloudWidth} />}
    </View>
  );
}
