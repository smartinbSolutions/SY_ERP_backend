const List = require("../../models/Tasks/ListModel");
const Workspace = require("../../models/Tasks/WorkspaceModel");

// ===============================
// HELPER: workspace membership
// ===============================
const isMember = (workspace, userId) => {
  return workspace.members?.some(
    (m) => m.user.toString() === userId.toString() && m.status === "active",
  );
};

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId) => {
  if (!data.name) throw new Error("Name is required");
  if (!data.workspace) throw new Error("Workspace is required");
  if (!data.folder) throw new Error("Folder is required");

  const workspace = await Workspace.findById(data.workspace);

  if (!workspace) throw new Error("Workspace not found");

  if (!isMember(workspace, userId)) {
    throw new Error("Not in workspace");
  }

  const list = await List.create({
    name: data.name.trim(),
    folder: data.folder,
    workspace: data.workspace,
    visibility: data.visibility || "private",
    createdBy: userId,

    members: [
      {
        user: userId,
        role: "admin",
      },
    ],
  });

  return list;
};

// ===============================
// GET LISTS BY WORKSPACE
// ===============================
exports.getListsByWorkspace = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) throw new Error("Workspace not found");

  if (!isMember(workspace, userId)) {
    throw new Error("Access denied");
  }

  return await List.find({ workspace: workspaceId }).sort({ order: 1 });
};

// ===============================
// GET ONE LIST
// ===============================
exports.getListById = async (listId, userId) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const workspace = await Workspace.findById(list.workspace);

  if (!workspace) throw new Error("Workspace not found");

  if (!isMember(workspace, userId)) {
    throw new Error("Workspace access denied");
  }

  if (list.visibility === "public") return list;

  const isListMember = list.members?.some(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!isListMember) {
    throw new Error("List access denied");
  }

  return list;
};

// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (listId, data, userId) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const isAdmin = list.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "admin",
  );

  if (!isAdmin) {
    throw new Error("Only admin can update list");
  }

  list.name = data.name ?? list.name;
  list.visibility = data.visibility ?? list.visibility;

  await list.save();

  return list;
};

// ===============================
// DELETE LIST
// ===============================
exports.deleteList = async (listId, userId) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const isAdmin = list.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "admin",
  );

  if (!isAdmin) {
    throw new Error("Only admin can delete list");
  }

  await list.deleteOne();

  return true;
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (listId, targetUserId, role, userId) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const isAdmin = list.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "admin",
  );

  if (!isAdmin) {
    throw new Error("Only admin can add members");
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
