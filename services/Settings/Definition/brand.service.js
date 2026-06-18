const productModel = require("../../../models/Stocks/products/productModel");
const brandModel = require("../../../models/Settings/Definition/brand.model");
const ApiError = require("../../../utils/apiError");
// const productModel = require("../../../models/Stocks/Products/product.model");

exports.getBrands = async ({
  companyId,
  page = 1,
  limit = 10,
  keyword = "",
}) => {
  const pageSize = parseInt(limit) || 10;
  const currentPage = parseInt(page) || 1;
  const skip = (currentPage - 1) * pageSize;

  const query = {
    companyId,
  };

  // 🔎 Search
  if (keyword && keyword.trim()) {
    query.$or = [
      { name: { $regex: keyword.trim(), $options: "i" } },
      { nameAR: { $regex: keyword.trim(), $options: "i" } },
      { nameTR: { $regex: keyword.trim(), $options: "i" } },
    ];
  }

  const [data, totalItems] = await Promise.all([
    brandModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    brandModel.countDocuments(query),
  ]);

  return {
    data,
    results: totalItems,
    pages: Math.ceil(totalItems / pageSize),
  };
};

exports.getBrand = async ({ companyId, id }) => {
  const brand = await brandModel.findOne({ companyId, _id: id }).lean();
  if (!brand) {
    throw new ApiError("Brand not found", 404);
  }
  return { data: brand };
};

exports.createBrand = async ({ companyId, data, session }) => {
  data.companyId = companyId;
  const brand = await brandModel.create([data], { session });
  return { data: brand[0] };
};

exports.updateBrand = async ({ companyId, id, data, session }) => {
  const brand = await brandModel
    .findOneAndUpdate({ companyId, _id: id }, data, { new: true, session })
    .lean();
  if (!brand) {
    throw new ApiError("Brand not found", 404);
  }
  return { data: brand };
};

exports.deleteBrand = async ({ companyId, id, session }) => {
  const brand = await brandModel
    .findOne({ companyId, _id: id })
    .session(session);
  if (!brand) {
    throw new ApiError("Brand not found", 404);
  }
  const brandUsed = await productModel
    .exists({
      companyId,
      $or: [{ brand: id }],
    })
    .session(session);
  if (brandUsed) {
    throw new ApiError("Brand is used in products", 400);
  }
  await brand.deleteOne({ session });
  return { data: brand };
};
