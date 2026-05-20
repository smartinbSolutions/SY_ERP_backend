const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const ListModel = require("../../models/Tasks/ListModel");
const staffModel = require("../../models/Hr/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");
const notificationHelper = require("./notificationHelper");

// ======================================
// CREATE TASK (workspace aware)
// ======================================
exports.createTask = async (data, userId) => {
  if (!data.list) throw new Error("List is required");

  console.log("=== CREATE TASK START ===", { data, userId });

  const list = await ListModel.findById(data.list).populate([
    { path: "folder" },
    { path: "workspace" },
  ]);

  if (!list) throw new Error("Invalid list");

  const task = await Task.create({
    ...data,
    workspace: list.workspace,
    companyId: list.companyId,
    createdBy: userId,
  });

  console.log("TASK CREATED", { taskId: task._id });

  // =========================
  // POPULATE FOR TREE
  // =========================

  const populatedTask = await Task.findById(task._id).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  // ======================================================
  // STEP 1: DIRECT NOTIFICATIONS (ASSIGNED USERS)
  // ======================================================

  console.log("STEP 1: ASSIGNED USERS NOTIFICATIONS");

  const assignedRecipients = [
    ...new Set(
      (task.assignedTo || [])
        .map((id) => String(id))
        .filter((id) => id !== String(userId)),
    ),
  ];

  console.log("STEP 1: ASSIGNED RECIPIENTS", assignedRecipients);

  if (assignedRecipients.length > 0) {
    const assignedNotifications = assignedRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "task.assigned",
      title: "Task Assigned",
      message: `You were assigned to task "${task.title}"`,
      entity: {
        taskId: task._id,
        listId: task.list,
        folderId: populatedTask.list?.folder,
        workspaceId: populatedTask.list?.workspace,
        model: "Task",
      },
    }));

    await NotificationModel.create(assignedNotifications);

    console.log(
      "STEP 1: ASSIGNED NOTIFICATIONS SENT",
      assignedNotifications.length,
    );
  } else {
    console.log("STEP 1: NO ASSIGNED RECIPIENTS");
  }

  // ======================================================
  // STEP 2: TREE NOTIFICATIONS
  // ======================================================

  console.log("STEP 2: TREE ONLY NOTIFICATIONS");

  const recipients = notificationHelper.getRecipients(
    populatedTask,
    userId,
    "task",
  );

  console.log("STEP 2: TREE RECIPIENTS", recipients);

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

    console.log("STEP 2: TREE NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 2: NO TREE RECIPIENTS");
  }

  console.log("=== CREATE TASK END ===");

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
  console.log("=== UPDATE TASK START ===", {
    taskId,
    actorId: actor._id,
    data,
  });

  const task = await Task.findByIdAndUpdate(taskId, data, {
    new: true,
  }).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!task) throw new Error("Task not found");

  console.log("TASK UPDATED", {
    taskId: task._id,
  });

  // ======================================================
  // STEP 1: TREE NOTIFICATIONS
  // ======================================================

  console.log("STEP 1: TREE NOTIFICATIONS");

  const recipients = notificationHelper.getRecipients(task, actor._id, "task");

  console.log("STEP 1: RECIPIENTS", recipients);

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: actor._id,
      type: "task.updated",
      title: "Task Updated",
      message: `Task "${task.title}" was updated by ${actor.fullName}`,
      entity: {
        taskId: task._id,
        listId: task.list,
        folderId: task.list?.folder,
        workspaceId: task.list?.workspace,
        model: "Task",
      },
    }));

    await NotificationModel.create(notifications);

    console.log("STEP 1: TREE NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 1: NO RECIPIENTS");
  }

  console.log("=== UPDATE TASK END ===");

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
