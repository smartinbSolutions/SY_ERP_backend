const { default: slugify } = require("slugify");
const tagModel = require("../../../models/Settings/Definition/tag.model");
const ApiError = require("../../../utils/apiError");
const mongoose = require("mongoose");

const TAGGABLE = {
  purchaseInvoice: require("../../../models/Accounting/Purchase/purchaseinvoicesModel"),
  purchaseRequest: require("../../../models/Accounting/Purchase/purchaseRequestModel"),
  refundPurchaseInvoice: require("../../../models/Accounting/Purchase/refundPurchaseInviceModel"),
  order: require("../../../models/Accounting/Sales/orderModel"),
  quotation: require("../../../models/Accounting/Sales/quotations.model"),
  refundSales: require("../../../models/Accounting/Sales/refund_sales.model"),
  expense: require("../../../models/Accounting/Expenses/expensesModel"),
};

const syncTagSnapshot = async ({ companyId, tag, session }) => {
  const id = String(tag._id);
  for (const Model of Object.values(TAGGABLE)) {
    await Model.updateMany(
      { companyId, "tag.id": id },
      {
        $set: {
          "tag.$[t].name": tag.name,
          "tag.$[t].color": tag.color || "",
        },
      },
      { arrayFilters: [{ "t.id": id }], session },
    );
  }
};

exports.getTags = async ({ companyId }) => {
  const query = { companyId };
  const data = await tagModel.find(query).sort({ createdAt: -1 }).lean();

  return {
    data: data,
    results: data.length,
  };
};

exports.getTag = async ({ companyId, id }) => {
  const tag = await tagModel.findOne({ companyId, _id: id }).lean();
  if (!tag) {
    throw new ApiError("Tag not found", 404);
  }
  return { data: tag };
};

exports.createTag = async ({ companyId, data, session }) => {
  data.companyId = companyId;
  data.slug = slugify(data.name);
  const tag = await tagModel.create([data], { session });
  return { data: tag[0] };
};

exports.updateTag = async ({ companyId, id, data, session }) => {
  if (data.name) data.slug = slugify(data.name);

  const tag = await tagModel
    .findOneAndUpdate({ companyId, _id: id }, data, {
      new: true,
      session,
      runValidators: true,
    })
    .lean();
  if (!tag) {
    throw new ApiError("Tag not found", 404);
  }

  if (data.name !== undefined || data.color !== undefined) {
    await syncTagSnapshot({ companyId, tag, session });
  }

  return { data: tag };
};

exports.deleteTag = async ({ companyId, id, session }) => {
  const tag = await tagModel.findOne({ companyId, _id: id }).session(session);

  if (!tag) {
    const err = new Error("Tag not found");
    err.statusCode = 404;
    throw err;
  }
  const haveParent = await tagModel
    .findOne({ companyId, parentId: id })
    .session(session);
  if (haveParent) {
    const err = new Error("this is have used");
    err.statusCode = 404;
    throw err;
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
  const Model = TAGGABLE[refType];
  if (!Model) {
    throw new ApiError(`Unsupported refType: ${refType}`, 400);
  }

  const ids = [...new Set((tagIds || []).map(String))].filter(
    mongoose.isValidObjectId,
  );

  let tag = [];
  if (ids.length) {
    const tags = await tagModel
      .find({ companyId, _id: { $in: ids } })
      .select("name color")
      .session(session)
      .lean();
    const byId = new Map(tags.map((t) => [String(t._id), t]));
    tag = ids
      .filter((id) => byId.has(id))
      .map((id) => ({
        id,
        name: byId.get(id).name,
        color: byId.get(id).color || "",
      }));
  }

  const doc = await Model.findOneAndUpdate(
    { companyId, _id: docId },
    { $set: { tag } },
    { new: true, session, projection: { tag: 1 } },
  ).lean();

  if (!doc) {
    throw new ApiError("Document not found", 404);
  }
  return { data: doc.tag };
};
