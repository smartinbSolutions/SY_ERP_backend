const NotificationModel = require("../../models/Hr/NotificationModel");
const List = require("../../models/Tasks/ListModel");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!data.workspace) throw new Error("Workspace is required");
  if (!data.folder) throw new Error("Folder is required");

  const members = data.members || [];

  // =========================
  // CLEAN + UNIQUE MEMBERS
  // =========================

  const uniqueMembers = [];
  const seen = new Set();

  for (const m of members) {
    const id = String(m.user);

    // skip creator
    if (id === String(userId)) continue;

    // skip duplicates
    if (seen.has(id)) continue;

    seen.add(id);

    // =========================
    // NOTIFICATION DEFAULT LOGIC
    // =========================

    const notificationsEnabled =
      m.notificationsEnabled ?? ["owner", "manager"].includes(m.role);

    uniqueMembers.push({
      user: m.user,
      role: m.role,
      notificationsEnabled,
    });
  }

  // =========================
  // CREATOR ALWAYS OWNER
  // =========================

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
    folder: data.folder,
    workspace: data.workspace,
    companyId,
    visibility: data.visibility || "private",
    createdBy: userId,
    order: data.order || 0,
    members: finalMembers,
  });

  // =========================
  // MEMBER NOTIFICATIONS
  // =========================

  const notificationMembers = uniqueMembers;

  if (notificationMembers.length > 0) {
    const notifications = notificationMembers.map((member) => ({
      recipient: member.user,
      actor: userId,
      type: "list.member_added",
      title: "Added to List",
      message: `You were added to list "${list.name}"`,
      entity: {
        listId: list._id,
        folderId: list.folder,
        workspaceId: list.workspace,
        model: "List",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return list;
};

// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (listId, data) => {
  const list = await List.findById(listId);

  if (!list) {
    throw new Error("List not found");
  }

  if (data.name) list.name = data.name.trim();

  if (data.visibility) {
    list.visibility = data.visibility;
  }

  if (data.order !== undefined) {
    list.order = data.order;
  }

  // ✅ تحديث الأعضاء
  if (data.members) {
    list.members = data.members;
  }

  await list.save();

  return await List.findById(listId).populate("members.user", "fullName email");
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
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const exists = list.members?.some(
    (m) => m.user.toString() === targetUserId.toString(),
  );

  if (exists) {
    throw new Error("User already exists in list");
  }

  const notificationsEnabled = ["owner", "manager"].includes(role);

  list.members.push({
    user: targetUserId,
    role,
    notificationsEnabled,
  });

  await list.save();
  // =========================
  // NOTIFICATION
  // =========================
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
