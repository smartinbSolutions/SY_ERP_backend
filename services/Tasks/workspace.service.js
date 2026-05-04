const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const { default: mongoose } = require("mongoose");
const staffModel = require("../../models/Hr/staffModel");

exports.createWorkspace = async (data, userId, companyId) => {
  if (!companyId) {
    throw new Error("Company ID is required");
  }

  const exists = await Workspace.findOne({
    name: data.name.trim(),
    companyId,
  });

  if (exists) {
    throw new Error("Workspace with this name already exists");
  }

  const workspace = await Workspace.create({
    name: data.name.trim(),
    companyId,
    createdBy: userId,

    members: [
      {
        user: userId,
        role: "owner",
      },
    ],
  });

  return workspace;
};

exports.getUserWorkspaceTree = async (userId) => {
  const normalize = (id) => id?.toString();

  const userObjectId = new mongoose.Types.ObjectId(userId);

  // 1. workspaces الخاصة بالمستخدم
  const workspaces = await Workspace.find({
    "members.user": userObjectId,
  }).lean();

  const workspaceIds = workspaces.map((w) => w._id);

  // 2. folders
  const folders = await Folder.find({
    workspace: { $in: workspaceIds },
  })
    .sort({ order: 1 })
    .lean();

  // 3. lists
  const lists = await List.find({
    workspace: { $in: workspaceIds },
  })
    .sort({ order: 1 })
    .lean();

  // 4. بناء index مضبوط للفولدرات
  const folderMap = {};

  folders.forEach((f) => {
    const wsId = normalize(f.workspace);
    const fId = normalize(f._id);

    if (!folderMap[wsId]) folderMap[wsId] = {};

    folderMap[wsId][fId] = {
      ...f,
      lists: [],
    };
  });

  // 5. توزيع الـ lists بشكل صحيح
  lists.forEach((list) => {
    const wsId = normalize(list.workspace);
    const fId = normalize(list.folder);

    const folder = folderMap?.[wsId]?.[fId];

    if (folder) {
      folder.lists.push(list);
    }
  });

  // 6. بناء الـ tree النهائي
  const tree = workspaces.map((ws) => {
    const wsId = normalize(ws._id);

    const wsFoldersObj = folderMap[wsId] || {};

    return {
      _id: ws._id,
      name: ws.name,
      folders: Object.values(wsFoldersObj),
    };
  });

  return tree;
};

exports.getUserWorkspaces = async (userId) => {
  return await Workspace.find({
    "members.user": userId,
    "members.status": "active",
  });
};

exports.getWorkspaceById = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId).populate(
    "members.user",
    "name email",
  );

  if (!workspace) throw new Error("Workspace not found");

  return workspace;
};

exports.updateWorkspace = async (workspaceId, data) => {
  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { name: data.name },
    { new: true },
  );

  if (!workspace) throw new Error("Workspace not found");

  return workspace;
};

exports.deleteWorkspace = async (workspaceId) => {
  const workspace = await Workspace.findByIdAndDelete(workspaceId);

  if (!workspace) throw new Error("Workspace not found");

  return workspace;
};

exports.addMember = async (workspaceId, userId, role = "member") => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const staff = await staffModel.findById(userId);
  if (!staff) {
    throw new Error("User not found");
  }

  const exists = workspace.members.some(
    (m) => m.user.toString() === userId.toString(),
  );

  if (exists) {
    throw new Error("User already exists in workspace");
  }

  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspaceId,
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

  return updatedWorkspace;
};

exports.removeMember = async (workspaceId, userId) => {
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const member = workspace.members.find(
    (m) => m.user.toString() === userId.toString(),
  );

  if (!member) {
    throw new Error("User is not a member of this workspace");
  }

  const owners = workspace.members.filter((m) => m.role === "owner");

  if (member.role === "owner" && owners.length === 1) {
    throw new Error("Cannot remove the last owner");
  }

  const updatedWorkspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    {
      $pull: {
        members: { user: userId },
      },
    },
    { new: true },
  );

  return updatedWorkspace;
};
