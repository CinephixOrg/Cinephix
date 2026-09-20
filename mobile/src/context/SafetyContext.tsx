import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "./AuthContext";
import { useChat } from "./ChatContext";
import { useToast } from "./ToastContext";
import { blockUser, getBlockedUsers, getOfficialIds, unblockUser } from "../api/safetyService";
import { isProtectedAccount, markBlocked, markUnblocked, onUserBlocked, setBlocked, setOfficialIds } from "../api/blockStore";
import { clearRooms } from "../api/chatCache";
import { clearActivityCache } from "../api/personalActivityCache";
import { invalidatePublicProfile } from "../api/publicProfileCache";
import { invalidatePublicCollections } from "../api/publicCollectionCache";
import ActionSheet, { type SheetAction } from "../components/safety/ActionSheet";
import ReportSheet, { type ReportTarget } from "../components/safety/ReportSheet";
import ConfirmDialog from "../components/settings/ConfirmDialog";
import { REPORT_ACTION_LABEL, type ReportEntityType } from "../utils/safety";

export interface SafetyPerson {
  _id: string;
  username: string;
  /** The official Cinephix account: can't be reported or blocked. */
  isOfficial?: boolean;
}

export interface ContentTarget {
  entityType: ReportEntityType;
  entityId: string;
  /** Who made it — offers "Block @username" alongside the report. */
  author?: SafetyPerson | null;
}

interface SafetyContextValue {
  /** The three-dots menu for a piece of someone's content: report it, or block its author. */
  openContentActions: (target: ContentTarget, options?: { onBlocked?: () => void }) => void;
  /** A profile's Report / Block. */
  openUserActions: (person: SafetyPerson, options?: { onBlocked?: () => void }) => void;
  openReport: (target: ReportTarget) => void;
  unblock: (userId: string) => Promise<void>;
}

const SafetyContext = createContext<SafetyContextValue | undefined>(undefined);

// Reporting and blocking, available from anywhere: one set of sheets, mounted
// once, that every "⋯" button and profile opens. Blocking asks first (the
// app's own ConfirmDialog), then the person disappears on this device
// straight away — the shared block store hides their things from feeds
// already on screen, and the caches that could still hold them are dropped —
// while the server hides them everywhere from the next request.
export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { refreshConversations } = useChat();
  const { showToast } = useToast();

  const [actions, setActions] = useState<{ title: string; items: SheetAction[] } | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirming, setConfirming] = useState<SafetyPerson | null>(null);
  const onBlockedRef = useRef<(() => void) | undefined>(undefined);

  // Who you've blocked, loaded at sign-in; cleared at sign-out.
  useEffect(() => {
    if (!user) {
      setBlocked([]);
      return;
    }
    getBlockedUsers()
      .then((people) => setBlocked(people.map((p) => p._id)))
      .catch(() => {});
    getOfficialIds()
      .then(setOfficialIds)
      .catch(() => {});
  }, [user?._id]);

  // Anything cached that could still show a newly blocked person goes.
  useEffect(
    () =>
      onUserBlocked((userId) => {
        clearRooms();
        clearActivityCache();
        invalidatePublicProfile(userId);
        invalidatePublicCollections(userId);
        refreshConversations();
      }),
    [refreshConversations]
  );

  const openReport = useCallback((target: ReportTarget) => {
    setReportTarget(target);
    setReportOpen(true);
  }, []);

  // One sheet at a time: the actions sheet closes before the next opens, so
  // two native modals never animate over each other.
  const afterActions = (next: () => void) => {
    setActionsOpen(false);
    setTimeout(next, 260);
  };

  const askToBlock = useCallback((person: SafetyPerson, onBlocked?: () => void) => {
    onBlockedRef.current = onBlocked;
    setConfirming(person);
  }, []);

  const openContentActions = useCallback(
    (target: ContentTarget, options?: { onBlocked?: () => void }) => {
      if (isProtectedAccount(target.author)) return;
      const items: SheetAction[] = [
        {
          key: "report",
          label: t(REPORT_ACTION_LABEL[target.entityType]),
          icon: "flag-outline",
          onPress: () => afterActions(() => openReport({ entityType: target.entityType, entityId: target.entityId })),
        },
      ];
      if (target.author && target.author._id !== user?._id) {
        const author = target.author;
        items.push({
          key: "block",
          label: t("Block @{{username}}", { username: author.username }),
          icon: "ban-outline",
          destructive: true,
          onPress: () => afterActions(() => askToBlock(author, options?.onBlocked)),
        });
      }
      setActions({ title: t("Options"), items });
      setActionsOpen(true);
    },
    [t, user?._id, openReport, askToBlock]
  );

  const openUserActions = useCallback(
    (person: SafetyPerson, options?: { onBlocked?: () => void }) => {
      if (isProtectedAccount(person)) return;
      setActions({
        title: `@${person.username}`,
        items: [
          {
            key: "report",
            label: t("Report user"),
            icon: "flag-outline",
            onPress: () => afterActions(() => openReport({ entityType: "User", entityId: person._id })),
          },
          {
            key: "block",
            label: t("Block user"),
            icon: "ban-outline",
            destructive: true,
            onPress: () => afterActions(() => askToBlock(person, options?.onBlocked)),
          },
        ],
      });
      setActionsOpen(true);
    },
    [t, openReport, askToBlock]
  );

  const confirmBlock = useCallback(async () => {
    const person = confirming;
    setConfirming(null);
    if (!person) return;
    try {
      await blockUser(person._id);
      markBlocked(person._id);
      showToast(t("You blocked @{{username}}", { username: person.username }), "success");
      onBlockedRef.current?.();
    } catch (e: any) {
      showToast(e?.response?.data?.message || t("Something went wrong. Please try again."));
    } finally {
      onBlockedRef.current = undefined;
    }
  }, [confirming, showToast, t]);

  const unblock = useCallback(
    async (userId: string) => {
      await unblockUser(userId);
      markUnblocked(userId);
    },
    []
  );

  const value = useMemo<SafetyContextValue>(
    () => ({ openContentActions, openUserActions, openReport, unblock }),
    [openContentActions, openUserActions, openReport, unblock]
  );

  return (
    <SafetyContext.Provider value={value}>
      {children}
      <ActionSheet
        visible={actionsOpen}
        title={actions?.title ?? ""}
        actions={actions?.items ?? []}
        onClose={() => setActionsOpen(false)}
      />
      <ReportSheet visible={reportOpen} target={reportTarget} onClose={() => setReportOpen(false)} />
      <ConfirmDialog
        visible={confirming !== null}
        icon="ban-outline"
        title={t("Block @{{username}}?", { username: confirming?.username ?? "" })}
        message={t("You won't see each other's profiles, posts, reviews, lists or messages anywhere in Cinephix, and any follows between you will end. They won't be told.")}
        confirmLabel={t("Block")}
        cancelLabel={t("Cancel")}
        danger
        emphasis="solid"
        onConfirm={confirmBlock}
        onCancel={() => setConfirming(null)}
      />
    </SafetyContext.Provider>
  );
}

export function useSafety() {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error("useSafety must be used within a SafetyProvider");
  return ctx;
}
