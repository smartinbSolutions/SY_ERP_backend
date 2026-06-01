const Role = require("../../models/Settings/role.model");
const Permission = require("../../models/Settings/permission.model");
const mongoose = require("mongoose");

/**
 * Create Role
 */
const createRole = async ({
  name,
  description,
  channels,
  permissions,
  companyId,
}) => {
  // Validate permissions belong to same company scope if needed
  if (permissions && permissions.length > 0) {
    const validPermissions = await Permission.find({
      _id: { $in: permissions },
    });

    if (validPermissions.length !== permissions.length) {
      throw new Error("One or more permissions are invalid");
    }
  }

  const role = await Role.create({
    name,
    description,
    channels,
    permissions,
    companyId,
  });

  return role;
};

/**
 * Get all roles per company
 */
const getRoles = async ({ companyId }) => {
  return Role.find({ companyId, active: true })
    .populate("permissions")
    .sort({ createdAt: -1 });
};

/**
 * Get single role
 */
const getRoleById = async ({ roleId, companyId }) => {
  const role = await Role.findOne({
    _id: roleId,
    companyId,
  }).populate("permissions");

  if (!role) {
    throw new Error("Role not found");
  }

  return role;
};

/**
 * Update Role
 */
const updateRole = async ({ roleId, companyId, updateData }) => {
  const role = await Role.findOneAndUpdate(
    { _id: roleId, companyId },
    updateData,
    { new: true }
  ).populate("permissions");

  if (!role) {
    throw new Error("Role not found");
  }

  return role;
};

/**
 * Soft delete role
 */
const deleteRole = async ({ roleId, companyId }) => {
  const role = await Role.findOneAndUpdate(
    { _id: roleId, companyId },
    { status: "inactive", active: false },
    { new: true }
  );

  if (!role) {
    throw new Error("Role not found");
  }

  return role;
};

module.exports = {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
