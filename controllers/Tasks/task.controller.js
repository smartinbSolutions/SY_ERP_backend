const taskService = require("../../services/Tasks/task.service");
const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const NotificationModel = require("../../models/Hr/NotificationModel");

// ======================================
// CREATE TASK
// ======================================
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(
      {
        ...req.body,
        list: req.params.listId,
      },
      req.user._id,
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
    const task = await taskService.getTaskById(req.params.taskId);

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

      listId: req.params.listId,

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
      req.user,
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
    await taskService.deleteTask(req.params.taskId);

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

// ======================================
// ADD CHECKLIST ITEM
// ======================================
exports.addChecklistItem = async (req, res) => {
  try {
    const task = await taskService.addChecklistItem(
      req.params.taskId,
      req.body,
      req.workspace._id,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist item added successfully",
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
// UPDATE CHECKLIST ITEM
// ======================================
exports.updateChecklistItem = async (req, res) => {
  try {
    const task = await taskService.updateChecklistItem(
      req.params.taskId,
      req.params.itemId,
      req.body,
      req.workspace._id,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist item updated successfully",
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
// DELETE CHECKLIST ITEM
// ======================================
exports.deleteChecklistItem = async (req, res) => {
  try {
    const task = await taskService.deleteChecklistItem(
      req.params.taskId,
      req.params.itemId,
      req.workspace._id,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist item deleted successfully",
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
// TOGGLE CHECKLIST ITEM
// ======================================
exports.toggleChecklistItem = async (req, res) => {
  try {
    const task = await taskService.toggleChecklistItem(
      req.params.taskId,
      req.params.itemId,
      req.workspace._id,
    );

    return res.status(200).json({
      success: true,
      message: "Checklist item toggled successfully",
      data: task,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
