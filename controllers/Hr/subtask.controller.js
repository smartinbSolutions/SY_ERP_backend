const subTaskService = require("../../services/Hr/subTaskService");

exports.createSubTask = async (req, res) => {
  try {
    const subTask = await subTaskService.createSubTask(req.body, req.user.id);

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

exports.getAllSubTasks = async (req, res) => {
  try {
    const { taskId } = req.query;

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

exports.getSubTaskById = async (req, res) => {
  try {
    const subTask = await subTaskService.getSubTaskById(req.params.id);

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

exports.updateSubTask = async (req, res) => {
  try {
    const subTask = await subTaskService.updateSubTask(req.params.id, req.body);

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

exports.deleteSubTask = async (req, res) => {
  try {
    await subTaskService.deleteSubTask(req.params.id);

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
