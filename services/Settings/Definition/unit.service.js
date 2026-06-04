const unitModel = require("../../../models/Settings/Definition/unit.model");
const ApiError = require("../../../utils/apiError");
// const productModel = require("../../../models/Stocks/Products/product.model");
const productModel = require("../../../models/productModel");

exports.getUnits = async ({ companyId }) => {
  const query = { companyId };
  const data = await unitModel.find(query).sort({ createdAt: -1 }).lean();

  return {
    data,
    results: data.length,
  };
};

exports.getUnit = async ({ companyId, id }) => {
  const unit = await unitModel.findOne({ companyId, _id: id }).lean();
  if (!unit) {
    throw new ApiError("Unit not found", 404);
  }
  return { data: unit };
};

exports.createUnit = async ({ companyId, data, session }) => {
  data.companyId = companyId;
  const unit = await unitModel.create([data], { session });
  return { data: unit[0] };
};

exports.updateUnit = async ({ companyId, id, data, session }) => {
  const unit = await unitModel
    .findOneAndUpdate({ companyId, _id: id }, data, { new: true, session })
    .lean();
  if (!unit) {
    throw new ApiError("Unit not found", 404);
  }
  return { data: unit };
};
exports.deleteUnit = async ({ companyId, id, session }) => {
  const unit = await unitModel.findOne({ companyId, _id: id }).session(session);

  if (!unit) {
    throw new ApiError(`No Unit for this id ${id}`, 404);
  }

  const unitUsed = await productModel
    .exists({
      companyId,
      $or: [{ unit: id }, { "unitsPrices.unitId": id }],
    })
    .session(session);

  if (unitUsed) {
    throw new ApiError(
      `Cannot delete unit because it is linked to product`,
      404,
    );
  }

  await unit.deleteOne({ session });

  return unit;
};
