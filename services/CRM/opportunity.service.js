const opportunityModel = require("../../models/CRM/opportunityModel");
const ApiError = require("../../utils/apiError");

// ============ GET ALL ============
exports.getAllOpportunities = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, pipelineId, ownerId } = req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }
  if (status) query.status = status;
  if (pipelineId) query.pipelineId = pipelineId;
  if (ownerId) query.ownerId = ownerId;

  const [total, opportunities] = await Promise.all([
    opportunityModel.countDocuments(query),
    opportunityModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("pipelineId", "name")
      .populate("leadId", "name"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: opportunities.length,
    total,
    data: opportunities,
  };
};

// ============ GET ONE ============
exports.getOneOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("ownerId", "name email")
    .populate("pipelineId", "name stages")
    .populate("contactIds", "name email phone")
    .populate("leadId", "name email");

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return opportunity;
};

// ============ CREATE ============
exports.createOpportunity = async (req) => {
  const companyId = req.companyId;

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const opportunity = await opportunityModel.create(payload);

  return opportunity;
};

// ============ UPDATE ============
exports.updateOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const opportunity = await opportunityModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return opportunity;
};

// ============ DELETE (Soft) ============
exports.deleteOpportunity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const opportunity = await opportunityModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!opportunity) {
    throw new ApiError(`No opportunity found with this ID: ${id}`, 404);
  }

  return "Opportunity deleted successfully";
};
