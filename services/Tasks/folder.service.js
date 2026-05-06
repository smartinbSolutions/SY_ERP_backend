const Folder = require("../../models/Tasks/FolderModel");

// ===============================
// CREATE FOLDER
// ===============================
exports.createFolder = async (data, userId, workspace) => {
  if (!workspace) {
    throw new Error("Workspace is required");
  }

  const folder = await Folder.create({
    name: data.name.trim(),
    workspace: workspace._id,
    companyId: workspace.companyId,
    createdBy: userId,
    order: data.order || 0,
  });

  return folder;
};

// ===============================
// GET FOLDERS BY WORKSPACE
// ===============================
exports.getFoldersByWorkspace = async (workspace, userId) => {
  if (!workspace) throw new Error("Workspace not found");

  return await Folder.find({
    workspace: workspace._id,
  }).sort({ order: 1 });
};

// ===============================
// UPDATE FOLDER
// ===============================
exports.updateFolder = async (folderId, data, userId, workspace) => {
  const folder = await Folder.findById(folderId);

  if (!folder) throw new Error("Folder not found");

  // 🔥 ensure folder belongs to workspace (safety layer)
  if (folder.workspace.toString() !== workspace._id.toString()) {
    throw new Error("Folder does not belong to this workspace");
  }

  if (data.name) folder.name = data.name.trim();
  if (data.order !== undefined) folder.order = data.order;

  await folder.save();

  return folder;
};

// ===============================
// DELETE FOLDER
// ===============================
exports.deleteFolder = async (folderId, userId, workspaceRole, workspace) => {
  const folder = await Folder.findById(folderId);

  if (!folder) throw new Error("Folder not found");

  // 🔥 ensure ownership scope
  if (folder.workspace.toString() !== workspace._id.toString()) {
    throw new Error("Folder does not belong to this workspace");
  }

  // 🔐 business rule: only manager/owner can delete
  const allowed = workspaceRole === "manager" || workspaceRole === "owner";

  if (!allowed) {
    throw new Error("Only manager or owner can delete folder");
  }

  await folder.deleteOne();

  return true;
};
