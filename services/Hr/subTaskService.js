const SubTask = require("../../models/Hr/subTaskModel");
const Task = require("../../models/Hr/taskModel");

exports.createSubTask = async (data, userId) => {
  const parentTask = await Task.findById(data.task);

  if (!parentTask) {
    throw new Error("Parent task not found");
  }

  const subTask = await SubTask.create({
    ...data,
    createdBy: userId,
    task: data.task,
  });

  await Task.findByIdAndUpdate(data.task, {
    $push: { subTasks: subTask._id },
  });

  return subTask;
};

exports.getAllSubTasks = async (taskId) => {
  let filter = {};

  if (taskId) {
    filter.task = taskId;
  }

  const subTasks = await SubTask.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name")
    .populate("task", "title");

  return subTasks;
};

exports.getSubTaskById = async (subTaskId) => {
  const subTask = await SubTask.findById(subTaskId)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name")
    .populate("task", "title");

  if (!subTask) throw new Error("SubTask not found");

  return subTask;
};

exports.updateSubTask = async (subTaskId, data) => {
  const subTask = await SubTask.findByIdAndUpdate(subTaskId, data, {
    new: true,
  });

  if (!subTask) throw new Error("SubTask not found");

  return subTask;
};

exports.deleteSubTask = async (subTaskId) => {
  const subTask = await SubTask.findById(subTaskId);

  if (!subTask) throw new Error("SubTask not found");

  await Task.findByIdAndUpdate(subTask.task, {
    $pull: { subTasks: subTask._id },
  });

  await subTask.deleteOne();

  return subTask;
};
