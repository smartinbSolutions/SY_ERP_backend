const NotificationModel = require("../../models/Hr/NotificationModel");
const FolderModel = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const WorkspaceModel = require("../../models/Tasks/WorkspaceModel");
const notificationHelper = require("./notificationHelper");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId, companyId) => {
  console.log("=== CREATE LIST START ===", {
    userId,
    companyId,
    data,
  });

  if (!companyId) throw new Error("Company ID is required");
  if (!data.workspace) throw new Error("Workspace is required");
  if (!data.folder) throw new Error("Folder is required");

  const members = data.members || [];

  console.log("STEP 0: INPUT MEMBERS", members.length);

  // =========================
  // CLEAN + UNIQUE MEMBERS
  // =========================

  const uniqueMembers = [];
  const seen = new Set();

  for (const m of members) {
    const id = String(m.user);

    if (id === String(userId)) {
      console.log("SKIP: actor in members", id);
      continue;
    }

    if (seen.has(id)) {
      console.log("SKIP: duplicate member", id);
      continue;
    }

    seen.add(id);

    notificationsEnabled =
      m.notificationsEnabled ?? ["owner", "manager"].includes(m.role);

    uniqueMembers.push({
      user: m.user,
      role: m.role,
      notificationsEnabled,
    });

    console.log("ADDED UNIQUE MEMBER", {
      user: m.user,
      role: m.role,
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

  console.log("STEP 1: FINAL MEMBERS", finalMembers.length);

  // =========================
  // CREATE LIST
  // =========================

  const list = await List.create({
    name: data.name.trim(),
    folder: data.folder,
    workspace: data.workspace,
    companyId,
    visibility: data.visibility || "private",
    createdBy: userId,
    order: data.order || 0,
    members: finalMembers,
  });

  console.log("LIST CREATED", {
    listId: list._id,
  });

  // ======================================================
  // STEP 1: DIRECT NOTIFICATIONS
  // ======================================================

  const directRecipients = uniqueMembers
    .filter((m) => m.notificationsEnabled)
    .map((m) => String(m.user));

  console.log("STEP 1: DIRECT RECIPIENTS", directRecipients);

  if (directRecipients.length > 0) {
    const directNotifications = directRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "list.member_added",
      title: "Added to List",
      message: `You have been added to list "${list.name}"`,
      entity: {
        listId: list._id,
        folderId: list.folder,
        workspaceId: list.workspace,
        model: "List",
      },
    }));

    console.log(
      "STEP 1: DIRECT NOTIFICATIONS COUNT",
      directNotifications.length,
    );

    await NotificationModel.create(directNotifications);
  } else {
    console.log("STEP 1: NO DIRECT RECIPIENTS");
  }

  // ======================================================
  // STEP 2: TREE NOTIFICATIONS
  // ======================================================

  console.log("STEP 2: FETCH FOLDER + WORKSPACE");

  const folder = await FolderModel.findById(list.folder)
    .select("members")
    .lean();

  const workspace = await WorkspaceModel.findById(list.workspace)
    .select("members")
    .lean();

  console.log("STEP 2: FOLDER MEMBERS", folder?.members?.length);
  console.log("STEP 2: WORKSPACE MEMBERS", workspace?.members?.length);

  const treeRecipients = notificationHelper.getRecipients(
    {
      folder,
      workspace,
    },
    userId,
    "list",
  );

  console.log("STEP 2: TREE RECIPIENTS", treeRecipients);

  if (treeRecipients.length > 0) {
    const treeNotifications = treeRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "list.created",
      title: "List Created",
      message: `List "${list.name}" was created in folder`,
      entity: {
        listId: list._id,
        folderId: list.folder,
        workspaceId: list.workspace,
        model: "List",
      },
    }));

    console.log("STEP 2: TREE NOTIFICATIONS COUNT", treeNotifications.length);

    await NotificationModel.create(treeNotifications);
  } else {
    console.log("STEP 2: NO TREE RECIPIENTS");
  }

  console.log("=== CREATE LIST END ===");

  return list;
};
// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (listId, data, actorId, companyId) => {
  console.log("=== UPDATE LIST START ===", {
    listId,
    actorId,
    companyId,
    data,
  });

  const list = await List.findById(listId).populate([
    { path: "folder", populate: { path: "workspace" } },
    { path: "workspace" },
  ]);

  if (!list) {
    throw new Error("List not found");
  }

  // =========================
  // UPDATE FIELDS
  // =========================

  if (data.name) list.name = data.name.trim();

  if (data.visibility) {
    list.visibility = data.visibility;
  }

  if (data.order !== undefined) {
    list.order = data.order;
  }

  if (data.members) {
    list.members = data.members;
  }

  await list.save();

  console.log("LIST UPDATED", { listId: list._id });

  // =========================
  // TREE NOTIFICATIONS ONLY
  // =========================

  console.log("STEP 1: TREE NOTIFICATIONS");

  const recipients = notificationHelper.getRecipients(
    {
      folder: list.folder,
      workspace: list.workspace,
    },
    actorId,
    "list",
  );

  console.log("STEP 1: RECIPIENTS", recipients);

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

    console.log("STEP 1: NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 1: NO RECIPIENTS");
  }

  console.log("=== UPDATE LIST END ===");

  return list;
};
// ===============================
// DELETE LIST
// ===============================
exports.deleteList = async (listId) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  await list.deleteOne();

  return true;
};

