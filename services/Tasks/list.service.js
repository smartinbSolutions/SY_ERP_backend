const mongoose = require("mongoose");
const List = require("../../models/Tasks/ListModel");
const Workspace = require("../../models/Tasks/WorkspaceModel");

// ===============================
// HELPER
// ===============================
const isMember = (workspace, userId) => {
  return workspace.members?.some(
    (m) => m.user.toString() === userId.toString() && m.status === "active",
  );
};

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!data.workspace) throw new Error("Workspace is required");
  if (!data.folder) throw new Error("Folder is required");

  const workspace = await Workspace.findOne({
    _id: data.workspace,
    companyId,
  });

  if (!workspace) throw new Error("Workspace not found");

  if (!isMember(workspace, userId)) {
    throw new Error("Not in workspace");
  }

  const list = await List.create({
    name: data.name.trim(),
    folder: data.folder,
    workspace: data.workspace,
    companyId,
    visibility: data.visibility || "private",
    createdBy: userId,
    order: data.order || 0,
    members: [
      {
        user: userId,
        role: "manager", 
      },
    ],
  });

  return list;
};

// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (listId, data, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");

  const list = await List.findOne({
    _id: listId,
    companyId,
  });

  if (!list) throw new Error("List not found");

  const isManager = list.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "manager",
  );

  if (!isManager) {
    throw new Error("Only manager can update list");
  }

  if (data.name) list.name = data.name.trim();
  if (data.visibility) list.visibility = data.visibility;
  if (data.order !== undefined) list.order = data.order;

  await list.save();

  return list;
};

// ===============================
// DELETE LIST
// ===============================
exports.deleteList = async (listId, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");

  const list = await List.findOne({
    _id: listId,
    companyId,
  });

  if (!list) throw new Error("List not found");

  const isManager = list.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "manager",
  );

  if (!isManager) {
    throw new Error("Only manager can delete list");
  }

  await list.deleteOne();

  return true;
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (listId, targetUserId, role, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");

  const list = await List.findOne({
    _id: listId,
    companyId,
  });

  if (!list) throw new Error("List not found");

  const isManager = list.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "manager",
  );

  if (!isManager) {
    throw new Error("Only manager can add members");
  }

  const exists = list.members?.some(
    (m) => m.user.toString() === targetUserId.toString(),
  );

  if (exists) {
    throw new Error("User already exists");
  }

  list.members.push({
    user: targetUserId,
    role: role || "viewer",
  });

  await list.save();

  return list;
};
