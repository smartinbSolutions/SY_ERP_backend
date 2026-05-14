const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const ListModel = require("../../models/Tasks/ListModel");
const staffModel = require("../../models/Hr/staffModel");

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

  assignedTo,
  due,
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
  // STATUS
  // ===============================
  if (status) {
    filter.status = status;
  }

  // ===============================
  // PRIORITY
  // ===============================
  if (priority) {
    filter.priority = priority;
  }

  // ===============================
  // ASSIGNED TO (BY NAME)
  // ===============================
  if (assignedTo) {
    console.log(assignedTo);

    const employees = await staffModel
      .find({
        fullName: {
          $regex: assignedTo,
          $options: "i",
        },
      })
      .select("_id");
    console.log(employees);

    const employeeIds = employees.map((e) => e._id);
    console.log(employeeIds);

    filter.assignedTo = {
      $in: employeeIds,
    };
  }

  // ===============================
  // DUE DATE
  // ===============================
  if (due) {
    const start = new Date(due);
    start.setHours(0, 0, 0, 0);

    const end = new Date(due);
    end.setHours(23, 59, 59, 999);

    filter.dueDate = {
      $gte: start,
      $lte: end,
    };
  }

  const skip = (page - 1) * limit;

  // ===============================
  // TASKS
  // ===============================
  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Task.countDocuments(filter);

  // ===============================
  // SUBTASKS
  // ===============================
  const taskIds = tasks.map((t) => t._id);

  const subTasks = await subTaskModel
    .find({
      task: { $in: taskIds },
    })
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .lean();

  // ===============================
  // GROUP SUBTASKS
  // ===============================
  const map = {};

  subTasks.forEach((st) => {
    const key = st.task.toString();

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(st);
  });

  // ===============================
  // ATTACH SUBTASKS
  // ===============================
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

exports.addChecklistItem = async (taskId, data, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  task.checklist.push({
    title: data.title,
    isDone: false,
    completedAt: null,
  });

  await task.save();
  return task;
};

//  UPDATE ITEM
exports.updateChecklistItem = async (taskId, itemId, data, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  const item = task.checklist.id(itemId);
  if (!item) throw new Error("Checklist item not found");

  if (data.title !== undefined) item.title = data.title;

  if (data.isDone !== undefined) {
    item.isDone = data.isDone;
    item.completedAt = data.isDone ? new Date() : null;
  }

  await task.save();
  return task;
};

//  DELETE ITEM
exports.deleteChecklistItem = async (taskId, itemId, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  const item = task.checklist.id(itemId);
  if (!item) throw new Error("Checklist item not found");

  item.remove();

  await task.save();
  return task;
};

exports.toggleChecklistItem = async (taskId, itemId, workspaceId) => {
  const task = await Task.findOne({
    _id: taskId,
    workspace: workspaceId,
  });

  if (!task) throw new Error("Task not found");

  const item = task.checklist.id(itemId);
  if (!item) throw new Error("Checklist item not found");

  item.isDone = !item.isDone;
  item.completedAt = item.isDone ? new Date() : null;

  await task.save();
  return task;
};
