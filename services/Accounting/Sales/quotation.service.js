const quotationsModel = require("../../../models/Accounting/Sales/quotations.model");
const counterModel = require("../../../models/Settings/counterModel");
const ApiError = require("../../../utils/apiError");

exports.getAllQuotationsService = async ({ companyId, req }) => {
  const filters = req.query?.filters ? JSON.parse(req.query.filters) : {};

  const pageSize = parseInt(req.query.limit) || 0;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };

  if (filters?.startDate || filters?.endDate) {
    query.startDate = {};
    if (filters.startDate) query.startDate.$gte = filters.startDate;
    if (filters.endDate) query.startDate.$lte = filters.endDate;
  }

  if (filters.paymentStatus) {
    query.status = filters.paymentStatus;
  }

  if (filters.employee) {
    query.createdBy = filters.employee;
  }

  if (filters?.tags?.length) {
    const tagIds = filters.tags.map((tag) => tag.id);
    query["tag.id"] = { $in: tagIds };
  }

  if (filters?.businessPartners) {
    query["customer.name"] = {
      $regex: filters.businessPartners,
      $options: "i",
    };
  }

  if (filters?.filterTags?.length) {
    query["tag.name"] = { $in: filters.filterTags };
  }

  if (req.query.keyword) {
    query.$or = [
      { counter: { $regex: req.query.keyword, $options: "i" } },
      { invoiceName: { $regex: req.query.keyword, $options: "i" } },
      { "customer.name": { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  const mongooseQuery = quotationsModel
    .find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(pageSize)
    .populate("createdBy")
    .lean();

  const [quotations, totalItems] = await Promise.all([
    mongooseQuery,
    quotationsModel.countDocuments(query),
  ]);

  const totalPages = Math.ceil(totalItems / pageSize);

  return { totalPages, quotations, totalItems };
};

exports.getOneQuotationService = async ({ id, companyId }) => {
  const quotation = await quotationsModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate("createdBy");

  console.log(quotation);

  if (!quotation) {
    throw new ApiError("Quotation not found", 404);
  }

  return quotation;
};

exports.updateQuotationService = async ({ id, companyId, req, session }) => {
  const quotation = await quotationsModel.findByIdAndUpdate(
    { _id: id, companyId },
    req.body,
    {
      new: true,
      session,
    },
  );

  if (!quotation) {
    return next(new ApiError(`not Update this id ${id}`, 500));
  }
  return quotation;
};

exports.createQuotationService = async ({ session, companyId, req }) => {
  req.body.createdBy = req.user._id;

  const nextCounter = await counterModel.findOneAndUpdate(
    { companyId, name: "Quotation" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );
  req.body.counter = Number(req.body.counter) + nextCounter.seq;
  req.body.companyId = companyId;
  const quotation = await quotationsModel.create([req.body], { session });

  if (!quotation) {
    return next(new ApiError("The cart is empty", 400));
  }

  return quotation[0];
};
