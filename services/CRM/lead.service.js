const leadModel = require("../../models/CRM/leadModel");
const ApiError = require("../../utils/apiError");

// ============ GET ALL ============
exports.getAllLeads = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, source, ownerId } = req.query;

  // 🔒 scope بـ companyId
  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.$or = [
      { firstName: { $regex: keyword, $options: "i" } },
      { lastName: { $regex: keyword, $options: "i" } },
      { email: { $regex: keyword, $options: "i" } },
      { phone: { $regex: keyword, $options: "i" } },
      { companyName: { $regex: keyword, $options: "i" } },
    ];
  }
  if (status) query.status = status;
  if (source) query.source = source;
  if (ownerId) query.ownerId = ownerId;

  const [total, leads] = await Promise.all([
    leadModel.countDocuments(query),
    leadModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: leads.length,
    total,
    data: leads,
  };
};

// ============ GET ONE ============
exports.getOneLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("ownerId", "name email")
    .populate("convertedTo.contactId", "firstName lastName email")
    .populate("convertedTo.crmCompanyId", "name industry")
    .populate("convertedTo.opportunityId", "title value")
    .populate("convertedTo.convertedBy", "name email");

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// ============ CREATE ============
exports.createLead = async (req) => {
  const companyId = req.companyId;

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      deletedAt: null,
    });
    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const lead = await leadModel.create(payload);

  return lead;
};

// ============ UPDATE ============
exports.updateLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

    if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      _id: { $ne: id },
      deletedAt: null,
    });
    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const lead = await leadModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// ============ DELETE (Soft) ============
exports.deleteLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return "Lead deleted successfully";
};
