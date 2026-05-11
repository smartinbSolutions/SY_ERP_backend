const taskService = require("../../services/Tasks/task.service");

// ======================================
// CREATE TASK
// ======================================
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(
      req.body,
      req.user._id,
      req.workspace,
    );

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// GET ONE TASK
// ======================================
exports.getOneTask = async (req, res) => {
  try {
    const task = await taskService.getTaskById(
      req.params.taskId,
      req.workspace._id,
    );

    return res.status(200).json({
      success: true,
      data: task,
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// GET ALL TASKS
// ======================================
exports.getAllTasks = async (req, res) => {
  try {
    const result = await taskService.getAllTasks({
      workspaceId: req.workspace._id,
      userId: req.user._id,

      listId: req.query.listId,

      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,

      // filters
      status: req.query.status,
      priority: req.query.priority,
      assignedTo: req.query.assignedTo,
      due: req.query.due,
    });

    return res.status(200).json({
      success: true,
      pagination: result.pagination,
      data: result.result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// UPDATE TASK
// ======================================
exports.updateTask = async (req, res) => {
  try {
    const task = await taskService.updateTask(
      req.params.taskId,
      req.body,
      req.workspace._id,
    );

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// DELETE TASK
// ======================================
exports.deleteTask = async (req, res) => {
  try {
    await taskService.deleteTask(req.params.taskId, req.workspace._id);

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};
