const taxModel = require("../../../models/Settings/Definition/tax.model");
const ApiError = require("../../../utils/apiError");
// const productModel = require("../../../models/Stocks/Products/product.model");
const productModel = require("../../../models/productModel");

exports.getTaxs = async ({ companyId }) => {
  const query = { companyId };
  const data = await taxModel
    .find(query)
    .sort({ createdAt: -1 })
    .populate("salesAccountTax")
    .populate({
      path: "salesAccountTax",
      populate: { path: "currency" },
    })
    .populate("purchaseAccountTax")
    .populate({
      path: "purchaseAccountTax",
      populate: { path: "currency" },
    })
    .lean();

  return {
    data,
    results: data.length,
  };
};

exports.getTax = async ({ companyId, id }) => {
  const tax = await taxModel
    .findOne({ companyId, _id: id })
    .populate("salesAccountTax")
    .populate({
      path: "salesAccountTax",
      populate: { path: "currency" },
    })
    .populate("purchaseAccountTax")
    .populate({
      path: "purchaseAccountTax",
      populate: { path: "currency" },
    })
    .lean();
  if (!tax) {
    throw new ApiError("tax not found", 404);
  }
  return { data: tax };
};

exports.createTax = async ({ companyId, data, session }) => {
  data.companyId = companyId;
  data.slug = data.name.toLowerCase().replace(/\s+/g, "-");
  const tax = await taxModel.create([data], { session });
  return { data: tax[0] };
};

exports.updateTax = async ({ companyId, id, data, session }) => {
  const tax = await taxModel
    .findOneAndUpdate({ companyId, _id: id }, data, { new: true, session })
    .lean();
  if (!tax) {
    throw new ApiError("Tax not found", 404);
  }
  return { data: tax };
};
exports.deleteTax = async ({ companyId, id, session }) => {
  const tax = await taxModel.findOne({ companyId, _id: id }).session(session);

  if (!tax) {
    const err = new Error("Tax not found");
    err.statusCode = 404;
    throw err;
  }

  const taxUsed = await productModel
    .exists({
      companyId,
      $or: [{ tax: id }],
    })
    .session(session);

  if (taxUsed) {
    const err = new Error("Cannot delete tax because it is linked to products");
    err.statusCode = 400;
    throw err;
  }

  await tax.deleteOne({ session });

  return tax;
};
