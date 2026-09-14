const activityModel = require("../../models/CRM/activityModel");
const ApiError = require("../../utils/apiError");

// GET ALL

exports.getAllActivities = async (req) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const total = await activityModel.countDocuments();

  const activities = await activityModel
    .find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: activities.length,
    data: activities,
  };
};

// GET ONE

exports.getOneActivity = async (req) => {
  const { id } = req.params;

  const activity = await activityModel.findById(id);

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// CREATE

exports.createActivity = async (req) => {
  const activity = await activityModel.create(req.body);

  return activity;
};

// UPDATE

exports.updateActivity = async (req) => {
  const { id } = req.params;

  const activity = await activityModel.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// DELETE

exports.deleteActivity = async (req) => {
  const { id } = req.params;

  const activity = await activityModel.findByIdAndDelete(id);

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return "Activity deleted successfully";
};
