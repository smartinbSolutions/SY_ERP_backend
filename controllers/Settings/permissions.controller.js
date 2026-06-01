const asyncHandler = require("express-async-handler");
const permissionService = require("../../services/Settings/permissions.service");

exports.getPermissions = asyncHandler(async (req, res) => {
  const { channel } = req.query;
  console.log("channel", channel);
  const grouped = await permissionService.getGroupedPermissions({ channel });

  res.status(200).json({
    status: true,
    data: grouped,
  });
});
