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

  // 🔥 members من request
  const members = data.members || [];

  // 🔥 تنظيف + منع التكرار
  const uniqueMembers = [];
  const seen = new Set();

  for (const m of members) {
    const id = String(m.user);

    if (!seen.has(id) && id !== String(userId)) {
      seen.add(id);

      uniqueMembers.push({
        user: m.user,
        role: m.role || "member",
      });
    }
  }

  // 🔥 creator دائمًا owner
  const finalMembers = [
    {
      user: userId,
      role: "owner",
    },
    ...uniqueMembers,
  ];

  const workspace = await Workspace.create({
    name: data.name.trim(),
    companyId,
    createdBy: userId,
    members: finalMembers,
  });

  return workspace;
};

exports.getUserWorkspaceTree = async (userId) => {
  const normalize = (id) => id?.toString();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  /* =========================
     1. Workspaces (direct membership)
  ========================= */
  const workspaces = await Workspace.find({
    "members.user": userObjectId,
  }).lean();

  const workspaceIds = workspaces.map((w) => w._id);

  const workspaceRoleMap = {};

  workspaces.forEach((ws) => {
    const member = (ws.members || []).find(
      (m) => m.user?.toString() === userId.toString()
    );

    workspaceRoleMap[ws._id.toString()] = member?.role || "viewer";
  });

  /* =========================
     2. Lists where user is member
  ========================= */
  const memberLists = await List.find({
    "members.user": userObjectId,
  }).lean();

  const extraWorkspaceIds = [
    ...new Set(memberLists.map((l) => normalize(l.workspace))),
  ];

  /* =========================
     3. Fetch missing workspaces
  ========================= */
  const missingWorkspaceIds = extraWorkspaceIds.filter(
    (id) => !workspaceIds.map(normalize).includes(id)
  );

  const extraWorkspaces = await Workspace.find({
    _id: { $in: missingWorkspaceIds },
  }).lean();

  /* =========================
     4. Fetch folders
  ========================= */
  const allWorkspaceIds = [
    ...workspaceIds,
    ...missingWorkspaceIds,
  ];

  const folders = await Folder.find({
    workspace: { $in: allWorkspaceIds },
  }).lean();

  /* =========================
     5. Fetch lists (all for members + workspace lists)
  ========================= */
  const lists = await List.find({
    workspace: { $in: allWorkspaceIds },
  }).lean();

  /* =========================
     6. Build folder map
  ========================= */
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

  /* =========================
     7. Distribute lists
  ========================= */
  lists.forEach((list) => {
    const wsId = normalize(list.workspace);
    const fId = normalize(list.folder);

    const folder = folderMap?.[wsId]?.[fId];
    if (!folder) return;

    const wsRole = workspaceRoleMap[wsId];

    const listMembers = Array.isArray(list.members) ? list.members : [];

    const listMember = listMembers.find(
      (m) => m.user?.toString() === userId.toString()
    );

    const isWorkspaceMember = !!wsRole;
    const isListMember = !!listMember;

    let canAccess = false;

    if (isWorkspaceMember) {
      // normal behavior
      if (list.visibility === "public") canAccess = true;
      else if (isListMember) canAccess = true;
      else if (["owner", "manager"].includes(wsRole)) canAccess = true;
    } else {
      // 🔥 new rule
      if (isListMember) {
        canAccess = true;

        // ❗ important: restrict folder to this list only
        folder.lists = [];
      }
    }

    if (!canAccess) return;

    folder.lists.push({
      _id: list._id,
      name: list.name,
      visibility: list.visibility,
      workspaceRole: wsRole || null,
      listRole: listMember?.role || null,
      order: list.order,
    });
  });

  /* =========================
     8. Build final tree
  ========================= */
  const allWorkspaces = [...workspaces, ...extraWorkspaces];

  const tree = allWorkspaces.map((ws) => {
    const wsId = normalize(ws._id);
    const wsRole = workspaceRoleMap[wsId] || null;

    let foldersObj = folderMap[wsId] || {};

    // 🔥 critical: filter folders if not workspace member
    if (!wsRole) {
      foldersObj = Object.fromEntries(
        Object.entries(foldersObj).filter(([_, folder]) => {
          return folder.lists.length > 0;
        })
      );
    }

    return {
      _id: ws._id,
      name: ws.name,
      role: wsRole,
      folders: Object.values(foldersObj),
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
    "fullName email",
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
