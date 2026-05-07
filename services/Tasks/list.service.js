const List = require("../../models/Tasks/ListModel");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!data.workspace) throw new Error("Workspace is required");
  if (!data.folder) throw new Error("Folder is required");

  const exists = await List.findOne({
    name: data.name.trim(),
    workspace: data.workspace,
    companyId,
  });

  if (exists) {
    throw new Error("List with this name already exists");
  }

  const members = data.members || [];

  const finalMembers = [
    {
      user: userId,
      role: "owner",
    },
    ...members.filter((m) => String(m.user) !== String(userId)),
  ];

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

  return list;
};

// ===============================
// UPDATE LIST
// ===============================
exports.updateList = async (listId, data) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  if (data.name) list.name = data.name.trim();
  if (data.visibility) list.visibility = data.visibility;
  if (data.order !== undefined) list.order = data.order;

  await list.save();

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
exports.addMember = async (listId, targetUserId, role) => {
  const list = await List.findById(listId);

  if (!list) throw new Error("List not found");

  const exists = list.members?.some(
    (m) => m.user.toString() === targetUserId.toString(),
  );

  if (exists) {
    throw new Error("User already exists in list");
  }

  list.members.push({
    user: targetUserId,
    role: role || "viewer",
  });

  await list.save();

  return list;
};

// ===============================
// GET LIST BY ID
// ===============================
exports.getListById = async (listId) => {
  const list = await List.findById(listId).populate(
    "members.user",
    "name email",
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

  list.members = list.members.filter(
    (m) => m.user.toString() !== targetUserId.toString(),
  );

  await list.save();

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
}) => {
  const query = {
    workspace: workspaceId,
    companyId,
  };

  // 🔍 search by name
  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  // 🔐 ensure user is member
  query["members.user"] = userId;

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
