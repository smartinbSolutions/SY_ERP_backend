const dealModel = require("../../models/CRM/dealModel");
const ApiError = require("../../utils/apiError");
const Opportunity = require("../../models/CRM/opportunityModel");
const Company = require("../../models/CRM/companyModel");



// ============ GET ALL ============
exports.getAllDeals = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, crmCompanyId, ownerId, opportunityId, from, to } =
    req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.$or = [
      { title: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }
  if (status) query.status = status;
  if (crmCompanyId) query.crmCompanyId = crmCompanyId;
  if (ownerId) query.ownerId = ownerId;
  if (opportunityId) query.opportunityId = opportunityId;

  if (from || to) {
    query.closedAt = {};
    if (from) query.closedAt.$gte = new Date(from);
    if (to) query.closedAt.$lte = new Date(to);
  }

  const [total, deals] = await Promise.all([
    dealModel.countDocuments(query),
    dealModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("crmCompanyId", "name industry")
      .populate("opportunityId", "title value")
      .populate("contactIds", "firstName lastName email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: deals.length,
    total,
    data: deals,
  };
};

// ============ GET ONE ============
exports.getOneDeal = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const deal = await dealModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("ownerId", "name email")
    .populate("crmCompanyId", "name industry website")
    .populate("opportunityId", "title value currentStageKey")
    .populate("contactIds", "firstName lastName email phone");

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return deal;
};

// ============ CREATE ============
exports.createDeal = async (req) => {
  const companyId = req.companyId;

  if (req.body.opportunityId) {
    const opp = await Opportunity.findOne({
      _id: req.body.opportunityId,
      companyId,
    });

    if (!opp) {
      throw new ApiError("Opportunity not found in your company", 404);
    }
  }

  if (req.body.crmCompanyId) {
    const crmComp = await Company.findOne({
      _id: req.body.crmCompanyId,
      companyId,
      deletedAt: null,
    });

    if (!crmComp) {
      throw new ApiError("CRM Company not found in your company", 404);
    }
  }

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const deal = await dealModel.create(payload);

  return deal;
};

// ============ UPDATE ============
exports.updateDeal = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  if (req.body.crmCompanyId) {
    const crmComp = await Company.findOne({
      _id: req.body.crmCompanyId,
      companyId,
      deletedAt: null,
    });
    if (!crmComp) {
      throw new ApiError("CRM Company not found in your company", 404);
    }
  }

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const deal = await dealModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return deal;
};

// ============ DELETE (Soft) ============
exports.deleteDeal = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const deal = await dealModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!deal) {
    throw new ApiError(`No deal found with this ID: ${id}`, 404);
  }

  return "Deal deleted successfully";
};
