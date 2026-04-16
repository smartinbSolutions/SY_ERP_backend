const Task = require("../../models/Hr/taskModel");

exports.createTask = async (data, userId) => {
  const task = await Task.create({
    ...data,
    createdBy: userId,
  });

  return task;
};

exports.getTaskById = async (taskId) => {
  const task = await Task.findById(taskId)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name");

  if (!task) throw new Error("Task not found");

  return task;
};

exports.getAllTasks = async () => {
  const tasks = await Task.find()
    .populate("assignedTo", "name email")
    .populate("createdBy", "name");

  return tasks;
};

exports.updateTask = async (taskId, data) => {
  const task = await Task.findByIdAndUpdate(taskId, data, {
    new: true,
  });

  if (!task) throw new Error("Task not found");

  return task;
};

exports.deleteTask = async (taskId) => {
  const task = await Task.findByIdAndDelete(taskId);

  if (!task) throw new Error("Task not found");

  return task;
};
