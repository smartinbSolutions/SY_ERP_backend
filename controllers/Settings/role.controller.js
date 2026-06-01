const asyncHandler = require("express-async-handler");
const roleService = require("../../services/Settings/role.service");

/**
 * Create Role
 */
exports.createRole = asyncHandler(async (req, res) => {
  const { name, description, channels, permissions } = req.body;
  const companyId = req.companyId; // assuming from auth middleware

  const role = await roleService.createRole({
    name,
    description,
    channels,
    permissions,
    companyId,
  });

  res.status(201).json({
    status: true,
    data: role,
  });
});

/**
 * Get Roles
 */
exports.getRoles = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const roles = await roleService.getRoles({ companyId });

  res.status(200).json({
    status: true,
    results: roles.length,
    data: roles,
  });
});

/**
 * Get One Role
 */
exports.getRole = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const role = await roleService.getRoleById({
    roleId: id,
    companyId,
  });

  res.status(200).json({
    status: true,
    data: role,
  });
});

/**
 * Update Role
 */
exports.updateRole = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const role = await roleService.updateRole({
    roleId: id,
    companyId,
    updateData: req.body,
  });

  res.status(200).json({
    status: true,
    data: role,
  });
});

/**
 * Delete Role
 */
exports.deleteRole = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;

  await roleService.deleteRole({
    roleId: id,
    companyId,
  });

  res.status(200).json({
    status: true,
    message: "Role deleted successfully",
  });
});
