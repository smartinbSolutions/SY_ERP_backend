const mongoose = require("mongoose");
const contactModel = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const ApiError = require("../../utils/apiError");

// ============ GET ALL ============
exports.getAllContacts = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, crmCompanyId, ownerId, source } = req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.$or = [
      { firstName: { $regex: keyword, $options: "i" } },
      { lastName: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
      { phone: { $regex: keyword, $options: "i" } },
    ];
  }
  if (status) query.status = status;
  if (crmCompanyId) query.crmCompanyId = crmCompanyId;
  if (ownerId) query.ownerId = ownerId;
  if (source) query.source = source;

  const [total, contacts] = await Promise.all([
    contactModel.countDocuments(query),
    contactModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("crmCompanyId", "name industry"),
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
    .populate("crmCompanyId", "name industry website");

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return contact;
};

// ============ CREATE ============
exports.createContact = async (req) => {
  const companyId = req.companyId;

  const exists = await contactModel.findOne({
    companyId,
    email: req.body.email,
    deletedAt: null,
  });

  if (exists) {
    throw new ApiError("A contact with this email already exists", 400);
  }

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const contact = await contactModel.create(payload);

  return contact;
};

// ============ UPDATE ============
exports.updateContact = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (req.body.email) {
    const exists = await contactModel.findOne({
      companyId,
      email: req.body.email,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A contact with this email already exists", 400);
    }
  }

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const contact = await contactModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

  return contact;
};

// ============ DELETE (Soft) ============
exports.deleteContact = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const contact = await contactModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!contact) {
    throw new ApiError(`No contact found with this ID: ${id}`, 404);
  }

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
  console.log(crmCompanyId);
  console.log(companyId);
  

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
