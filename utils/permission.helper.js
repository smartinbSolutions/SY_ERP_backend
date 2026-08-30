const ROLE_HIERARCHY = {
  viewer: 1,
  member: 2,
  manager: 3,
  owner: 4,
};

/*
 * Owner وManager ينفذان كل العمليات،
 * لكن فقط بعد أن يحدد AccessMiddleware نطاقهما.
 */
const BYPASS_ROLES = ["owner", "manager"];

const ROLE_PERMISSIONS = {
  viewer: [
    "read:workspace",
    "read:folder",
    "read:list",
    "read:task",

    "read:comment",
    "read:attachment",
    "read:time-log",
  ],

  member: [
    "read:workspace",
    "read:folder",
    "read:list",
    "read:task",

    /*
     * إنشاء Task وSubtask.
     * Routes الخاصة بالـSubtask تستخدم create:task.
     */
    "create:task",
    "update:task",

    /*
     * المشاركة داخل المهمة.
     */
    "read:comment",
    "create:comment",
    "update:comment",
    "delete:comment",

    "read:attachment",
    "create:attachment",
    "delete:attachment",

    "read:time-log",
    "create:time-log",
    "update:time-log",
    "delete:time-log",
  ],

  manager: ["*"],
  owner: ["*"],
};

const getPermissions = (role) => {
  return ROLE_PERMISSIONS[role] || [];
};

const hasPermission = (role, permission) => {
  const permissions = getPermissions(role);

  if (permissions.includes("*")) {
    return true;
  }

  return permissions.includes(permission);
};

const hasRoleAtLeast = (userRole, requiredRole) => {
  const userLevel = ROLE_HIERARCHY[userRole];
  const requiredLevel = ROLE_HIERARCHY[requiredRole];

  if (!userLevel || !requiredLevel) {
    return false;
  }

  return userLevel >= requiredLevel;
};


const getHighestRole = (...roles) => {
  return roles
    .filter((role) => ROLE_HIERARCHY[role])
    .reduce((highestRole, currentRole) => {
      if (!highestRole) {
        return currentRole;
      }

      return ROLE_HIERARCHY[currentRole] > ROLE_HIERARCHY[highestRole]
        ? currentRole
        : highestRole;
    }, null);
};

module.exports = {
  ROLE_HIERARCHY,
  getPermissions,
  hasPermission,
  hasRoleAtLeast,
  getHighestRole,
  BYPASS_ROLES,
};
