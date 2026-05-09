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

    res.status(201).json({
      success: true,
      data: subTask,
    });
  } catch (error) {
    res.status(400).json({
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
    const taskId = req.task?._id || req.query.taskId;

    const subTasks = await subTaskService.getAllSubTasks(taskId);

    res.status(200).json({
      success: true,
      results: subTasks.length,
      data: subTasks,
    });
  } catch (error) {
    res.status(400).json({
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
    const subTask = await subTaskService.getSubTaskById(
      req.subTask._id, // 🔥 جاء من subTaskResolver
    );

    res.status(200).json({
      success: true,
      data: subTask,
    });
  } catch (error) {
    res.status(404).json({
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
    const subTask = await subTaskService.updateSubTask(
      req.subTask._id, 
      req.body,
    );

    res.status(200).json({
      success: true,
      data: subTask,
    });
  } catch (error) {
    res.status(404).json({
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
    await subTaskService.deleteSubTask(req.subTask._id); 

    res.status(200).json({
      success: true,
      message: "SubTask deleted successfully",
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};
