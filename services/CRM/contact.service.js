const contactModel = require("../../models/CRM/contactModel");
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
      .populate("ownerId", "name email")
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
    .populate("ownerId", "name email")
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
