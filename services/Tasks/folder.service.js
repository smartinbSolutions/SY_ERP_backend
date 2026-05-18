const Folder = require("../../models/Tasks/FolderModel");
const staffModel = require("../../models/Hr/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");

// ===============================
// CREATE FOLDER
// ===============================
exports.createFolder = async (data, userId, workspace) => {
  if (!workspace) {
    throw new Error("Workspace is required");
  }

  const members = data.members || [];

  const uniqueMembers = [];
  const seen = new Set();

  // =========================
  // CREATOR ALWAYS OWNER
  // =========================

  uniqueMembers.push({
    user: userId,
    role: "owner",
    notificationsEnabled: true,
    joinedAt: new Date(),
  });

  for (const m of members) {
    const id = String(m.user);

    if (id === String(userId)) continue;

    if (seen.has(id)) continue;

    seen.add(id);

    // =========================
    // NOTIFICATION DEFAULT LOGIC
    // =========================

    const notificationsEnabled =
      m.notificationsEnabled ?? ["owner", "manager"].includes(m.role);

    uniqueMembers.push({
      user: m.user,
      role: m.role || "viewer",
      notificationsEnabled,
      joinedAt: new Date(),
    });
  }

  const folder = await Folder.create({
    name: data.name.trim(),
    workspace: workspace._id,
    companyId: workspace.companyId,
    createdBy: userId,
    visibility: data.visibility || "private",
    order: data.order || 0,
    members: uniqueMembers,
  });

  // =========================
  // NOTIFICATIONS
  // =========================

  const notificationMembers = uniqueMembers.filter(
    (m) => m.user.toString() !== userId.toString() && m.notificationsEnabled,
  );

  if (notificationMembers.length > 0) {
    const notifications = notificationMembers.map((member) => ({
      recipient: member.user,
      actor: userId,
      type: "folder.member_added",
      title: "Added to Folder",
      message: `You were added to folder "${folder.name}"`,
      entity: {
        id: folder._id,
        model: "Folder",
      },
    }));

    await NotificationModel.create(notifications);
  }

  return folder;
};

// ===============================
// GET FOLDERS BY WORKSPACE
// ===============================
exports.getFoldersByWorkspace = async (workspace, userId, isAdmin) => {
  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if (isAdmin) {
    return await Folder.find({
      workspace: workspace._id,
    }).sort({ order: 1 });
  }

  return await Folder.find({
    workspace: workspace._id,
    $or: [{ visibility: "public" }, { "members.user": userId }],
  }).sort({ order: 1 });
};

// ===============================
// GET FOLDER BY ID
// ===============================
exports.getFolderById = async (folderId) => {
  const folder = await Folder.findById(folderId).populate(
    "members.user",
    "fullName email",
  );

  if (!folder) {
    throw new Error("Folder not found");
  }

  return folder;
};

// ===============================
// UPDATE FOLDER
// ===============================
exports.updateFolder = async (folderId, data) => {
  const folder = await Folder.findById(folderId);

  if (!folder) throw new Error("Folder not found");

  if (data.name) folder.name = data.name.trim();
  if (data.order !== undefined) folder.order = data.order;
  if (data.visibility) folder.visibility = data.visibility;

  // ✅ FIX HERE
  if (data.members) {
    folder.members = data.members;
  }

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
exports.addMember = async (
  folderId,
  userId,
  role = "member",
  notificationsEnabled,
) => {
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

  // =========================
  // DEFAULT NOTIFICATION LOGIC
  // =========================

  const finalNotificationsEnabled =
    notificationsEnabled ?? ["owner", "manager"].includes(role);

  const updatedFolder = await Folder.findByIdAndUpdate(
    folderId,
    {
      $addToSet: {
        members: {
          user: userId,
          role,
          notificationsEnabled: finalNotificationsEnabled,
        },
      },
    },
    { new: true },
  );

  // =========================
  // NOTIFICATION
  // =========================

  if (finalNotificationsEnabled) {
    await NotificationModel.create({
      recipient: userId,
      actor: folder.createdBy,
      type: "folder.member_added",
      title: "Added to Folder",
      message: `You were added to folder "${folder.name}"`,
      entity: {
        id: folder._id,
        model: "Folder",
      },
    });
  }

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

  return await Folder.findByIdAndUpdate(
    folderId,
    {
      $pull: {
        members: { user: userId },
      },
    },
    { new: true },
  );
};
