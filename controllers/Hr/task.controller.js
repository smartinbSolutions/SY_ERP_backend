const taskService = require("../../services/Hr/taskService");

// CREATE TASK
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user._id);

    return res.status(201).json({
      message: "Task created successfully",
      data: task,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
};

// GET ONE TASK
exports.getOneTask = async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);

    return res.status(200).json({
      data: task,
    });
  } catch (err) {
    return res.status(404).json({
      message: err.message,
    });
  }
};

// GET ALL TASKS
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks(req);

    return res.status(200).json({
      count: tasks.length,
      data: tasks,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
};

// UPDATE TASK
exports.updateTask = async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);

    return res.status(200).json({
      message: "Task updated successfully",
      data: task,
    });
  } catch (err) {
    return res.status(400).json({
      message: err.message,
    });
  }
};

// DELETE TASK
exports.deleteTask = async (req, res) => {
  try {
    await taskService.deleteTask(req.params.id);

    return res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (err) {
    return res.status(404).json({
      message: err.message,
    });
  }
};