const taskService = require("../../services/Tasks/task.service");

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
    const result = await taskService.getAllTasks({
      userId: req.user._id,
      type: req.query.type,
      listId: req.query.listId,
      includeSubTasks: req.query.includeSubTasks,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      status: req.query.status,
      priority: req.query.priority,
    });

    return res.status(200).json({
      pagination: result.pagination,

      success: true,
      data: result.tasks || result.result,
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
