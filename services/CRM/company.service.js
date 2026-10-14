const companyModel = require("../../models/CRM/companyModel");
const contactModel = require("../../models/CRM/contactModel");
const dealModel = require("../../models/CRM/dealModel");
const leadModel = require("../../models/CRM/leadModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const ApiError = require("../../utils/apiError");
const { generateCrmNumber } = require("../../utils/crmhelpers");

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

  const [total, companies] = await Promise.all([
    companyModel.countDocuments(query),
    companyModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  // ----------------------------------------------------
  // Primary contact for each company (one query)
  // ----------------------------------------------------
  const primaryContacts = await contactModel
    .find({
      companyId,
      crmCompanyId: { $in: companies.map((c) => c._id) },
      isPrimary: true,
      deletedAt: null,
    })
    .select("firstName lastName email phone jobTitle number crmCompanyId")
    .lean();

  const primaryByCompany = new Map(
    primaryContacts.map((c) => [String(c.crmCompanyId), c]),
  );

  const data = companies.map((c) => ({
    ...c,
    primaryContact: primaryByCompany.get(String(c._id)) || null,
  }));

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: companies.length,
    total,
    data,
  };
};

// ============ GET ONE ============
exports.getOneCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const company = await companyModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("tags", "name");
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

  const number = await generateCrmNumber(companyId, "company");
  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
    number,
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

  const company = await companyModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  // Check related Contacts
  const contactExists = await contactModel.exists({
    crmCompanyId: id,
    companyId,
    deletedAt: null,
  });

  // Check related Opportunities
  const opportunityExists = await opportunityModel.exists({
    crmCompanyId: id,
    companyId,
    deletedAt: null,
  });

  // Check related Deals
  const dealExists = await dealModel.exists({
    crmCompanyId: id,
    companyId,
    deletedAt: null,
  });

  // Check converted Leads
  const leadExists = await leadModel.exists({
    "convertedTo.crmCompanyId": id,
    companyId,
    deletedAt: null,
  });

  if (contactExists || opportunityExists || dealExists || leadExists) {
    throw new ApiError(
      "Cannot delete this company because it is related to other entities",
      400,
    );
  }

  // Soft delete
  company.deletedAt = new Date();
  await company.save();

  return "Company deleted successfully";
};
