const companyModel = require("../../models/CRM/companyModel");
const ApiError = require("../../utils/apiError");

// ============ GET ALL ============
exports.getAllCompanies = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, industry, isActive, ownerId } = req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.$or = [
      { name: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
      { phone: { $regex: keyword, $options: "i" } },
    ];
  }
  if (industry) query.industry = industry;
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (ownerId) query.ownerId = ownerId;

  const [total, companies] = await Promise.all([
    companyModel.countDocuments(query),
    companyModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: companies.length,
    total,
    data: companies,
  };
};

// ============ GET ONE ============
exports.getOneCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const company = await companyModel
    .findOne({ _id: id, companyId, deletedAt: null })

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return company;
};

// ============ CREATE ============
exports.createCompany = async (req) => {
  const companyId = req.companyId;

  const exists = await companyModel.findOne({
    companyId,
    name: req.body.name,
    deletedAt: null,
  });

  if (exists) {
    throw new ApiError("A company with this name already exists", 400);
  }

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const company = await companyModel.create(payload);

  return company;
};

// ============ UPDATE ============
exports.updateCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (req.body.name) {
    const exists = await companyModel.findOne({
      companyId,
      name: req.body.name,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A company with this name already exists", 400);
    }
  }

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const company = await companyModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return company;
};

// ============ DELETE (Soft) ============
exports.deleteCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const company = await companyModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return "Company deleted successfully";
};
