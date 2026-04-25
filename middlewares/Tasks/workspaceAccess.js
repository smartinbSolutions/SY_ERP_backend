const Workspace = require("../../models/Tasks/WorkspaceModel");

// 🔹 SERVICE FUNCTION (داخل نفس الملف أو خارجه)
const isUserInWorkspace = async (workspaceId, userId) => {
  return await Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
    "members.status": "active",
  });
};

// 🔐 MIDDLEWARE
exports.workspaceAccess = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;

    if (!workspaceId) {
      return res.status(400).json({
        message: "Workspace ID required",
      });
    }

    const workspace = await isUserInWorkspace(
      workspaceId,
      req.user._id
    );

    if (!workspace) {
      return res.status(403).json({
        message: "Access denied to this workspace",
      });
    }

    req.workspace = workspace;

    next();
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
};