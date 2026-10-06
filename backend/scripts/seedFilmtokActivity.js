// One-off, run-once-manually seed for the "Filmtok" test community
// (slug: cine-test-club) — fills it with members, a real 30-title
// challenge with varied per-member progress (which also doubles as this
// week's leaderboard activity, since getGroupLeaderboard counts the same
// Rating docs), and a 3rd community list so the Featured Lists "See all"
// page has something not currently featured to test against. Direct ask,
// after the community sat almost empty through this session's testing.
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const SLUG = "cine-test-club";
const NEW_MEMBER_COUNT = 16;
const CHALLENGE_SIZE = 30;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pickRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(randomInt(0, copy.length - 1), 1)[0]);
  }
  return out;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection;
  const Groups = db.collection("groups");
  const Users = db.collection("users");
  const Movies = db.collection("movies");
  const Series = db.collection("series");
  const GroupChallenges = db.collection("groupchallenges");
  const CustomLists = db.collection("customlists");
  const Ratings = db.collection("ratings");

  const group = await Groups.findOne({ slug: SLUG });
  if (!group) throw new Error(`Group ${SLUG} not found`);
  console.log("Group:", group.name, group._id.toString());

  const existingMemberIds = new Set(group.members.map((m) => m.user.toString()));

  // ---- 1. Members ---------------------------------------------------------
  const candidates = await Users.find({ _id: { $nin: [...existingMemberIds].map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ _id: 1 })
    .limit(500)
    .toArray();
  const newMembers = pickRandom(candidates, NEW_MEMBER_COUNT);
  const now = Date.now();
  const newMemberDocs = newMembers.map((u, i) => ({
    user: u._id,
    joinedAt: new Date(now - randomInt(1, 50) * 24 * 60 * 60 * 1000),
    // First 10 read as founding members, the rest don't — direct test
    // coverage for both badge states in Members (isFoundingMember vs the
    // community's own Admin badge).
    isFoundingMember: i < 10,
  }));

  await Groups.updateOne(
    { _id: group._id },
    { $push: { members: { $each: newMemberDocs } }, $inc: { memberCount: newMemberDocs.length } }
  );
  const allMemberIds = [...existingMemberIds, ...newMembers.map((u) => u._id.toString())];
  console.log(`Added ${newMemberDocs.length} members, total now ${allMemberIds.length}`);

  // ---- 2. A real 30-item challenge ----------------------------------------
  const movieDocs = await Movies.find({ poster_path: { $ne: null } }).project({ title: 1, name: 1, poster_path: 1 }).limit(200).toArray();
  const seriesDocs = await Series.find({ poster_path: { $ne: null } }).project({ title: 1, name: 1, poster_path: 1 }).limit(200).toArray();
  const pickedMovies = pickRandom(movieDocs, 20).map((m) => ({ itemId: m._id, itemType: "movie", title: m.title || m.name, posterUrl: m.poster_path }));
  const pickedSeries = pickRandom(seriesDocs, CHALLENGE_SIZE - 20).map((s) => ({ itemId: s._id, itemType: "series", title: s.title || s.name, posterUrl: s.poster_path }));
  const challengeItems = [...pickedMovies, ...pickedSeries];

  const challenge = {
    group: group._id,
    createdBy: group.owner,
    title: "Ekim Ayı 30'luk Maraton",
    items: challengeItems,
    deadline: new Date(now + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const { insertedId: challengeId } = await GroupChallenges.insertOne(challenge);
  await Groups.updateOne({ _id: group._id }, { $set: { activeChallengeId: challengeId } });
  console.log("New challenge:", challenge.title, challengeId.toString(), `(${challengeItems.length} items)`);

  // ---- 3. Varied per-member progress (= this week's leaderboard too) -----
  // A deliberate spread: a couple finish, most are partway, a couple
  // haven't started — so Member Progress and the weekly Leaderboard both
  // show something realistic instead of a flat wall of identical rows.
  const progressPlan = allMemberIds.map((_, i) => {
    if (i < 2) return CHALLENGE_SIZE; // finished
    if (i < 8) return randomInt(15, 25); // well underway
    if (i < 14) return randomInt(3, 12); // just started
    return 0; // haven't rated anything yet
  });

  const ratingOps = [];
  allMemberIds.forEach((userId, i) => {
    const n = progressPlan[i];
    const chosen = pickRandom(challengeItems, n);
    for (const item of chosen) {
      ratingOps.push({
        updateOne: {
          filter: { user: new mongoose.Types.ObjectId(userId), contentId: item.itemId.toString() },
          update: {
            $setOnInsert: {
              user: new mongoose.Types.ObjectId(userId),
              contentId: item.itemId.toString(),
              contentType: item.itemType,
              value: randomInt(5, 10),
              createdAt: new Date(now - randomInt(0, 3) * 24 * 60 * 60 * 1000),
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }
  });
  if (ratingOps.length) {
    const result = await Ratings.bulkWrite(ratingOps, { ordered: false });
    console.log(`Ratings upserted: ${result.upsertedCount} (of ${ratingOps.length} attempted)`);
  }

  // ---- 4. A 3rd community list, left unfeatured on purpose ---------------
  const extraItems = pickRandom([...movieDocs, ...seriesDocs], 6).map((d, i) => ({
    itemId: d._id,
    itemType: movieDocs.includes(d) ? "movie" : "series",
    addedAt: new Date(),
  }));
  const extraList = {
    owner: group.owner,
    groupId: group._id,
    name: "En İyi Komedi Filmleri",
    description: "Topluluk üyelerinin önerdiği en iyi komediler.",
    isPublic: true,
    items: extraItems,
    likes: [],
    views: 0,
    order: 0,
    allowMemberAdd: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const { insertedId: extraListId } = await CustomLists.insertOne(extraList);
  console.log("New (unfeatured) community list:", extraList.name, extraListId.toString());

  // Feature the two lists already created earlier this session — direct,
  // since they predate the auto-feature-on-create logic and currently
  // show isFeatured:false despite having real items.
  const existingCommunityLists = await CustomLists.find({ groupId: group._id, _id: { $ne: extraListId } }).project({ _id: 1 }).limit(2).toArray();
  const pinnedListIds = existingCommunityLists.map((l) => l._id);
  await Groups.updateOne({ _id: group._id }, { $set: { pinnedListIds } });
  console.log("Featured lists set to:", pinnedListIds.map((id) => id.toString()));

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
