const tagModel = require("../../../models/Settings/Definition/tag.model");
const ApiError = require("../../../utils/apiError");

exports.getTags = async ({ companyId }) => {
  const query = { companyId };
  const data = await tagModel.find(query).sort({ createdAt: -1 }).lean();

  return {
    data,
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
  const tag = await tagModel.create([data], { session });
  return { data: tag[0] };
};

exports.updateTag = async ({ companyId, id, data, session }) => {
  const tag = await tagModel
    .findOneAndUpdate({ companyId, _id: id }, data, { new: true, session })
    .lean();
  if (!tag) {
    throw new ApiError("Tag not found", 404);
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

  await tag.deleteOne({ session });

  return tag;
};