// ===============================
// ADD MEMBER
// ===============================
exports.addMember = async (listId, targetUserId, role, actorId, companyId) => {
  console.log("=== ADD LIST MEMBER START ===", {
    listId,
    targetUserId,
    role,
    actorId,
    companyId,
  });

  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const exists = list.members?.some(
    (m) => m.user.toString() === targetUserId.toString(),
  );

  if (exists) {
    throw new Error("User already exists in list");
  }

  const notificationsEnabled = ["owner", "manager"].includes(role);

  // =========================
  // ADD MEMBER
  // =========================

  list.members.push({
    user: targetUserId,
    role,
    notificationsEnabled,
  });

  await list.save();

  console.log("LIST UPDATED WITH NEW MEMBER");

  // ======================================================
  // STEP 1: DIRECT NOTIFICATION
  // ======================================================

  console.log("STEP 1: DIRECT NOTIFICATION");

  const directNotifications = [
    {
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
    },
  ];

  await NotificationModel.create(directNotifications);

  console.log("STEP 1: DONE");

  // ======================================================
  // STEP 2: TREE NOTIFICATIONS
  // ======================================================

  console.log("STEP 2: FETCH FOLDER + WORKSPACE");

  const folder = await FolderModel.findById(list.folder)
    .select("members")
    .lean();

  const workspace = await WorkspaceModel.findById(list.workspace)
    .select("members")
    .lean();

  console.log("STEP 2: FOLDER MEMBERS", folder?.members?.length);
  console.log("STEP 2: WORKSPACE MEMBERS", workspace?.members?.length);

  const treeRecipients = notificationHelper.getRecipients(
    {
      folder,
      workspace,
    },
    targetUserId,
    "list",
  );

  console.log("STEP 2: TREE RECIPIENTS", treeRecipients);

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

    console.log("STEP 2: TREE NOTIFICATIONS SENT");
  } else {
    console.log("STEP 2: NO TREE RECIPIENTS");
  }

  console.log("=== ADD LIST MEMBER END ===");

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

  if (!list) throw new Error("List not found");

  return list;
};

// ===============================
// REMOVE MEMBER
// ===============================
exports.removeMember = async (listId, targetUserId) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const isMember = list.members.some(
    (m) => m.user.toString() === targetUserId.toString(),
  );

  if (!isMember) {
    throw new Error("User is not in the list");
  }

  // 🚫 لا تسمح بحذف الـ owner
  const target = list.members.find(
    (m) => m.user.toString() === targetUserId.toString(),
  );

  if (target.role === "owner") {
    throw new Error("Cannot remove the owner");
  }

  // =========================
  // REMOVE MEMBER
  // =========================
  list.members = list.members.filter(
    (m) => m.user.toString() !== targetUserId.toString(),
  );

  await list.save();

  // =========================
  // NOTIFICATION
  // =========================
  await NotificationModel.create({
    recipient: targetUserId,
    actor: list.createdBy,

    type: "list.member_removed",
    title: "Removed from List",
    message: `You were removed from list "${list.name}"`,

    entity: {
      id: list._id,
      model: "List",
    },
  });

  return list;
};
// ===============================
// GET LISTS BY WORKSPACE
// ===============================
exports.getListsByWorkspace = async ({
  page = 1,
  limit = 10,
  search = "",
  workspaceId,
  companyId,
  userId,
  workspaceRole,
}) => {
  const query = {
    workspace: workspaceId,
    companyId,
  };

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  const isWorkspaceAdmin =
    workspaceRole === "owner" || workspaceRole === "manager";

  if (!isWorkspaceAdmin) {
    query.$or = [{ visibility: "public" }, { "members.user": userId }];
  }

  const skip = (page - 1) * limit;

  const lists = await List.find(query)
    .sort({ order: 1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("members.user", "name email");

  const total = await List.countDocuments(query);

  return {
    data: lists,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    },
  };
};
