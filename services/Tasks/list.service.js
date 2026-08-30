const NotificationModel = require("../../models/Hr/NotificationModel");
const FolderModel = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const WorkspaceModel = require("../../models/Tasks/WorkspaceModel");
const notificationHelper = require("./notificationHelper");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId, folder, workspace) => {
  if (!folder) {
    throw new Error("Folder is required");
  }

  if (!workspace) {
    throw new Error("Workspace is required");
  }

  if (folder.workspace.toString() !== workspace._id.toString()) {
    throw new Error("Folder does not belong to this workspace");
  }

  if (folder.companyId.toString() !== workspace.companyId.toString()) {
    throw new Error("Folder and workspace company mismatch");
  }

  if (!data.name?.trim()) {
    throw new Error("List name is required");
  }

  const members = data.members || [];

  // =========================
  // CLEAN + UNIQUE MEMBERS
  // =========================

  const uniqueMembers = [];
  const seen = new Set();

  for (const member of members) {
    const id = String(member.user);

    if (id === String(userId)) {
      continue;
    }

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);

    const role = member.role || "viewer";
    const notificationsEnabled =
      member.notificationsEnabled ?? ["owner", "manager"].includes(role);

    uniqueMembers.push({
      user: member.user,
      role,
      notificationsEnabled,
    });
  }

  const finalMembers = [
    {
      user: userId,
      role: "owner",
      notificationsEnabled: true,
    },
    ...uniqueMembers,
  ];

  // =========================
  // CREATE LIST
  // =========================

  const list = await List.create({
    name: data.name.trim(),
    folder: folder._id,
    workspace: workspace._id,
    companyId: workspace.companyId,
    visibility: data.visibility || "private",
    createdBy: userId,
    order: data.order ?? 0,
    members: finalMembers,
  });

  // ======================================================
  // STEP 1: DIRECT NOTIFICATIONS
  // ======================================================

  const directRecipients = uniqueMembers
    .filter((member) => member.notificationsEnabled)
    .map((member) => String(member.user));

  if (directRecipients.length > 0) {
    const directNotifications = directRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "list.member_added",
      title: "Added to List",
      message: `You have been added to list "${list.name}"`,
      entity: {
        listId: list._id,
        folderId: folder._id,
        workspaceId: workspace._id,
        model: "List",
      },
    }));

    await NotificationModel.create(directNotifications);
  }

  // ======================================================
  // STEP 2: TREE NOTIFICATIONS
  // ======================================================

  const treeRecipients = notificationHelper.getRecipients(
    {
      folder,
      workspace,
    },
    userId,
    "list",
  );

  if (treeRecipients.length > 0) {
    const treeNotifications = treeRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "list.created",
      title: "List Created",
      message: `List "${list.name}" was created in folder`,
      entity: {
        listId: list._id,
        folderId: folder._id,
        workspaceId: workspace._id,
        model: "List",
      },
    }));

    await NotificationModel.create(treeNotifications);
  }

  return list;
};

// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (listId, data, actorId, companyId) => {
  const list = await List.findOne({
    _id: listId,
    companyId,
  }).populate([
    { path: "folder", populate: { path: "workspace" } },
    { path: "workspace" },
  ]);

  if (!list) {
    throw new Error("List not found");
  }

  if (data.name) {
    list.name = data.name.trim();
  }

  if (data.visibility) {
    list.visibility = data.visibility;
  }

  if (data.order !== undefined) {
    list.order = data.order;
  }

  // Kept unchanged: the current API still allows updating members here.
  if (data.members) {
    list.members = data.members;
  }

  await list.save();

  const recipients = notificationHelper.getRecipients(
    {
      folder: list.folder,
      workspace: list.workspace,
    },
    actorId,
    "list",
  );

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: actorId,
      type: "list.updated",
      title: "List Updated",
      message: `List "${list.name}" was updated`,
      entity: {
        listId: list._id,
        folderId: list.folder?._id,
        workspaceId: list.workspace?._id,
        model: "List",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return list;
};

