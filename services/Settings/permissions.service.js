const Permission = require("../../models/Settings/permission.model");

const getGroupedPermissions = async ({ channel }) => {
  let filter = {};

  if (channel === "pos") {
    // Only POS permissions
    filter.module = "pos";
  }

  if (channel === "dashboard") {
    // Everything except POS
    filter.module = { $ne: "pos" };
  }

  // dash-pos → no filter (return all)

  const permissions = await Permission.find(filter)
    .sort({ module: 1, group: 1, title: 1 })
    .lean();

  const grouped = {};

  permissions.forEach((perm) => {
    if (!grouped[perm.module]) {
      grouped[perm.module] = {};
    }

    const groupName = perm.group || "general";

    if (!grouped[perm.module][groupName]) {
      grouped[perm.module][groupName] = [];
    }

    grouped[perm.module][groupName].push(perm);
  });

  return grouped;
};

module.exports = {
  getGroupedPermissions,
};
