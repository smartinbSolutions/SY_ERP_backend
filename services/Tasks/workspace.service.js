const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const { default: mongoose } = require("mongoose");
const staffModel = require("../../models/Hr/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");

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

  // =========================
  // MEMBER NOTIFICATIONS
  // =========================

  if (uniqueMembers.length > 0) {
    const notifications = uniqueMembers.map((member) => ({
      recipient: member.user,

      actor: userId,

      type: "workspace.member_added",

      title: "Added to Workspace",

      message: `You were added to workspace "${workspace.name}"`,

      entity: {
        id: workspace._id,
        model: "Workspace",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return workspace;
};

exports.getUserWorkspaceTree = async (userId, companyId) => {
  const mongoose = require("mongoose");

  const normalize = (id) => id?.toString();
  const userObjectId = new mongoose.Types.ObjectId(userId);

  console.log("\n================ TREE DEBUG START ================\n");

  console.log("TREE DEBUG: INPUT", {
    userId: normalize(userObjectId),
    companyId,
  });

  /* ======================================================
     1. MEMBERSHIPS
  ====================================================== */

  const workspaceMemberships = await Workspace.find({
    companyId,
    members: {
      $elemMatch: {
        user: userObjectId,
      },
    },
  }).lean();

  const folderMemberships = await Folder.find({
    companyId,
    members: {
      $elemMatch: {
        user: userObjectId,
      },
    },
  }).lean();

  const listMemberships = await List.find({
    companyId,
    members: {
      $elemMatch: {
        user: userObjectId,
      },
    },
  }).lean();

  const publicLists = await List.find({
    companyId,
    visibility: "public",
  }).lean();

  console.log("TREE DEBUG: memberships", {
    workspaceMemberships: workspaceMemberships.length,
    folderMemberships: folderMemberships.length,
    listMemberships: listMemberships.length,
    publicLists: publicLists.length,
  });

  /* ======================================================
     2. VISIBILITY SETS
  ====================================================== */

  const visibleWorkspaceIds = new Set();
  const visibleFolderIds = new Set();
  const visibleListIds = new Set();

  const workspaceRoleMap = {};
  const folderRoleMap = {};
  const listRoleMap = {};

  /* ======================================================
     3. WORKSPACE MEMBERS
     -> FULL WORKSPACE ACCESS
  ====================================================== */

  workspaceMemberships.forEach((ws) => {
    const wsId = normalize(ws._id);

    visibleWorkspaceIds.add(wsId);

    const member = ws.members?.find(
      (m) => normalize(m.user) === normalize(userObjectId),
    );

    workspaceRoleMap[wsId] = member?.role || "viewer";

    console.log("TREE DEBUG: workspace access", {
      workspace: ws.name,
      role: workspaceRoleMap[wsId],
    });
  });

  /* ======================================================
     4. FOLDER MEMBERS
     -> FOLDER + PARENT WORKSPACE
  ====================================================== */

  folderMemberships.forEach((folder) => {
    const folderId = normalize(folder._id);
    const wsId = normalize(folder.workspace);

    visibleFolderIds.add(folderId);
    visibleWorkspaceIds.add(wsId);

    const member = folder.members?.find(
      (m) => normalize(m.user) === normalize(userObjectId),
    );

    folderRoleMap[folderId] = member?.role || "viewer";

    console.log("TREE DEBUG: folder access", {
      folder: folder.name,
      role: folderRoleMap[folderId],
      workspaceId: wsId,
    });
  });

  /* ======================================================
     5. LIST MEMBERS
     -> LIST + FOLDER + WORKSPACE
  ====================================================== */

  listMemberships.forEach((list) => {
    const listId = normalize(list._id);
    const folderId = normalize(list.folder);
    const wsId = normalize(list.workspace);

    visibleListIds.add(listId);
    visibleFolderIds.add(folderId);
    visibleWorkspaceIds.add(wsId);

    const member = list.members?.find(
      (m) => normalize(m.user) === normalize(userObjectId),
    );

    listRoleMap[listId] = member?.role || "viewer";

    console.log("TREE DEBUG: list access", {
      list: list.name,
      role: listRoleMap[listId],
      folderId,
      workspaceId: wsId,
    });
  });

  /* ======================================================
     6. PUBLIC LISTS
     -> LIST + PATH
  ====================================================== */

  publicLists.forEach((list) => {
    const listId = normalize(list._id);
    const folderId = normalize(list.folder);
    const wsId = normalize(list.workspace);

    visibleListIds.add(listId);
    visibleFolderIds.add(folderId);
    visibleWorkspaceIds.add(wsId);
  });

  console.log("TREE DEBUG: visibility sets", {
    workspaces: visibleWorkspaceIds.size,
    folders: visibleFolderIds.size,
    lists: visibleListIds.size,
  });

  /* ======================================================
     7. FETCH VISIBLE WORKSPACES
  ====================================================== */

  const visibleWorkspaces = await Workspace.find({
    _id: {
      $in: [...visibleWorkspaceIds].map(
        (id) => new mongoose.Types.ObjectId(id),
      ),
    },
  }).lean();

  console.log(
    "TREE DEBUG: visibleWorkspaces fetched",
    visibleWorkspaces.length,
  );

  /* ======================================================
     8. FETCH VISIBLE FOLDERS
  ====================================================== */

  let visibleFolders = [];

  // workspace members see ALL folders
  if (workspaceMemberships.length > 0) {
    const workspaceIds = workspaceMemberships.map((w) => w._id);

    const workspaceFolders = await Folder.find({
      companyId,
      workspace: {
        $in: workspaceIds,
      },
    }).lean();

    visibleFolders.push(...workspaceFolders);

    workspaceFolders.forEach((f) => {
      visibleFolderIds.add(normalize(f._id));
    });

    console.log(
      "TREE DEBUG: workspace folders fetched",
      workspaceFolders.length,
    );
  }

  // directly visible folders
  const directFolders = await Folder.find({
    _id: {
      $in: [...visibleFolderIds].map((id) => new mongoose.Types.ObjectId(id)),
    },
  }).lean();

  visibleFolders.push(...directFolders);

  // remove duplicates
  visibleFolders = Array.from(
    new Map(visibleFolders.map((f) => [normalize(f._id), f])).values(),
  );

  console.log("TREE DEBUG: final visible folders", visibleFolders.length);

  /* ======================================================
     9. FETCH VISIBLE LISTS
  ====================================================== */

  let visibleLists = [];

  // workspace members see ALL lists
  if (workspaceMemberships.length > 0) {
    const workspaceIds = workspaceMemberships.map((w) => w._id);

    const workspaceLists = await List.find({
      companyId,
      workspace: {
        $in: workspaceIds,
      },
    }).lean();

    visibleLists.push(...workspaceLists);

    workspaceLists.forEach((l) => {
      visibleListIds.add(normalize(l._id));
    });

    console.log("TREE DEBUG: workspace lists fetched", workspaceLists.length);
  }

  // folder members see all lists inside folders
  if (folderMemberships.length > 0) {
    const folderIds = folderMemberships.map((f) => f._id);

    const folderLists = await List.find({
      companyId,
      folder: {
        $in: folderIds,
      },
    }).lean();

    visibleLists.push(...folderLists);

    folderLists.forEach((l) => {
      visibleListIds.add(normalize(l._id));
    });

    console.log("TREE DEBUG: folder lists fetched", folderLists.length);
  }

  // direct lists
  const directLists = await List.find({
    _id: {
      $in: [...visibleListIds].map((id) => new mongoose.Types.ObjectId(id)),
    },
  }).lean();

  visibleLists.push(...directLists);

  // remove duplicates
  visibleLists = Array.from(
    new Map(visibleLists.map((l) => [normalize(l._id), l])).values(),
  );

  console.log("TREE DEBUG: final visible lists", visibleLists.length);

  /* ======================================================
     10. BUILD WORKSPACE MAP
  ====================================================== */

  const workspaceMap = {};
  const folderMap = {};

  visibleWorkspaces.forEach((ws) => {
    const wsId = normalize(ws._id);

    workspaceMap[wsId] = {
      _id: ws._id,
      name: ws.name,
      role: workspaceRoleMap[wsId] || null,
      folders: [],
    };
  });

  console.log("TREE DEBUG: workspaceMap built", Object.keys(workspaceMap));

  /* ======================================================
     11. ATTACH FOLDERS
  ====================================================== */

  visibleFolders.forEach((folder) => {
    const folderId = normalize(folder._id);
    const wsId = normalize(folder.workspace);

    if (!workspaceMap[wsId]) {
      console.log("TREE DEBUG: ORPHAN FOLDER", {
        folderId,
        wsId,
      });

      return;
    }

    const folderObj = {
      _id: folder._id,
      name: folder.name,
      visibility: folder.visibility,
      order: folder.order,
      role: folderRoleMap[folderId] || null,
      lists: [],
    };

    folderMap[folderId] = folderObj;

    workspaceMap[wsId].folders.push(folderObj);
  });

  console.log("TREE DEBUG: folderMap size", Object.keys(folderMap).length);

  /* ======================================================
     12. ATTACH LISTS
  ====================================================== */

  visibleLists.forEach((list) => {
    const folderId = normalize(list.folder);
    const listId = normalize(list._id);

    if (!folderMap[folderId]) {
      console.log("TREE DEBUG: ORPHAN LIST", {
        listId,
        folderId,
      });

      return;
    }

    folderMap[folderId].lists.push({
      _id: list._id,
      name: list.name,
      visibility: list.visibility,
      order: list.order,
      role: listRoleMap[listId] || null,
    });
  });

  /* ======================================================
     13. SORT
  ====================================================== */

  Object.values(workspaceMap).forEach((ws) => {
    ws.folders.sort((a, b) => a.order - b.order);
  });

  Object.values(folderMap).forEach((folder) => {
    folder.lists.sort((a, b) => a.order - b.order);
  });

  /* ======================================================
     14. FINAL LOGS
  ====================================================== */

  const result = Object.values(workspaceMap);

  console.log("\n================ TREE DEBUG FINAL ================\n");

  console.log("TREE DEBUG: FINAL SUMMARY", {
    workspaces: result.length,
    folders: visibleFolders.length,
    lists: visibleLists.length,
  });

  return result;
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
  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) throw new Error("Workspace not found");

  if (data.name) {
    workspace.name = data.name;
  }

  if (data.members) {
    workspace.members = data.members;
  }

  await workspace.save();

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

  // =========================
  // NOTIFICATION
  // =========================

  await NotificationModel.create({
    recipient: userId,

    actor: workspace.createdBy,

    type: "workspace.member_added",

    title: "Added to Workspace",

    message: `You were added to workspace "${workspace.name}"`,

    entity: {
      id: workspace._id,
      model: "Workspace",
    },
  });

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
