const NotificationModel = require("../../models/Hr/NotificationModel");
const SubTask = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const notificationHelper = require("./notificationHelper");
// ======================================
// CREATE SUBTASK (context-aware)
// ======================================
exports.createSubTask = async (data, userId, task) => {
  if (!task) {
    throw new Error("Task context is required");
  }

  console.log("=== CREATE SUBTASK START ===", {
    userId,
    taskId: task._id,
    data,
  });

  // ======================================================
  // CREATE SUBTASK
  // ======================================================

  const subTask = await SubTask.create({
    ...data,
    createdBy: userId,
    task: task._id,
    companyId: task.companyId,
  });

  console.log("SUBTASK CREATED", {
    subTaskId: subTask._id,
  });

  // ======================================================
  // LINK SUBTASK TO TASK
  // ======================================================

  await Task.findByIdAndUpdate(task._id, {
    $push: { subTasks: subTask._id },
  });

  console.log("SUBTASK LINKED TO TASK");

  // ======================================================
  // POPULATE TASK TREE
  // ======================================================

  const populatedTask = await Task.findById(task._id).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!populatedTask) {
    console.log("NO POPULATED TASK");
    return subTask;
  }

  // ======================================================
  // STEP 1: ASSIGNED USERS NOTIFICATIONS
  // ======================================================

  console.log("STEP 1: ASSIGNED USERS NOTIFICATIONS");

  const assignedRecipients = [
    ...new Set(
      (subTask.assignedTo || [])
        .map((id) => String(id))
        .filter((id) => id !== String(userId)),
    ),
  ];

  console.log("STEP 1: ASSIGNED RECIPIENTS", assignedRecipients);

  if (assignedRecipients.length > 0) {
    const assignedNotifications = assignedRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "subtask.assigned",
      title: "SubTask Assigned",
      message: `You were assigned to subtask "${subTask.title}"`,
      entity: {
        subTaskId: subTask._id,
        taskId: task._id,
        listId: populatedTask.list?._id,
        folderId: populatedTask.list?.folder,
        workspaceId: populatedTask.list?.workspace,
        model: "SubTask",
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

  console.log("STEP 2: TREE NOTIFICATIONS");

  const recipients = notificationHelper.getRecipients(
    populatedTask,
    userId,
    "task",
  );

  console.log("STEP 2: TREE RECIPIENTS", recipients);

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "subtask.created",
      title: "SubTask Created",
      message: `Subtask "${subTask.title}" was created`,
      entity: {
        subTaskId: subTask._id,
        taskId: task._id,
        listId: populatedTask.list?._id,
        folderId: populatedTask.list?.folder,
        workspaceId: populatedTask.list?.workspace,
        model: "SubTask",
      },
    }));

    await NotificationModel.create(notifications);

    console.log("STEP 2: TREE NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 2: NO TREE RECIPIENTS");
  }

  console.log("=== CREATE SUBTASK END ===");

  return subTask;
};

// ======================================
// GET ALL SUBTASKS
// ======================================
exports.getAllSubTasks = async (taskId) => {
  const filter = taskId ? { task: taskId } : {};

  const subTasks = await SubTask.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .populate("task", "title");

  return subTasks;
};

// ======================================
// GET SUBTASK BY ID
// ======================================
exports.getSubTaskById = async (subTaskId) => {
  const subTask = await SubTask.findById(subTaskId)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name email")
    .populate("task", "title");

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  return subTask;
};

// ======================================
// UPDATE SUBTASK
// ======================================
exports.updateSubTask = async (subTaskId, data, actorId) => {
  console.log("=== UPDATE SUBTASK START ===", {
    subTaskId,
    actorId,
    data,
  });

  // =========================
  // UPDATE SUBTASK
  // =========================

  const subTask = await SubTask.findByIdAndUpdate(subTaskId, data, {
    new: true,
  });

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  console.log("SUBTASK UPDATED", {
    subTaskId: subTask._id,
  });

  // =========================
  // LOAD TASK TREE
  // =========================

  const task = await Task.findById(subTask.task).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!task) {
    console.log("NO TASK FOUND FOR SUBTASK");
    return subTask;
  }

  // ======================================================
  // STEP 1: TREE NOTIFICATIONS
  // ======================================================

  console.log("STEP 1: TREE NOTIFICATIONS");

  const recipients = notificationHelper.getRecipients(task, actorId, "task");

  console.log("STEP 1: RECIPIENTS", recipients);

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: actorId,
      type: "subtask.updated",
      title: "SubTask Updated",
      message: `Subtask "${subTask.title || subTask._id}" was updated`,
      entity: {
        subTaskId: subTask._id,
        taskId: subTask.task,
        listId: task.list?._id,
        folderId: task.list?.folder?._id,
        workspaceId: task.list?.workspace?._id,
        model: "SubTask",
      },
    }));

    await NotificationModel.create(notifications);

    console.log("STEP 1: TREE NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 1: NO RECIPIENTS");
  }

  console.log("=== UPDATE SUBTASK END ===");

  return subTask;
};

// ======================================
// DELETE SUBTASK
// ======================================
exports.deleteSubTask = async (subTaskId) => {
  const subTask = await SubTask.findById(subTaskId);

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  await Task.findByIdAndUpdate(subTask.task, {
    $pull: { subTasks: subTask._id },
  });

  await subTask.deleteOne();

  return subTask;
};

// ======================================
// ADD CHECKLIST ITEM
// ======================================
exports.addChecklistItem = async (subTaskId, data) => {
  const subTask = await SubTask.findById(subTaskId);

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  subTask.checklist.push({
    title: data.title,
    isDone: false,
    completedAt: null,
  });

  await subTask.save();

  return subTask;
};

// ======================================
// UPDATE CHECKLIST ITEM
// ======================================
exports.updateChecklistItem = async (subTaskId, itemId, data) => {
  const subTask = await SubTask.findById(subTaskId);

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  const item = subTask.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  if (data.title !== undefined) {
    item.title = data.title;
  }

  if (data.isDone !== undefined) {
    item.isDone = data.isDone;
    item.completedAt = data.isDone ? new Date() : null;
  }

  await subTask.save();

  return subTask;
};

// ======================================
// DELETE CHECKLIST ITEM
// ======================================
exports.deleteChecklistItem = async (subTaskId, itemId) => {
  const subTask = await SubTask.findById(subTaskId);

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  const item = subTask.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.deleteOne();

  await subTask.save();

  return subTask;
};

// ======================================
// TOGGLE CHECKLIST ITEM
// ======================================
exports.toggleChecklistItem = async (subTaskId, itemId) => {
  const subTask = await SubTask.findById(subTaskId);

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  const item = subTask.checklist.id(itemId);

  if (!item) {
    throw new Error("Checklist item not found");
  }

  item.isDone = !item.isDone;

  item.completedAt = item.isDone ? new Date() : null;

  await subTask.save();

  return subTask;
};
