const NotificationModel = require("../../models/Hr/NotificationModel");
const SubTask = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const { getTaskRecipients } = require("./task.service");

// ======================================
// CREATE SUBTASK (context-aware)
// ======================================
exports.createSubTask = async (data, userId, task) => {
  if (!task) {
    throw new Error("Task context is required");
  }

  const subTask = await SubTask.create({
    ...data,
    createdBy: userId,
    task: task._id,
    companyId: task.companyId,
  });

  // ربط subtask بالـ task
  await Task.findByIdAndUpdate(task._id, {
    $push: { subTasks: subTask._id },
  });

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
  // =========================
  // UPDATE SUBTASK
  // =========================
  const subTask = await SubTask.findByIdAndUpdate(subTaskId, data, {
    new: true,
  });

  if (!subTask) {
    throw new Error("SubTask not found");
  }

  const task = await Task.findById(subTask.task).populate({
    path: "list",
    populate: [{ path: "folder" }, { path: "workspace" }],
  });

  if (!task) {
    return subTask;
  }

  const recipients = await getTaskRecipients(task, actorId);

  const uniqueRecipients = [
    ...new Set(recipients.map((id) => String(id))),
  ].filter((id) => id !== String(actorId));

  if (uniqueRecipients.length === 0) {
    return subTask;
  }
  // =========================
  // NOTIFICATIONS
  // =========================
  const notifications = uniqueRecipients.map((recipient) => ({
    recipient,
    actor: actorId,
    type: "subtask.updated",
    title: "SubTask Updated",
    message: `Subtask "${subTask.title || subTask._id}" was updated`,
    entity: {
      id: subTask._id,
      model: "SubTask",
    },
  }));

  await NotificationModel.create(notifications);

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
