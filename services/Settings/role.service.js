const Role = require("../../models/Settings/role.model");
const Permission = require("../../models/Settings/permission.model");
const ApiError = require("../../utils/apiError");
const mongoose = require("mongoose");

const normalizePermissions = (permissions = []) => [
  ...new Set(permissions.map((permission) => String(permission))),
];

const validatePermissions = async (permissions) => {
  const normalizedPermissions = normalizePermissions(permissions);

  if (normalizedPermissions.length === 0) {
    throw new ApiError("At least one permission is required", 400);
  }

  if (
    normalizedPermissions.some(
      (permission) => !mongoose.Types.ObjectId.isValid(permission),
    )
  ) {
    throw new ApiError("One or more permissions are invalid", 400);
  }

  const validPermissions = await Permission.find({
    _id: { $in: normalizedPermissions },
  }).select("_id");

  if (validPermissions.length !== normalizedPermissions.length) {
    throw new ApiError("One or more permissions are invalid", 400);
  }

  return normalizedPermissions;
};

const buildRolePayload = async (data) => {
  const payload = {
    name: data.name,
    description: data.description,
    channels: data.channels,
  };

  if (data.permissions) {
    payload.permissions = await validatePermissions(data.permissions);
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });

  return payload;
};

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
  if (!permissions) {
    throw new ApiError("At least one permission is required", 400);
  }

  const rolePayload = await buildRolePayload({
    name,
    description,
    channels,
    permissions,
  });

  const role = await Role.create({
    ...rolePayload,
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
  const rolePayload = await buildRolePayload(updateData);

  const role = await Role.findOneAndUpdate(
    { _id: roleId, companyId },
    rolePayload,
    { new: true }
  ).populate("permissions");

  if (!role) {
    throw new ApiError("Role not found", 404);
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
    throw new ApiError("Role not found", 404);
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
