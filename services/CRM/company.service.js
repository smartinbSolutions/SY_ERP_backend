const mongoose = require("mongoose");

const companyModel = require("../../models/CRM/companyModel");
const { COMPANY_STATUSES } = require("../../models/CRM/companyModel");
const contactModel = require("../../models/CRM/contactModel");
const dealModel = require("../../models/CRM/dealModel");
const leadModel = require("../../models/CRM/leadModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const lookupModel = require("../../models/CRM/Lookup"); // adjust path
const countryModel = require("../../models/Shared/country.model"); // adjust path
const ApiError = require("../../utils/apiError");
const { generateCrmNumber } = require("../../utils/crmhelpers");
const { assertCustomerFree } = require("./helpers/crmCustomerLink");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "classificationId", select: "name nameAr nameTr" },
  { path: "industryIds", select: "name nameAr nameTr" },
  { path: "country", select: "name nameAr nameTr iso2 phoneCode" },
  { path: "workingCountries", select: "name nameAr nameTr iso2" },
  { path: "ownerId", select: "name email firstName lastName username" },
];

const uniqueIds = (value) => [
  ...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean)),
];

const assertObjectIds = (ids, label) => {
  if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(`Invalid ${label}`, 400);
  }
};

// Validates lookups and countries sent in the body (only fields that are present).
const validateRefs = async (companyId, body) => {
  if (body.classificationId) {
    assertObjectIds([body.classificationId], "classification");
    const ok = await lookupModel.exists({
      _id: body.classificationId,
      companyId,
      type: "classification",
      deletedAt: null,
      isActive: true,
    });
    if (!ok) throw new ApiError("Invalid classification", 400);
  }

  if ("industryIds" in body) {
    const ids = uniqueIds(body.industryIds);
    assertObjectIds(ids, "industry");
    const count = await lookupModel.countDocuments({
      _id: { $in: ids },
      companyId,
      type: "industry",
      deletedAt: null,
      isActive: true,
    });
    if (count !== ids.length) throw new ApiError("Invalid industry", 400);
    body.industryIds = ids;
  }

  if (body.country) {
    assertObjectIds([body.country], "country");
    const ok = await countryModel.exists({ _id: body.country, isActive: true });
    if (!ok) throw new ApiError("Invalid country", 400);
  }

  if ("workingCountries" in body) {
    const ids = uniqueIds(body.workingCountries);
    assertObjectIds(ids, "working country");
    const count = await countryModel.countDocuments({
      _id: { $in: ids },
      isActive: true,
    });
    if (count !== ids.length)
      throw new ApiError("Invalid working country", 400);
    body.workingCountries = ids;
  }

  if (body.status && !COMPANY_STATUSES.includes(body.status)) {
    throw new ApiError("Invalid status", 400);
  }
};

// Empty values mean "cleared".
const normalizeBody = (body) => {
  ["classificationId", "country"].forEach((key) => {
    if (key in body && !body[key]) body[key] = null;
  });

  ["email", "website"].forEach((key) => {
    if (typeof body[key] === "string") body[key] = body[key].trim();
  });
};

// ============ GET ALL ============
exports.getAllCompanies = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, ownerId, classificationId, industryId, country } =
    req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword.trim()), "i");
    query.$or = [
      { name: regex },
      { number: regex },
      { email: regex },
      { phone: regex },
    ];
  }

  const filterIds = { ownerId, classificationId, industryId, country };
  for (const [key, value] of Object.entries(filterIds)) {
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      throw new ApiError(`Invalid ${key}`, 400);
    }
  }

  if (status) query.status = status;
  if (ownerId) query.ownerId = ownerId;
  if (classificationId) query.classificationId = classificationId;
  if (industryId) query.industryIds = industryId;
  if (country) query.country = country;

  const [total, companies] = await Promise.all([
    companyModel.countDocuments(query),
    companyModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate(POPULATE)
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
    .select("fullName email phone jobTitle number crmCompanyId")
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
    .populate(POPULATE)
    .populate("tags", "name");

  if (!company) {
    throw new ApiError(`No company found with this ID: ${id}`, 404);
  }

  return company;
};

// ============ CREATE ============
exports.createCompany = async (req) => {
  const companyId = req.companyId;
  const body = { ...req.body };

  normalizeBody(body);

  const name = body.name?.trim();
  if (!name) throw new ApiError("Company name is required", 400);
  body.name = name;

  const exists = await companyModel.findOne({
    companyId,
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    deletedAt: null,
  });

  if (exists) {
    throw new ApiError("A company with this name already exists", 400);
  }

  await validateRefs(companyId, body);
  if (body.customerId) await assertCustomerFree(companyId, body.customerId);
  else delete body.customerId;

  const number = await generateCrmNumber(companyId, "company");

  const payload = {
    ...body,
    companyId,
    // Default the manager to the creator when none is chosen.
    ownerId: body.ownerId || req.user._id,
    status: body.status || "prospect",
    deletedAt: null,
    number,
  };

  return companyModel.create(payload);
};

// ============ UPDATE ============
exports.updateCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.number;

  normalizeBody(updateData);

  if ("name" in updateData) {
    const name = updateData.name?.trim();
    if (!name) throw new ApiError("Company name is required", 400);
    updateData.name = name;

    const exists = await companyModel.findOne({
      companyId,
      name: new RegExp(`^${escapeRegex(name)}$`, "i"),
      _id: { $ne: id },
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A company with this name already exists", 400);
    }
  }

  if ("ownerId" in updateData && !updateData.ownerId) {
    throw new ApiError("Owner is required", 400);
  }

  await validateRefs(companyId, updateData);

  if ("customerId" in updateData) {
    if (updateData.customerId) {
      await assertCustomerFree(companyId, updateData.customerId, {
        excludeCompanyId: id,
      });
    } else {
      updateData.customerId = null;
    }
  }

  const company = await companyModel
    .findOneAndUpdate({ _id: id, companyId, deletedAt: null }, updateData, {
      new: true,
      runValidators: true,
    })
    .populate(POPULATE);

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
