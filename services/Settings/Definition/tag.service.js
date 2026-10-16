const { default: slugify } = require("slugify");
const mongoose = require("mongoose");
const tagModel = require("../../../models/Settings/Definition/tag.model");
const ApiError = require("../../../utils/apiError");
const { MODULES, MAX_TAG_DEPTH } = require("../../../shared/modules");
const companyPlanModel = require("../../../models/Settings/CompanyInfo/companyPlan.model");

// Each taggable document type is bound to one module + scope.
const TAGGABLE = {
  purchaseInvoice: {
    model: require("../../../models/Accounting/Purchase/purchaseinvoicesModel"),
    module: "accounting",
    scope: "purchase",
  },
  purchaseRequest: {
    model: require("../../../models/Accounting/Purchase/purchaseRequestModel"),
    module: "accounting",
    scope: "purchase",
  },
  refundPurchaseInvoice: {
    model: require("../../../models/Accounting/Purchase/refundPurchaseInviceModel"),
    module: "accounting",
    scope: "purchase",
  },
  order: {
    model: require("../../../models/Accounting/Sales/orderModel"),
    module: "accounting",
    scope: "sales",
  },
  quotation: {
    model: require("../../../models/Accounting/Sales/quotations.model"),
    module: "accounting",
    scope: "sales",
  },
  refundSales: {
    model: require("../../../models/Accounting/Sales/refund_sales.model"),
    module: "accounting",
    scope: "sales",
  },
  expense: {
    model: require("../../../models/Accounting/Expenses/expensesModel"),
    module: "accounting",
    scope: "expenses",
  },
};

// module and scope are immutable after creation.
const UPDATABLE = [
  "name",
  "nameAr",
  "nameTr",
  "description",
  "color",
  "parentId",
  "order",
  "sync",
];

const assertScope = (module, scope) => {
  if (!MODULES[module]?.scopes.includes(scope)) {
    throw new ApiError("Invalid module or scope", 400);
  }
};

// slugify drops Arabic letters, so fall back to the plain name.
const makeSlug = (name) =>
  slugify(name, { lower: true }) || name.trim().toLowerCase();

const toSnapshot = (t) => ({
  id: String(t._id),
  name: t.name,
  nameAr: t.nameAr || null,
  nameTr: t.nameTr || null,
  color: t.color || "",
});

const rethrowDuplicate = (err) => {
  if (err?.code === 11000) {
    throw new ApiError("A tag with this name already exists here", 409);
  }
  throw err;
};

// Keep document snapshots in sync after rename / color / translation change.
const syncTagSnapshot = async ({ companyId, tag, session }) => {
  const id = String(tag._id);
  for (const { model } of Object.values(TAGGABLE)) {
    await model.updateMany(
      { companyId, "tag.id": id },
      {
        $set: {
          "tag.$[t].name": tag.name,
          "tag.$[t].nameAr": tag.nameAr || null,
          "tag.$[t].nameTr": tag.nameTr || null,
          "tag.$[t].color": tag.color || "",
        },
      },
      { arrayFilters: [{ "t.id": id }], session },
    );
  }
};

// After a move, fix ancestors/depth of every descendant.
const rebuildSubtree = async ({ tag, session }) => {
  const descendants = await tagModel
    .find({ companyId: tag.companyId, ancestors: tag._id })
    .select("ancestors")
    .session(session)
    .lean();
  if (!descendants.length) return;

  const ops = descendants.map((d) => {
    const i = d.ancestors.findIndex((a) => String(a) === String(tag._id));
    const ancestors = [...tag.ancestors, tag._id, ...d.ancestors.slice(i + 1)];
    if (ancestors.length >= MAX_TAG_DEPTH) {
      throw new ApiError("Tag tree too deep", 400);
    }
    return {
      updateOne: {
        filter: { _id: d._id },
        update: { $set: { ancestors, depth: ancestors.length } },
      },
    };
  });
  await tagModel.bulkWrite(ops, { session });
};

exports.getRegistry = async ({ companyId }) => {
  const plan = await companyPlanModel
    .findOne({ companyId, isActive: true })
    .lean();
  const features = plan?.features || {};

  const data = Object.entries(MODULES)
    .filter(([key]) => features[key])
    .map(([key, m]) => ({ module: key, scopes: m.scopes }));

  return { data };
};

