const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const ListModel = require("../../models/Tasks/ListModel");
const staffModel = require("../../models/Hr/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");

exports.getTaskRecipients = (task, actorId) => {
  const toIds = (members = []) =>
    members
      .filter((m) => m?.user && m.notificationsEnabled)
      .map((m) => String(m.user))
      .filter((id) => id !== String(actorId));

  const workspace = toIds(task?.list?.workspace?.members);
  const folder = toIds(task?.list?.folder?.members);
  const list = toIds(task?.list?.members);

  console.log(workspace, folder, list);

  const merged = [...workspace, ...folder, ...list];

  return [...new Set(merged)];
};

// ======================================
// CREATE TASK (workspace aware)
// ======================================
exports.createTask = async (data, userId) => {
  if (!data.list) throw new Error("List is required");

  const list = await ListModel.findById(data.list).populate([
    { path: "folder" },
    { path: "workspace" },
  ]);

  if (!list) {
    throw new Error("Invalid list");
  }

  const task = await Task.create({
    ...data,
    workspace: list.workspace,
    companyId: list.companyId,
    createdBy: userId,
  });

  // populate task for notifications
  const populatedTask = await Task.findById(task._id).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  // =========================
  // NOTIFICATIONS LOGIC
  // =========================

  const recipients = await exports.getTaskRecipients(populatedTask, userId);

  if (recipients.length > 0) {
    const notifications = recipients.map((recipientId) => ({
      recipient: recipientId,
      actor: userId,
      type: "task.created",
      title: "Task Created",
      message: `Task "${populatedTask.title}" was created`,
      entity: {
        taskId: populatedTask._id,
        listId: populatedTask.list,
        folderId: populatedTask.list?.folder,
        workspaceId: populatedTask.list?.workspace,
        model: "Task",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return populatedTask;
};

// ======================================
// GET TASK BY ID
// ======================================
exports.getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate({
      path: "list",
      populate: [{ path: "folder" }, { path: "workspace" }],
    })
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email");

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
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
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
    .populate("assignedTo", "fullName email")
    .populate("createdBy", "fullName email")
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
exports.updateTask = async (taskId, data, actor) => {
  const task = await Task.findByIdAndUpdate(taskId, data, {
    new: true,
  }).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!task) throw new Error("Task not found");

  // =========================
  // NOTIFICATIONS LOGIC
  // =========================

  const recipients = await exports.getTaskRecipients(task, actor._id);

  if (recipients.length > 0) {
    const notifications = recipients.map((userId) => ({
      recipient: userId,
      actor: actor._id,
      type: "task.updated",
      title: "Task Updated",
      message: `Task "${task.title}" was updated by ${actor.fullName} `,
      entity: {
        taskId: task._id,
        listId: task.list,
        model: "Task",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return task;
};

// ======================================
// DELETE TASK
// ======================================
exports.deleteTask = async (taskId) => {
  const task = await Task.findByIdAndDelete(taskId);

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

  task.checklist.pull(itemId);

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
