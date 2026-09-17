const activityModel = require("../../models/CRM/activityModel");
const ApiError = require("../../utils/apiError");

// ============ GET ALL ============
exports.getAllActivities = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const {
    keyword,
    type,
    status,
    priority,
    ownerId,
    relatedToType,
    relatedToId,
  } = req.query;

  const query = { companyId, deletedAt: null };

  if (keyword) {
    query.$or = [
      { subject: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }
  if (type) query.type = type;
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (ownerId) query.ownerId = ownerId;
  if (relatedToType) query["relatedTo.type"] = relatedToType;
  if (relatedToId) query["relatedTo.id"] = relatedToId;

  const [total, activities] = await Promise.all([
    activityModel.countDocuments(query),
    activityModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("attendees", "name email"),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: activities.length,
    total,
    data: activities,
  };
};

// ============ GET ONE ============
exports.getOneActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const activity = await activityModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("ownerId", "name email")
    .populate("attendees", "name email");

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// ============ CREATE ============
exports.createActivity = async (req) => {
  const companyId = req.companyId;

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
  };

  const activity = await activityModel.create(payload);

  return activity;
};

// ============ UPDATE ============
exports.updateActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const updateData = { ...req.body };
  delete updateData.companyId;
  delete updateData.deletedAt;

  const activity = await activityModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    updateData,
    { new: true, runValidators: true },
  );

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// ============ DELETE (Soft) ============
exports.deleteActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const activity = await activityModel.findOneAndUpdate(
    { _id: id, companyId, deletedAt: null },
    { deletedAt: new Date() },
    { new: true },
  );

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return "Activity deleted successfully";
};
