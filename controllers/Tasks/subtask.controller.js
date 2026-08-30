const subTaskService = require("../../services/Tasks/subTask.service");

// ======================================
// CREATE SUBTASK
// ======================================
exports.createSubTask = async (req, res) => {
  try {
    const subTask = await subTaskService.createSubTask(
      req.body,
      req.user._id,
      req.task,
    );

    return res.status(201).json({
      success: true,
      message: "SubTask created successfully",
      data: subTask,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// GET ALL SUBTASKS
// ======================================
exports.getAllSubTasks = async (req, res) => {
  try {
    const subTasks = await subTaskService.getAllSubTasks({
      taskId: req.task._id,
      companyId: req.companyId,
    });

    return res.status(200).json({
      success: true,
      results: subTasks.length,
      data: subTasks,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// GET SUBTASK BY ID
// ======================================
exports.getSubTaskById = async (req, res) => {
  try {
    const subTask = await subTaskService.getSubTaskById({
      subTaskId: req.subTask._id,
      taskId: req.task._id,
      companyId: req.companyId,
    });

    return res.status(200).json({
      success: true,
      data: subTask,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// UPDATE SUBTASK
// ======================================
exports.updateSubTask = async (req, res) => {
  try {
    const subTask = await subTaskService.updateSubTask({
      subTaskId: req.subTask._id,
      taskId: req.task._id,
      companyId: req.companyId,
      data: req.body,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "SubTask updated successfully",
      data: subTask,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// DELETE SUBTASK
// ======================================
exports.deleteSubTask = async (req, res) => {
  try {
    await subTaskService.deleteSubTask({
      subTaskId: req.subTask._id,
      taskId: req.task._id,
      companyId: req.companyId,
      actor: req.user,
    });

    return res.status(200).json({
      success: true,
      message: "SubTask deleted successfully",
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// ADD CHECKLIST ITEM
// ======================================
exports.addChecklistItem = async (req, res) => {
  try {
    const subTask = await subTaskService.addChecklistItem({
      subTaskId: req.subTask._id,
      taskId: req.task._id,
      companyId: req.companyId,
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Checklist item added successfully",
      data: subTask,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// UPDATE CHECKLIST ITEM
// ======================================
exports.updateChecklistItem = async (req, res) => {
  try {
    const subTask = await subTaskService.updateChecklistItem({
      subTaskId: req.subTask._id,
      itemId: req.params.itemId,
      taskId: req.task._id,
      companyId: req.companyId,
      data: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Checklist item updated successfully",
      data: subTask,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// DELETE CHECKLIST ITEM
// ======================================
exports.deleteChecklistItem = async (req, res) => {
  try {
    const subTask = await subTaskService.deleteChecklistItem({
      subTaskId: req.subTask._id,
      itemId: req.params.itemId,
      taskId: req.task._id,
      companyId: req.companyId,
    });

    return res.status(200).json({
      success: true,
      message: "Checklist item deleted successfully",
      data: subTask,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================
// TOGGLE CHECKLIST ITEM
// ======================================
exports.toggleChecklistItem = async (req, res) => {
  try {
    const subTask = await subTaskService.toggleChecklistItem({
      subTaskId: req.subTask._id,
      itemId: req.params.itemId,
      taskId: req.task._id,
      companyId: req.companyId,
    });

    return res.status(200).json({
      success: true,
      message: "Checklist item toggled successfully",
      data: subTask,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