// ===============================
// DELETE LIST
// ===============================
exports.deleteList = async (listId) => {
  const list = await List.findById(listId);

  if (!list) {
    throw new Error("List not found");
  }

  // Cascade deletion will be added after reviewing Task/SubTask relations.
  await list.deleteOne();

  return true;
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (listId, targetUserId, role, actorId, companyId) => {
  const list = await List.findOne({
    _id: listId,
    companyId,
  });

  if (!list) {
    throw new Error("List not found");
  }

  const exists = list.members?.some(
    (member) => member.user.toString() === targetUserId.toString(),
  );

  if (exists) {
    throw new Error("User already exists in list");
  }

  const memberRole = role || "member";
  const notificationsEnabled = ["owner", "manager"].includes(memberRole);

  list.members.push({
    user: targetUserId,
    role: memberRole,
    notificationsEnabled,
  });

  await list.save();

  await NotificationModel.create({
    recipient: targetUserId,
    actor: actorId,
    type: "list.member_added",
    title: "Added to List",
    message: `You were added to list "${list.name}"`,
    entity: {
      listId: list._id,
      folderId: list.folder,
      workspaceId: list.workspace,
      model: "List",
    },
  });

  const [folder, workspace] = await Promise.all([
    FolderModel.findOne({
      _id: list.folder,
      workspace: list.workspace,
      companyId: list.companyId,
    })
      .select("members")
      .lean(),
    WorkspaceModel.findOne({
      _id: list.workspace,
      companyId: list.companyId,
    })
      .select("members")
      .lean(),
  ]);

  const treeRecipients = notificationHelper.getRecipients(
    {
      folder,
      workspace,
    },
    actorId,
    "list",
  );

  if (treeRecipients.length > 0) {
    const treeNotifications = treeRecipients.map((recipient) => ({
      recipient,
      actor: actorId,
      type: "list.member_added_tree",
      title: "List Updated",
      message: `New member added to list "${list.name}"`,
      entity: {
        listId: list._id,
        folderId: list.folder,
        workspaceId: list.workspace,
        model: "List",
      },
    }));

    await NotificationModel.create(treeNotifications);
  }

  return list;
};

// ===============================
// GET LIST BY ID
// ===============================
exports.getListById = async (listId) => {
  const list = await List.findById(listId).populate(
    "members.user",
    "fullName email",
  );

  if (!list) {
    throw new Error("List not found");
  }

  return list;
};

// ===============================
// REMOVE MEMBER
// ===============================
exports.removeMember = async (listId, targetUserId, actorId) => {
  const list = await List.findById(listId);

  if (!list) {
    throw new Error("List not found");
  }

  const target = list.members.find(
    (member) => member.user.toString() === targetUserId.toString(),
  );

  if (!target) {
    throw new Error("User is not in the list");
  }

  const owners = list.members.filter((member) => member.role === "owner");

  if (target.role === "owner" && owners.length === 1) {
    throw new Error("Cannot remove the last list owner");
  }

  list.members = list.members.filter(
    (member) => member.user.toString() !== targetUserId.toString(),
  );

  await list.save();

  await NotificationModel.create({
    recipient: targetUserId,
    actor: actorId,
    type: "list.member_removed",
    title: "Removed from List",
    message: `You were removed from list "${list.name}"`,
    entity: {
      listId: list._id,
      folderId: list.folder,
      workspaceId: list.workspace,
      model: "List",
    },
  });

  return list;
};

// ===============================
// GET LISTS BY FOLDER
// ===============================
exports.getListsByWorkspace = async ({
  page = 1,
  limit = 10,
  search = "",
  workspaceId,
  folderId,
  companyId,
  userId,
  workspaceRole,
  folderRole,
}) => {
  const query = {
    workspace: workspaceId,
    folder: folderId,
    companyId,
  };

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const isWorkspaceAdmin =
    workspaceRole === "owner" || workspaceRole === "manager";

  const isFolderAdmin = folderRole === "owner" || folderRole === "manager";

  if (!isWorkspaceAdmin && !isFolderAdmin) {
    query.$or = [{ visibility: "public" }, { "members.user": userId }];
  }

  const normalizedPage = Math.max(Number(page) || 1, 1);
  const normalizedLimit = Math.max(Number(limit) || 10, 1);
  const skip = (normalizedPage - 1) * normalizedLimit;

  const [lists, total] = await Promise.all([
    List.find(query)
      .sort({ order: 1 })
      .skip(skip)
      .limit(normalizedLimit)
      .populate("members.user", "fullName email"),
    List.countDocuments(query),
  ]);

  return {
    data: lists,
    pagination: {
      total,
      page: normalizedPage,
      pages: Math.ceil(total / normalizedLimit),
    },
  };
};
