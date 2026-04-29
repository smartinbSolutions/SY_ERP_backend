const { hasPermission } = require("../../utils/permission.helper");

// ======================================
const checkPermission = (permission) => {
  return (req, res, next) => {
    // role must come from workspace (not global)
    const role = req.workspaceRole || req.user.role; // fallback for now

    if (!role) {
      return res.status(403).json({
        success: false,
        message: "Role not found",
      });
    }

    // check permission
    const allowed = hasPermission(role, permission);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: "Permission denied",
      });
    }

    next();
  };
};

module.exports = checkPermission;
