const workspaceService = require("../../services/Tasks/workspace.service");

// ===============================
// CREATE WORKSPACE
// ===============================
exports.createWorkspace = async (req, res) => {
  try {
    const data = await workspaceService.createWorkspace(
      req.body,
      req.user._id,
      req.query.companyId, // 🔥 ممكن نحسّنها لاحقًا
    );

    return res.status(201).json({
      success: true,
      message: "Workspace created successfully",
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
// GET USER WORKSPACE TREE
// ===============================
exports.getUserWorkspaceTree = async (req, res) => {
  try {
    const data = await workspaceService.getUserWorkspaceTree(
      req.user._id,
      req.user.companyId,
    );

    return res.status(200).json({
      success: true,
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
// GET MY WORKSPACES
// ===============================
exports.getMyWorkspaces = async (req, res) => {
  try {
    const data = await workspaceService.getUserWorkspaces(req.user._id);

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

// ===============================
// GET WORKSPACE BY ID
// ===============================
exports.getWorkspace = async (req, res) => {
  try {
    const data = await workspaceService.getWorkspaceById(
      req.params.workspaceId, // ✅ FIX
    );

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
// UPDATE WORKSPACE
// ===============================
exports.updateWorkspace = async (req, res) => {
  try {
    const data = await workspaceService.updateWorkspace(
      req.params.workspaceId, // ✅ FIX
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Workspace updated successfully",
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
// DELETE WORKSPACE
// ===============================
exports.deleteWorkspace = async (req, res) => {
  try {
    await workspaceService.deleteWorkspace(
      req.params.workspaceId, // ✅ FIX
    );

    return res.status(204).send();
  } catch (err) {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (req, res) => {
  try {
    const data = await workspaceService.addMember(
      req.params.workspaceId,
      req.body.userId,
      req.body.role,
      req.body.notificationsEnabled,
    );

    return res.status(200).json({
      success: true,
      message: "Member added successfully",
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
// REMOVE MEMBER
// ===============================
exports.removeMember = async (req, res) => {
  try {
    const data = await workspaceService.removeMember(
      req.params.workspaceId, // ✅ FIX
      req.params.userId,
    );

    return res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};