exports.getTags = async ({ companyId, module, scope }) => {
  assertScope(module, scope);
  const data = await tagModel
    .find({ companyId, module, scope })
    .sort({ order: 1, createdAt: -1 })
    .lean();
  return { data, results: data.length };
};

exports.getTag = async ({ companyId, id }) => {
  const tag = await tagModel.findOne({ companyId, _id: id }).lean();
  if (!tag) throw new ApiError("Tag not found", 404);
  return { data: tag };
};

// For filtering documents: the tag itself + everything under it.
// Use: { "tag.id": { $in: ids } }
exports.getTagWithDescendantIds = async ({ companyId, id }) => {
  const descendants = await tagModel
    .find({ companyId, ancestors: id })
    .select("_id")
    .lean();
  return [String(id), ...descendants.map((d) => String(d._id))];
};

exports.createTag = async ({ companyId, data, session }) => {
  assertScope(data.module, data.scope);
  const { ancestors, depth, ...safe } = data; // client can't set these
  safe.companyId = companyId;
  safe.slug = makeSlug(safe.name);
  try {
    const tag = await tagModel.create([safe], { session });
    return { data: tag[0] };
  } catch (err) {
    rethrowDuplicate(err);
  }
};

// findOne + save so the pre-save hook (parent check, ancestors, depth) runs.
exports.updateTag = async ({ companyId, id, data, session }) => {
  const tag = await tagModel.findOne({ companyId, _id: id }).session(session);
  if (!tag) throw new ApiError("Tag not found", 404);

  const moved =
    data.parentId !== undefined &&
    String(data.parentId || "") !== String(tag.parentId || "");

  for (const k of UPDATABLE) {
    if (data[k] !== undefined) tag[k] = data[k];
  }
  if (data.name) tag.slug = makeSlug(data.name);

  try {
    await tag.save({ session });
  } catch (err) {
    rethrowDuplicate(err);
  }

  if (moved) await rebuildSubtree({ tag, session });

  if (
    data.name !== undefined ||
    data.nameAr !== undefined ||
    data.nameTr !== undefined ||
    data.color !== undefined
  ) {
    await syncTagSnapshot({ companyId, tag, session });
  }

  return { data: tag.toObject() };
};

exports.deleteTag = async ({ companyId, id, session }) => {
  const tag = await tagModel.findOne({ companyId, _id: id }).session(session);
  if (!tag) throw new ApiError("Tag not found", 404);

  const hasChildren = await tagModel
    .exists({ companyId, parentId: id })
    .session(session);
  if (hasChildren) throw new ApiError("Delete the child tags first", 409);

  for (const { model } of Object.values(TAGGABLE)) {
    const used = await model
      .exists({ companyId, "tag.id": String(id) })
      .session(session);
    if (used) throw new ApiError("Tag is used on documents", 409);
  }

  await tag.deleteOne({ session });
  return tag;
};

exports.setDocTags = async ({
  companyId,
  refType,
  docId,
  tagIds = [],
  session,
}) => {
  const cfg = TAGGABLE[refType];
  if (!cfg) throw new ApiError(`Unsupported refType: ${refType}`, 400);

  const ids = [...new Set((tagIds || []).map(String))].filter(
    mongoose.isValidObjectId,
  );

  let tag = [];
  if (ids.length) {
    const tags = await tagModel
      .find({
        companyId,
        module: cfg.module,
        scope: cfg.scope,
        _id: { $in: ids },
      })
      .select("name nameAr nameTr color")
      .session(session)
      .lean();

    if (tags.length !== ids.length) {
      throw new ApiError("Some tags don't belong to this document type", 400);
    }
    const byId = new Map(tags.map((t) => [String(t._id), t]));
    tag = ids.map((id) => toSnapshot(byId.get(id)));
  }

  const doc = await cfg.model
    .findOneAndUpdate(
      { companyId, _id: docId },
      { $set: { tag } },
      { new: true, session, projection: { tag: 1 } },
    )
    .lean();

  if (!doc) throw new ApiError("Document not found", 404);
  return { data: doc.tag };
};
