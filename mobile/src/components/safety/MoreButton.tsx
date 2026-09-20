import { memo } from "react";
import { type StyleProp, type ViewStyle } from "react-native";
// Gesture handler's inside the Media feed (TapSafeProvider): see common/TapSafePressable.tsx.
import Pressable from "../common/TapSafePressable";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { isProtectedAccount } from "../../api/blockStore";
import { useSafety, type SafetyPerson } from "../../context/SafetyContext";
import { useTheme } from "../../context/ThemeContext";
import type { ReportEntityType } from "../../utils/safety";

interface Props {
  entityType: ReportEntityType;
  entityId: string;
  author?: SafetyPerson | null;
  /** After blocking the author from here (e.g. leave a page that's theirs). */
  onBlocked?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// The small "⋯" on someone else's review, post or list: Report it, or block
// whoever made it. Renders nothing on your own content, or on the official
// Cinephix account's (the server refuses those reports and blocks too).
function MoreButton({ entityType, entityId, author, onBlocked, size = 18, style }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { openContentActions } = useSafety();
  if (!user || (author && (author._id === user._id || isProtectedAccount(author)))) return null;
  return (
    <Pressable
      onPress={() => openContentActions({ entityType, entityId, author }, { onBlocked })}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t("More options")}
      style={({ pressed }) => [{ padding: 4, borderRadius: 14 }, pressed && { backgroundColor: colors.base300 }, style]}
    >
      <Ionicons name="ellipsis-horizontal" size={size} color={colors.placeholder} />
    </Pressable>
  );
}

export default memo(MoreButton);
