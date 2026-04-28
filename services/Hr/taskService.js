const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");

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

exports.getAllTasks = async (req) => {
  const { type, includeSubTasks } = req.query;

  const userId = req.user._id;

  let filter = { isArchived: false };

  if (type === "my") filter.assignedTo = userId;
  if (type === "team") filter.createdBy = userId;

  let query = Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("createdBy", "name");

  const tasks = await query;

  // if (includeSubTasks === "true") {
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

  return tasks.map((task) => ({
    ...task.toObject(),
    subTasks: map[task._id.toString()] || [],
  }));
  // }

  // return tasks;
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
