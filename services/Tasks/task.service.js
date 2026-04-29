const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");

// CREATE
exports.createTask = async (data, userId) => {
  return await Task.create({
    ...data,
    createdBy: userId,
  });
};

// GET ONE
exports.getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name");

  if (!task) throw new Error("Task not found");

  return task;
};

// GET ALL (🔥 clean version)
exports.getAllTasks = async ({
  userId,
  type,
  listId,
  includeSubTasks,
  page = 1,
  limit = 10,
  status,
  priority,
}) => {
  const filter = { isArchived: false };

  // type filter
  if (type === "my") filter.assignedTo = userId;
  if (type === "team") filter.createdBy = userId;

  // list filter
  if (listId && mongoose.Types.ObjectId.isValid(listId)) {
    filter.list = new mongoose.Types.ObjectId(listId);
  }

  // extra filters
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const skip = (page - 1) * limit;

  // main query
  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Task.countDocuments(filter);

  // 🔥 بدون subTasks
  if (includeSubTasks !== "true") {
    return {
      data: tasks,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // 🔥 WITH subTasks
  const taskIds = tasks.map((t) => t._id);

  const subTasks = await subTaskModel.find({ task: { $in: taskIds } }).lean();

  const map = {};

  subTasks.forEach((st) => {
    const key = st.task.toString();
    if (!map[key]) map[key] = [];
    map[key].push(st);
  });

  const result = tasks.map((task) => ({
    ...task.toObject(),
    subTasks: map[task._id.toString()] || [],
  }));

  return {
    data: result,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

// UPDATE
exports.updateTask = async (taskId, data) => {
  const task = await Task.findByIdAndUpdate(taskId, data, {
    new: true,
  });

  if (!task) throw new Error("Task not found");

  return task;
};

// DELETE
exports.deleteTask = async (taskId) => {
  const task = await Task.findByIdAndDelete(taskId);

  if (!task) throw new Error("Task not found");

  return task;
};
