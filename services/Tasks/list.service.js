const List = require("../../models/Tasks/ListModel");

// ===============================
// CREATE LIST
// ===============================
exports.createList = async (data, userId, companyId) => {
  if (!companyId) throw new Error("Company ID is required");
  if (!data.workspace) throw new Error("Workspace is required");
  if (!data.folder) throw new Error("Folder is required");

  const list = await List.create({
    name: data.name.trim(),
    folder: data.folder,
    workspace: data.workspace,
    companyId,
    visibility: data.visibility || "private",
    createdBy: userId,
    order: data.order || 0,

    members: [
      {
        user: userId,
        role: "manager",
      },
    ],
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
