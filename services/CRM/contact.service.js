const mongoose = require("mongoose");
const contactModel = require("../../models/CRM/contactModel");
const {
  CONTACT_TYPES,
  CONTACT_LANGUAGES,
} = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const ApiError = require("../../utils/apiError");
const opportunityModel = require("../../models/CRM/opportunityModel");
const dealModel = require("../../models/CRM/dealModel");
const {
  generateCrmNumber,
  resolveIsPrimary,
} = require("../../utils/crmhelpers");

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const POPULATE = [
  { path: "crmCompanyId", select: "name number status" },
  { path: "assignedTo", select: "name email firstName lastName username" },
];

// Validates the fields sent in the body (only the ones that are present).
const validateFields = async (companyId, body) => {
  if (body.contactType && !CONTACT_TYPES.includes(body.contactType)) {
    throw new ApiError("Invalid contact type", 400);
  }

  if (
    body.preferredLanguage &&
    !CONTACT_LANGUAGES.includes(body.preferredLanguage)
  ) {
    throw new ApiError("Invalid preferred language", 400);
  }

  if (body.crmCompanyId) {
    if (!mongoose.Types.ObjectId.isValid(body.crmCompanyId)) {
      throw new ApiError("Invalid company", 400);
    }

    const ok = await companyModel.exists({
      _id: body.crmCompanyId,
      companyId,
      deletedAt: null,
    });

    if (!ok) throw new ApiError("Company not found", 400);
  }

  if (body.assignedTo && !mongoose.Types.ObjectId.isValid(body.assignedTo)) {
    throw new ApiError("Invalid assigned user", 400);
  }
};

// ============ GET ALL ============
exports.getAllContacts = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const {
    keyword,
    status,
    crmCompanyId,
    source,
    isPrimary,
    assignedTo,
    contactType,
    preferredLanguage,
  } = req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword.trim()), "i");
    query.$or = [
      { fullName: regex },
      { number: regex },
      { email: regex },
      { phone: regex },
      { whatsApp: regex },
    ];
  }

  for (const [key, value] of Object.entries({ crmCompanyId, assignedTo })) {
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      throw new ApiError(`Invalid ${key}`, 400);
    }
  }

  if (status) query.status = status;
  if (crmCompanyId) query.crmCompanyId = crmCompanyId;
  if (assignedTo) query.assignedTo = assignedTo;
  if (contactType) query.contactType = contactType;
  if (preferredLanguage) query.preferredLanguage = preferredLanguage;
  if (source) query.source = source;
  if (isPrimary !== undefined && isPrimary !== "") {
    query.isPrimary = isPrimary === "true";
  }

  const [total, contacts] = await Promise.all([
    contactModel.countDocuments(query),
    contactModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate(POPULATE),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: contacts.length,
    total,
    data: contacts,
  };
};

// ============ GET ONE ============
exports.getOneContact = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const contact = await contactModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("tags", "name")
    .populate({
      path: "crmCompanyId",
      select: "name number website phone email address status",
    })
    .populate(POPULATE[1]);

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return contact;
};

