const taskService = require("../../services/Hr/taskService");

exports.createTask = async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user._id);

    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getOneTask = async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);

    res.json(task);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await taskService.getAllTasks();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await taskService.updateTask(req.params.id, req.body);

    res.json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    await taskService.deleteTask(req.params.id);

    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};
