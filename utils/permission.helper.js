const PERMISSIONS = {
  viewer: ["read:task", "read:comment"],
  member: ["read:task", "create:task", "update:task", "create:comment"],
  manager: [
    "read:task",
    "create:task",
    "update:task",
    "delete:task",
    "manage:members",
  ],
};

// get all permissions for a role
const getPermissions = (role) => {
  return PERMISSIONS[role] || [];
};

// check if role has a specific permission
const hasPermission = (role, permission) => {
  const permissions = getPermissions(role);
  return permissions.includes(permission);
};

module.exports = {
  PERMISSIONS,
  getPermissions,
  hasPermission,
};
