// scripts/migrate-tags.js
// One-off, safe to re-run:
//   1. rebuilds ancestors + depth on every tag from parentId
//   2. drops the old unique indexes (if they still exist)
//   3. builds the new indexes from the schema
const dotenv = require("dotenv");
dotenv.config({ path: "config.env" });

const dbContacion = require("../config/database");
const Tag = require("../models/Settings/Definition/tag.model");
const { MAX_TAG_DEPTH } = require("../shared/modules");

const OLD_INDEXES = ["companyId_1_name_1", "companyId_1_slug_1"];

const rebuildPaths = async () => {
  // roots: empty path, depth 0
  await Tag.updateMany(
    { parentId: null },
    { $set: { ancestors: [], depth: 0 } },
  );

  // walk down level by level
  let frontier = await Tag.find({ parentId: null })
    .select("_id ancestors")
    .lean();

  let level = 0;
  while (frontier.length && level < 20) {
    const next = [];

    for (const parent of frontier) {
      const ancestors = [...(parent.ancestors || []), parent._id];

      await Tag.updateMany(
        { parentId: parent._id },
        { $set: { ancestors, depth: ancestors.length } },
      );

      const children = await Tag.find({ parentId: parent._id })
        .select("_id")
        .lean();
      for (const c of children) next.push({ _id: c._id, ancestors });
    }

    frontier = next;
    level++;
  }
  console.log(`paths rebuilt, ${level} level(s) processed`);

  const tooDeep = await Tag.countDocuments({ depth: { $gte: MAX_TAG_DEPTH } });
  if (tooDeep) {
    console.warn(`warning: ${tooDeep} tag(s) at depth >= ${MAX_TAG_DEPTH}`);
  }
};

const swapIndexes = async () => {
  const existing = (await Tag.collection.indexes()).map((i) => i.name);
  console.log("indexes before:", existing);

  for (const name of OLD_INDEXES) {
    if (existing.includes(name)) {
      await Tag.collection.dropIndex(name);
      console.log(`dropped ${name}`);
    }
  }

  await Tag.syncIndexes();

  const after = (await Tag.collection.indexes()).map((i) => i.name);
  console.log("indexes after:", after);
};

(async () => {
  try {
    await dbContacion();
    await rebuildPaths();
    await swapIndexes();
    console.log("migration done");
    process.exit(0);
  } catch (err) {
    console.error("migration failed:", err.message);
    process.exit(1);
  }
})();
