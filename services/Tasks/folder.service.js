const Folder = require("../../models/Tasks/FolderModel");
const Workspace = require("../../models/Tasks/WorkspaceModel");

exports.createFolder = async (data, userId) => {
  if (!data.workspace) {
    throw new Error("Workspace ID is required");
  }

  const workspace = await Workspace.findById(data.workspace);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId.toString() && m.status === "active",
  );

  
  if (!isMember) {
    throw new Error("Not allowed in this workspace");
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

exports.getFoldersByWorkspace = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) throw new Error("Workspace not found");

  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!isMember) throw new Error("Access denied");

  return await Folder.find({
    workspace: workspaceId,
  }).sort({ order: 1 });
};

exports.updateFolder = async (folderId, data, userId) => {
  const folder = await Folder.findById(folderId);

  if (!folder) throw new Error("Folder not found");

  const workspace = await Workspace.findById(folder.workspace);

  const isMember = workspace.members.some(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!isMember) throw new Error("Access denied");

  if (data.name) folder.name = data.name.trim();
  if (data.order !== undefined) folder.order = data.order;

  await folder.save();

  return folder;
};

exports.deleteFolder = async (folderId, userId) => {
  const folder = await Folder.findById(folderId);

  if (!folder) throw new Error("Folder not found");

  const workspace = await Workspace.findById(folder.workspace);

  const isManager = workspace.members.some(
    (m) => m.user.toString() === userId.toString() && m.role === "manager",
  );

  if (!isManager) {
    throw new Error("Only manager can delete folder");
  }

  await folder.deleteOne();

  return true;
};