// ============ CREATE ============
exports.createContact = async (req) => {
  const companyId = req.companyId;
  const body = { ...req.body };

  const fullName = body.fullName?.trim();
  if (!fullName) throw new ApiError("Full name is required", 400);

  // Treat an empty email as "no email".
  const email = body.email?.trim().toLowerCase() || undefined;

  if (email) {
    const exists = await contactModel.findOne({
      companyId,
      email,
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A contact with this email already exists", 400);
    }
  }

  // Empty selects mean "not chosen".
  ["contactType", "preferredLanguage"].forEach((key) => {
    if (!body[key]) delete body[key];
  });

  await validateFields(companyId, body);

  const crmCompanyId = body.crmCompanyId || null;

  const isPrimary = await resolveIsPrimary(
    companyId,
    crmCompanyId,
    body.isPrimary === true || body.isPrimary === "true",
  );

  const number = await generateCrmNumber(companyId, "contact");

  const payload = {
    ...body,
    fullName,
    companyId,
    crmCompanyId,
    // Default the assignee to the creator when none is chosen.
    assignedTo: body.assignedTo || req.user._id,
    isPrimary,
    deletedAt: null,
    number,
  };

  // Never store an empty string: it would collide on the unique index.
  if (email) payload.email = email;
  else delete payload.email;

  return contactModel.create(payload);
};

// ============ UPDATE ============
exports.updateContact = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.number;

  if ("fullName" in updateData) {
    const fullName = updateData.fullName?.trim();
    if (!fullName) throw new ApiError("Full name is required", 400);
    updateData.fullName = fullName;
  }

  if ("assignedTo" in updateData && !updateData.assignedTo) {
    throw new ApiError("Assigned to is required", 400);
  }

  // Normalize the email: an empty value means "no email".
  if ("email" in updateData) {
    const email = updateData.email?.trim().toLowerCase();

    if (email) {
      const exists = await contactModel.findOne({
        companyId,
        email,
        _id: { $ne: id },
        deletedAt: null,
      });

      if (exists) {
        throw new ApiError("A contact with this email already exists", 400);
      }

      updateData.email = email;
    } else {
      // Remove the field instead of storing "" (it would collide on the unique index).
      delete updateData.email;
      updateData.$unset = { ...(updateData.$unset || {}), email: 1 };
    }
  }

  // Cleared optional selects are removed.
  ["contactType", "preferredLanguage"].forEach((key) => {
    if (key in updateData && !updateData[key]) {
      delete updateData[key];
      updateData.$unset = { ...(updateData.$unset || {}), [key]: 1 };
    }
  });

  if ("crmCompanyId" in updateData && !updateData.crmCompanyId) {
    updateData.crmCompanyId = null;
  }

  await validateFields(companyId, updateData);

  // Moving to another company (or leaving one) drops the primary flag,
  // so it can't collide with the other company's primary contact.
  if ("crmCompanyId" in updateData) {
    const current = await contactModel
      .findOne({ _id: id, companyId, deletedAt: null })
      .select("crmCompanyId")
      .lean();

    if (
      current &&
      String(current.crmCompanyId || "") !==
        String(updateData.crmCompanyId || "")
    ) {
      updateData.isPrimary = false;
    }
  }

  const contact = await contactModel
    .findOneAndUpdate({ _id: id, companyId, deletedAt: null }, updateData, {
      new: true,
      runValidators: true,
    })
    .populate(POPULATE);

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return contact;
};

// ============ DELETE (Soft) ============
exports.deleteContact = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const contact = await contactModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  // Check related Opportunities
  const opportunityExists = await opportunityModel.exists({
    contactIds: id,
    companyId,
    deletedAt: null,
  });

  // Check related Deals
  const dealExists = await dealModel.exists({
    contactIds: id,
    companyId,
    deletedAt: null,
  });

  if (opportunityExists || dealExists) {
    throw new ApiError(
      "Cannot delete this contact because it is related to other entities",
      400,
    );
  }

  // Soft delete
  contact.deletedAt = new Date();
  await contact.save();

  return "Contact deleted successfully";
};

// ============ ASSIGN CONTACT TO COMPANY ============
exports.assignContactToCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { crmCompanyId } = req.body;

  if (!crmCompanyId) {
    throw new ApiError("crmCompanyId is required", 400);
  }

  if (!mongoose.Types.ObjectId.isValid(crmCompanyId)) {
    throw new ApiError("Invalid CRM company ID", 400);
  }

  const contact = await contactModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  const crmCompany = await companyModel.findOne({
    _id: crmCompanyId,
    companyId,
    deletedAt: null,
  });

  if (!crmCompany) {
    throw new ApiError(
      `No CRM company found with this ID: ${crmCompanyId}`,
      404,
    );
  }

  contact.crmCompanyId = crmCompany._id;

  // A contact is not automatically primary
  // just because it was assigned to a company.
  contact.isPrimary = false;

  await contact.save();

  return contact;
};

// ============ REMOVE CONTACT FROM COMPANY ============
exports.removeContactFromCompany = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const contact = await contactModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  if (!contact.crmCompanyId) {
    throw new ApiError("Contact is not assigned to a CRM company", 400);
  }

  contact.crmCompanyId = null;
  contact.isPrimary = false;

  await contact.save();

  return contact;
};

// ============ SET PRIMARY CONTACT ============
exports.setPrimaryContact = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const contact = await contactModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  if (!contact.crmCompanyId) {
    throw new ApiError(
      "Contact must be assigned to a CRM company before becoming primary",
      400,
    );
  }

  // Remove primary status from other contacts
  // belonging to the same CRM company.
  await contactModel.updateMany(
    {
      companyId,
      crmCompanyId: contact.crmCompanyId,
      _id: { $ne: contact._id },
      deletedAt: null,
    },
    {
      $set: { isPrimary: false },
    },
  );

  contact.isPrimary = true;

  await contact.save();

  return contact;
};
