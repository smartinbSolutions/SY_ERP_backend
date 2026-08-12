const Permission = require("../../models/Settings/permission.model");

const FEATURE_TO_MODULE = {
  pos: ["pos", "pos system"],
  resturant: ["resturant", "restaurant management"],
};

const getGroupedPermissions = async (features) => {

const allowedModules = Object.entries(features)
  .filter(([_, enabled]) => enabled)
  .flatMap(([feature]) => FEATURE_TO_MODULE[feature] || [feature]);



  const permissions = await Permission.find({
    $or: [{ module: { $in: allowedModules } }, { module: "settings" }],
  })
    .sort({ module: 1, group: 1, title: 1 })
    .lean();

  const grouped = {};

  permissions.forEach((perm) => {
    if (!grouped[perm.module]) grouped[perm.module] = {};
    const groupName = perm.group || "general";
    if (!grouped[perm.module][groupName]) grouped[perm.module][groupName] = [];
    grouped[perm.module][groupName].push(perm);
  });

  return grouped;
};
module.exports = {
  getGroupedPermissions,
};