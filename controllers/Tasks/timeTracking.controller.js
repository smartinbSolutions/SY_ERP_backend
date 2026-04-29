const timeTrackingService = require("../../services/Tasks/timeTracking.service");

// ===============================
// CREATE TIME LOG
// ===============================
exports.createTimeLog = async (req, res) => {
  try {
    const data = await timeTrackingService.createTimeLog(
      req.body,
      req.user._id,
      req.query.companyId,
    );

    return res.status(201).json({
      success: true,
      message: "Time log created successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// GET ALL TIME LOGS
// ===============================
exports.getAllTimeLogs = async (req, res) => {
  try {
    const data = await timeTrackingService.getAllTimeLogs({
      ...req.query,
      userId: req.query.userId || req.user._id,
    });

    return res.status(200).json({
      success: true,
      ...data, // includes data + pagination
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// GET TIME LOG BY ID
// ===============================
exports.getTimeLog = async (req, res) => {
  try {
    const data = await timeTrackingService.getTimeLogById(req.params.id);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// UPDATE TIME LOG
// ===============================
exports.updateTimeLog = async (req, res) => {
  try {
    const data = await timeTrackingService.updateTimeLog(
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Time log updated successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// DELETE TIME LOG
// ===============================
exports.deleteTimeLog = async (req, res) => {
  try {
    await timeTrackingService.deleteTimeLog(req.params.id);

    return res.status(204).send();
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};
