const ROLE_HIERARCHY = {
  viewer: 1,
  member: 2,
  manager: 3,
  owner: 4,
};

// high level role bypass (important)
const BYPASS_ROLES = ["owner", "manager"];

// simple rule map (default permissions)
const ROLE_PERMISSIONS = {
  viewer: ["read"],
  member: ["read", "create", "update"],
  manager: ["read", "create", "update", "delete", "manage"],
  owner: ["*"],
};

// GET PERMISSIONS

const getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

// CHECK PERMISSION

const hasPermission = (role, action) => {
  const permissions = getPermissions(role);

  if (permissions.includes("*")) return true;

  return permissions.includes(action);
};

// ROLE LEVEL CHECK

const hasRoleAtLeast = (userRole, requiredRole) => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

module.exports = {
  getPermissions,
  hasPermission,
  hasRoleAtLeast,
  BYPASS_ROLES,
};
