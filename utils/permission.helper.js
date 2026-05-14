const ROLE_HIERARCHY = {
  viewer: 1,
  member: 2,
  manager: 3,
  owner: 4,
};
const BYPASS_ROLES = ["owner"];
const ROLE_PERMISSIONS = {
  viewer: ["read:workspace", "read:list", "read:folder", "read:task"],

  member: [
    "read:workspace",
    "read:list",
    "read:folder",
    "read:task",
    "create:task",
    "update:task",
  ],

  manager: [
    "read:workspace",
    "update:workspace",

    "create:folder",
    "update:folder",
    "delete:folder",
    "read:folder",

    "create:list",
    "update:list",
    "delete:list",

    "create:task",
    "update:task",
    "delete:task",

    "manage:members",
  ],

  owner: ["*"],
};

const getPermissions = (role) => ROLE_PERMISSIONS[role] || [];

const hasPermission = (role, permission) => {
  const permissions = getPermissions(role);
  if (permissions.includes("*")) return true;
  return permissions.includes(permission);
};

const hasRoleAtLeast = (userRole, requiredRole) => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};

module.exports = {
  getPermissions,
  hasPermission,
  hasRoleAtLeast,
  BYPASS_ROLES,
};
