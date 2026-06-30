const Folder = require("../../models/Tasks/FolderModel");
const staffModel = require("../../models/Hr/Staffs/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");
const notificationHelper = require("./notificationHelper");

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

    const notificationsEnabled =
      m.notificationsEnabled ?? ["owner", "manager"].includes(m.role);

    uniqueMembers.push({
      user: m.user,
      role: m.role || "viewer",
      notificationsEnabled,
      joinedAt: new Date(),
    });
  }

  // =========================
  // CREATE FOLDER
  // =========================

  const folder = await Folder.create({
    name: data.name.trim(),
    workspace: workspace._id,
    companyId: workspace.companyId,
    createdBy: userId,
    visibility: data.visibility || "private",
    order: data.order || 0,
    members: uniqueMembers,
  });

  // ======================================================
  // STEP 1: DIRECT NOTIFICATIONS (folder members only)
  // ======================================================

  const directRecipients = uniqueMembers
    .filter(
      (m) => m.user.toString() !== userId.toString() && m.notificationsEnabled,
    )
    .map((m) => String(m.user));

  if (directRecipients.length > 0) {
    const directNotifications = directRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "folder.member_added",
      title: "Added to Folder",
      message: `You have been added to folder "${folder.name}"`,
      entity: {
        folderId: folder._id,
        workspaceId: workspace._id,
        model: "Folder",
      },
    }));

    await NotificationModel.create(directNotifications);
  }

  // ======================================================
  // STEP 2: TREE NOTIFICATIONS (workspace via helper)
  // ======================================================

  const treeRecipients = notificationHelper.getRecipients(
    {
      workspace: workspace,
    },
    userId,
    "folder",
  );

  if (treeRecipients.length > 0) {
    const treeNotifications = treeRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "folder.created",
      title: "Folder Created",
      message: `Folder "${folder.name}" was created in workspace "${workspace.name}"`,
      entity: {
        folderId: folder._id,
        workspaceId: workspace._id,
        model: "Folder",
      },
    }));

    await NotificationModel.create(treeNotifications);
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
exports.updateFolder = async (folderId, data, actorId) => {
  console.log("=== UPDATE FOLDER START ===", {
    folderId,
    actorId,
    data,
  });

  const folder = await Folder.findById(folderId).populate({
    path: "workspace",
    select: "members name",
  });

  if (!folder) throw new Error("Folder not found");

  // =========================
  // UPDATE FIELDS
  // =========================

  if (data.name) folder.name = data.name.trim();
  if (data.order !== undefined) folder.order = data.order;
  if (data.visibility) folder.visibility = data.visibility;

  if (data.members) {
    folder.members = data.members;
  }

  await folder.save();

  console.log("FOLDER UPDATED", { folderId: folder._id });

  // =========================
  // TREE NOTIFICATIONS ONLY
  // =========================

  console.log("STEP 1: TREE NOTIFICATIONS");

  const recipients = notificationHelper.getRecipients(
    {
      workspace: folder.workspace,
    },
    actorId,
    "folder",
  );

  console.log("STEP 1: RECIPIENTS", recipients);

  if (recipients.length > 0) {
    const notifications = recipients.map((recipient) => ({
      recipient,
      actor: actorId,
      type: "folder.updated",
      title: "Folder Updated",
      message: `Folder "${folder.name}" was updated`,
      entity: {
        folderId: folder._id,
        workspaceId: folder.workspace?._id,
        model: "Folder",
      },
    }));

    await NotificationModel.create(notifications);

    console.log("STEP 1: NOTIFICATIONS SENT", notifications.length);
  } else {
    console.log("STEP 1: NO RECIPIENTS");
  }

  console.log("=== UPDATE FOLDER END ===");

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
exports.addMember = async (folderId, userId, role = "member") => {
  const folder = await Folder.findById(folderId).populate("workspace");

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

  const notificationsEnabled = ["owner", "manager"].includes(role);

  const updatedFolder = await Folder.findByIdAndUpdate(
    folderId,
    {
      $addToSet: {
        members: {
          user: userId,
          role,
          notificationsEnabled,
        },
      },
    },
    { new: true },
  );

  // ======================================================
  // STEP 1: DIRECT NOTIFICATION (only the added member)
  // ======================================================

  await NotificationModel.create({
    recipient: userId,
    actor: folder.createdBy,
    type: "folder.member_added",
    title: "Added to Folder",
    message: `You have been added to folder "${folder.name}"`,
    entity: {
      folderId: folder._id,
      workspaceId: folder.workspace,
      model: "Folder",
    },
  });

  // ======================================================
  // STEP 2: TREE NOTIFICATION (workspace propagation)
  // ======================================================

  const treeRecipients = notificationHelper.getRecipients(
    {
      workspace: folder.workspace,
    },
    userId,
    "folder",
  );

  if (treeRecipients.length > 0) {
    const treeNotifications = treeRecipients.map((recipient) => ({
      recipient,
      actor: userId,
      type: "folder.member_added_tree",
      title: "Folder Updated",
      message: `A new member was added to folder "${folder.name}"`,
      entity: {
        folderId: folder._id,
        workspaceId: folder.workspace,
        model: "Folder",
      },
    }));

    await NotificationModel.create(treeNotifications);
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

  // =========================
  // REMOVE MEMBER
  // =========================
  const updatedFolder = await Folder.findByIdAndUpdate(
    folderId,
    {
      $pull: {
        members: { user: userId },
      },
    },
    { new: true },
  );
  // =========================
  // NOTIFICATION
  // =========================
  await NotificationModel.create({
    recipient: userId,
    actor: folder.createdBy,

    type: "folder.member_removed",
    title: "Removed from Folder",
    message: `You were removed from folder "${folder.name}"`,
    entity: {
      folderId: folder._id,
      workspaceId: folder.workspace,
      model: "Folder",
    },
  });

  return updatedFolder;
};
