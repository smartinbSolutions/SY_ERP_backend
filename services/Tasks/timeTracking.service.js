const mongoose = require("mongoose");
const TimeLog = require("../../models/Tasks/TimeTrackingModel");

// CREATE
exports.createTimeLog = async (data, userId, companyId) => {
  if (!data.task) throw new Error("Task is required");
  if (!data.from || !data.to) throw new Error("from and to are required");

  if (data.to <= data.from) {
    throw new Error("Invalid time range");
  }

  const duration = Math.floor((data.to - data.from) / 1000);

  return await TimeLog.create({
    ...data,
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

  const from = data.from || existing.from;
  const to = data.to || existing.to;

  if (to <= from) {
    throw new Error("Invalid time range");
  }

  const duration = Math.floor((to - from) / 1000);

  const updated = await TimeLog.findByIdAndUpdate(
    id,
    {
      ...data,
      duration,
    },
    { new: true },
  );

  return updated;
};

// DELETE
exports.deleteTimeLog = async (id) => {
  const log = await TimeLog.findByIdAndDelete(id);

  if (!log) throw new Error("TimeLog not found");

  return log;
};
