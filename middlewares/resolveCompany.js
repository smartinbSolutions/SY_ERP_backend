const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiError");
const CompanyInfoModel = require("../models/Settings/CompanyInfo/companyInfo.model");

exports.resolveCompanyFromSlug = asyncHandler(async (req, res, next) => {
  let companySlug = null;

  // 1. من Query Parameter: ?companySlug=smartinb-com
  if (req.query.companySlug) {
    companySlug = req.query.companySlug;
  }

  // 2. من Header: x-company-slug
  if (!companySlug && req.headers["x-company-slug"]) {
    companySlug = req.headers["x-company-slug"];
  }

  // 3. من Params: /:companySlug
  if (!companySlug && req.params.companySlug) {
    companySlug = req.params.companySlug;
  }

  if (!companySlug) {
    return next(new ApiError("Company slug is required", 400));
  }

  // البحث عن الشركة
  const company = await CompanyInfoModel.findOne({
    slug: companySlug.toLowerCase(),
  });

  if (!company) {
    return next(new ApiError("Store not found", 404));
  }

  // إضافة companyId إلى req
  req.companyId = company._id.toString();
  req.companySlug = company.slug;

  next();
});
