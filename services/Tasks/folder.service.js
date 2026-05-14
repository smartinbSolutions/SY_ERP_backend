const Folder = require("../../models/Tasks/FolderModel");
const staffModel = require("../../models/Hr/staffModel");

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

    visibility: data.visibility || "private",

    order: data.order || 0,

    members:
      data.visibility === "private"
        ? [
            {
              user: userId,
              role: "owner",
              joinedAt: new Date(),
            },
          ]
        : [],
  });

  return folder;
};

// ===============================
// GET FOLDERS BY WORKSPACE
// ===============================
exports.getFoldersByWorkspace = async (workspace, userId, workspaceRole) => {
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const isWorkspaceAdmin = ["owner", "manager"].includes(workspaceRole);

  // ======================================
  // 1. ADMIN (OWNER / MANAGER)
  // ======================================
  if (isWorkspaceAdmin) {
    return await Folder.find({
      workspace: workspace._id,
    }).sort({ order: 1 });
  }

  // ======================================
  // 2. NORMAL USER
  // ======================================
  return await Folder.find({
    workspace: workspace._id,
    $or: [{ visibility: "public" }, { "members.user": userId }],
  }).sort({ order: 1 });
};
// ===============================
// GET FOLDER BY ID
// ===============================

exports.getFolderById = async (folderId, userId, workspaceRole) => {
  const folder = await Folder.findById(folderId).populate(
    "members.user",
    "fullName email",
  );

  if (!folder) {
    throw new Error("Folder not found");
  }

  const isWorkspaceAdmin = ["owner", "manager"].includes(workspaceRole);

  if (isWorkspaceAdmin) return folder;

  const isMember = folder.members?.some(
    (m) => m.user.toString() === userId.toString(),
  );

  if (folder.visibility === "public" || isMember) {
    return folder;
  }

  throw new Error("Folder access denied");
};

// ===============================
// UPDATE FOLDER
// ===============================
exports.updateFolder = async (folderId, data, userId, workspaceRole) => {
  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new Error("Folder not found");
  }

  const isWorkspaceAdmin = ["owner", "manager"].includes(workspaceRole);

  const isOwner = folder.members?.some(
    (m) => m.user.toString() === userId.toString() && m.role === "owner",
  );

  if (!isWorkspaceAdmin && !isOwner) {
    throw new Error("Not allowed to update folder");
  }

  if (data.name) folder.name = data.name.trim();
  if (data.order !== undefined) folder.order = data.order;
  if (data.visibility) folder.visibility = data.visibility;

  await folder.save();

  return folder;
};
// ===============================
// DELETE FOLDER
// ===============================
exports.deleteFolder = async (folderId) => {
  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new Error("Folder not found");
  }

  await folder.deleteOne();

  return true;
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (folderId, userId, role = "member") => {
  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new Error("Folder not found");
  }

  const staff = await staffModel.findById(userId);

  if (!staff) {
    throw new Error("User not found");
  }

  const exists = folder.members.some(
    (m) => m.user.toString() === userId.toString(),
  );

  if (exists) {
    throw new Error("User already exists in folder");
  }

  const updatedFolder = await Folder.findByIdAndUpdate(
    folderId,
    {
      $addToSet: {
        members: {
          user: userId,
          role,
        },
      },
    },
    { new: true },
  );

  return updatedFolder;
};

// ===============================
// REMOVE MEMBER
// ===============================
exports.removeMember = async (folderId, userId) => {
  const folder = await Folder.findById(folderId);

  if (!folder) {
    throw new Error("Folder not found");
  }

  const member = folder.members.find(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!member) {
    throw new Error("User is not a member of this folder");
  }

  const owners = folder.members.filter((m) => m.role === "owner");

  if (member.role === "owner" && owners.length === 1) {
    throw new Error("Cannot remove the last owner");
  }

  const updatedFolder = await Folder.findByIdAndUpdate(
    folderId,
    {
      $pull: {
        members: { user: userId },
      },
    },
    { new: true },
  );

  return updatedFolder;
};
