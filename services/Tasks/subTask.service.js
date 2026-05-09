const SubTask = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");

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
exports.updateSubTask = async (subTaskId, data) => {
  const subTask = await SubTask.findByIdAndUpdate(subTaskId, data, {
    new: true,
  });

  if (!subTask) {
    throw new Error("SubTask not found");
  }

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
