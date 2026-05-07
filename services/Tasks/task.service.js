const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const ListModel = require("../../models/Tasks/ListModel");

// ======================================
// CREATE TASK (workspace aware)
// ======================================
exports.createTask = async (data, userId, workspace) => {
  if (!workspace) throw new Error("Workspace is required");
  if (!data.list) throw new Error("List is required");

  const list = await ListModel.findOne({
    _id: data.list,
    workspace: workspace._id,
  });

  if (!list) {
    throw new Error("Invalid list for this workspace");
  }

  return await Task.create({
    ...data,
    workspace: workspace._id,
    companyId: workspace.companyId,
    createdBy: userId,
  });
};

// ======================================
// GET TASK BY ID
// ======================================
exports.getTaskById = async (taskId, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  })
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email");

  if (!task) throw new Error("Task not found");

  return task;
};

// ======================================
// GET ALL TASKS (workspace scoped)
// ======================================
exports.getAllTasks = async ({
  workspaceId,
  userId,
  page = 1,
  limit = 10,
  status,
  priority,
  listId,
}) => {
  const filter = {
    workspace: workspaceId,
    isArchived: false,
  };

  // ===============================
  // LIST FILTER
  // ===============================
  if (listId && mongoose.Types.ObjectId.isValid(listId)) {
    filter.list = listId;
  }

  // ===============================
  // EXTRA FILTERS
  // ===============================
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const skip = (page - 1) * limit;

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Task.countDocuments(filter);

  // ===============================
  // SUBTASKS ATTACHMENT
  // ===============================
  const taskIds = tasks.map((t) => t._id);

  const subTasks = await subTaskModel
    .find({
      task: { $in: taskIds },
    })
    .lean();

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
    result,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
    },
  };
};

// ======================================
// UPDATE TASK
// ======================================
exports.updateTask = async (taskId, data, workspaceId) => {
  const task = await Task.findOneAndUpdate(
    {
      _id: taskId,
      workspace: workspaceId,
    },
    data,
    {
      new: true,
    },
  );

  if (!task) throw new Error("Task not found");

  return task;
};

// ======================================
// DELETE TASK
// ======================================
exports.deleteTask = async (taskId, workspaceId) => {
  const task = await Task.findOneAndDelete({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  return task;
};
