const mongoose = require("mongoose");
const TimeLog = require("../../models/Tasks/TimeTrackingModel");

// CREATE
exports.createTimeLog = async (data, userId, companyId) => {
  if (!data.task) throw new Error("Task is required");
  if (!data.from || !data.to) throw new Error("from and to are required");

  const fromDate = new Date(data.from);
  const toDate = new Date(data.to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error("Invalid date format");
  }

  if (toDate <= fromDate) {
    throw new Error("Invalid time range");
  }

  const duration = Math.floor(
    (toDate.getTime() - fromDate.getTime()) / 1000
  );

  return await TimeLog.create({
    ...data,
    from: fromDate,
    to: toDate,
    duration,
    user: userId,
    companyId,
  });
};
// GET ONE
exports.getTimeLogById = async (id) => {
  const log = await TimeLog.findById(id)
    .populate("task")
    .populate("user", "name email");

  if (!log) throw new Error("TimeLog not found");

  return log;
};

// GET ALL
exports.getAllTimeLogs = async ({ taskId, userId, page = 1, limit = 10 }) => {
  const filter = {};

  if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
    filter.task = new mongoose.Types.ObjectId(taskId);
  }

  if (userId) {
    filter.user = userId;
  }

  const skip = (page - 1) * limit;

  const logs = await TimeLog.find(filter)
    .populate("task")
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await TimeLog.countDocuments(filter);

  return {
    data: logs,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

// UPDATE
exports.updateTimeLog = async (id, data) => {
  const existing = await TimeLog.findById(id);
  if (!existing) throw new Error("TimeLog not found");

  const fromDate = new Date(data.from || existing.from);
  const toDate = new Date(data.to || existing.to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    throw new Error("Invalid date format");
  }

  if (toDate <= fromDate) {
    throw new Error("Invalid time range");
  }

  const duration = Math.floor(
    (toDate.getTime() - fromDate.getTime()) / 1000
  );

  return await TimeLog.findByIdAndUpdate(
    id,
    {
      ...data,
      from: fromDate,
      to: toDate,
      duration,
    },
    { new: true }
  );
};
// DELETE
exports.deleteTimeLog = async (id) => {
  const log = await TimeLog.findByIdAndDelete(id);

  if (!log) throw new Error("TimeLog not found");

  return log;
};
