const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const { default: mongoose } = require("mongoose");
// 🔹 CREATE
exports.createWorkspace = async (data, userId) => {
  const workspace = await Workspace.create({
    name: data.name,
    createdBy: userId,
    members: [
      {
        user: userId,
        role: "manager",
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

// 🔹 GET USER WORKSPACES
exports.getUserWorkspaces = async (userId) => {
  return await Workspace.find({
    "members.user": userId,
    "members.status": "active",
  });
};

// 🔹 GET ONE
exports.getWorkspaceById = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId).populate(
    "members.user",
    "name email",
  );

  if (!workspace) throw new Error("Workspace not found");

  return workspace;
};

// 🔹 UPDATE
exports.updateWorkspace = async (workspaceId, data) => {
  const workspace = await Workspace.findByIdAndUpdate(
    workspaceId,
    { name: data.name },
    { new: true },
  );

  if (!workspace) throw new Error("Workspace not found");

  return workspace;
};

// 🔹 DELETE
exports.deleteWorkspace = async (workspaceId) => {
  const workspace = await Workspace.findByIdAndDelete(workspaceId);

  if (!workspace) throw new Error("Workspace not found");

  return workspace;
};

// 🔹 ADD MEMBER
exports.addMember = async (workspaceId, userId, role = "member") => {
  const exists = await Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  });

  if (exists) throw new Error("User already exists");

  return await Workspace.findByIdAndUpdate(
    workspaceId,
    {
      $push: {
        members: {
          user: userId,
          role,
        },
      },
    },
    { new: true },
  );
};

// 🔹 REMOVE MEMBER
exports.removeMember = async (workspaceId, userId) => {
  return await Workspace.findByIdAndUpdate(
    workspaceId,
    {
      $pull: {
        members: { user: userId },
      },
    },
    { new: true },
  );
};
