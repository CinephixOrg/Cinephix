import Group from "../models/Group.js";
import GroupAnnouncement from "../models/GroupAnnouncement.js";
import { computeGroupLeaderboard, startOfCurrentWeekUTC } from "../controllers/groupController.js";

// Once a week, every community that opted into "leaderboard" announcements
// gets a GroupAnnouncement snapshotting last week's top 3 — a result post,
// not a live link (whoever was on top when the week ended stays there even
// if scores would later look different). Scheduled from server.js right as
// the new week starts (Monday morning), so "last week" below is the one
// that just ended, not the one in progress.
export async function postWeeklyLeaderboardAnnouncements() {
  const groups = await Group.find({
    "feedAnnouncements.enabled": true,
    "feedAnnouncements.categories": "leaderboard",
  })
    .select("members activeChallengeId")
    .lean();
  if (groups.length === 0) return;

  const thisWeekStart = startOfCurrentWeekUTC();
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  for (const group of groups) {
    const leaderboard = await computeGroupLeaderboard(group, lastWeekStart, thisWeekStart);
    if (leaderboard.length === 0) continue; // no activity last week — nothing to announce

    const top3 = leaderboard.slice(0, 3).filter((e) => e.user);
    if (top3.length === 0) continue;

    await GroupAnnouncement.create({
      group: group._id,
      createdBy: null,
      category: "leaderboard",
      leaderboardTop: top3.map((e) => ({
        user: e.user._id,
        username: e.user.username,
        profilePicUrl: e.user.profile_pic_url,
        score: e.score,
      })),
    });
  }
}
