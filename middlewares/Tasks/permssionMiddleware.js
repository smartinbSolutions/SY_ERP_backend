const {
  hasPermission,
  BYPASS_ROLES,
  hasRoleAtLeast,
} = require("../../utils/permission.helper");

const checkPermission = (action, requiredRole = null) => {
  return (req, res, next) => {
    const role = req.workspaceRole || req.listRole;
    
    if (!role) {
      return res.status(403).json({
        success: false,
        message: "No role found",
      });
    }

    //  global bypass (owner/manager)
    if (BYPASS_ROLES.includes(role)) {
      return next();
    }

    //  role-based check
    const allowed = hasPermission(role, action);

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${action}`,
      });
    }

    //   optional role level check (if needed)
    if (requiredRole) {
      if (!hasRoleAtLeast(role, requiredRole)) {
        return res.status(403).json({
          success: false,
          message: "Insufficient role level",
        });
      }
    }

    next();
  };
};

module.exports = checkPermission;
