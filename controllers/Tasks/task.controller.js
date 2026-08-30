const taskService = require("../../services/Tasks/task.service");

// ======================================
// CREATE TASK
// ======================================
exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user._id, req.list);

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
    const task = await taskService.getTaskById({
      taskId: req.params.taskId,
      listId: req.list._id,
      workspaceId: req.workspace._id,
      companyId: req.companyId,
    });
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
    const data = await taskService.getAllTasks({
      workspaceId: req.workspace._id,
      listId: req.list._id,
      companyId: req.companyId,

      // Filters
      status: req.query.status,
      priority: req.query.priority,
      assignedTo: req.query.assignedTo,
      due: req.query.due,
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
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
    await taskService.deleteTask({
      taskId: req.params.taskId,
      listId: req.list._id,
      workspaceId: req.workspace._id,
      folderId: req.folder._id,
      companyId: req.companyId,
      actorId: req.user._id,
      actorName: req.user.fullName || "Someone",
    });

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
    const task = await taskService.addChecklistItem({
      taskId: req.params.taskId,
      listId: req.list._id,
      workspaceId: req.workspace._id,
      companyId: req.companyId,
      data: req.body,
    });

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
    const task = await taskService.updateChecklistItem({
      taskId: req.params.taskId,
      itemId: req.params.itemId,
      listId: req.list._id,
      workspaceId: req.workspace._id,
      companyId: req.companyId,
      data: req.body,
    });

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
    const task = await taskService.deleteChecklistItem({
      taskId: req.params.taskId,
      itemId: req.params.itemId,
      listId: req.list._id,
      workspaceId: req.workspace._id,
      companyId: req.companyId,
    });

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
    const task = await taskService.toggleChecklistItem({
      taskId: req.params.taskId,
      itemId: req.params.itemId,
      listId: req.list._id,
      workspaceId: req.workspace._id,
      companyId: req.companyId,
    });

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
