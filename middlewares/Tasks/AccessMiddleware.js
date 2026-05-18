const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const TaskModel = require("../../models/Tasks/TaskModel");
const SubTaskModel = require("../../models/Tasks/SubTaskModel");

// ======================================
// 1. WORKSPACE ACCESS
// ======================================
exports.workspaceAccess = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID is required",
      });
    }

    const workspace = await Workspace.findById(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const userId = req.user._id.toString();

    // ======================================
    // WORKSPACE MEMBER
    // ======================================

    const workspaceMember = workspace.members?.find(
      (m) => m.user.toString() === userId,
    );

    req.workspaceRole = workspaceMember?.role || null;

    req.workspace = workspace;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// 2. CREATE WORKSPACE PERMISSION
// ======================================
exports.canCreateWorkspace = (req, res, next) => {
  if (!req.user.canCreateWorkspace) {
    return res.status(403).json({
      success: false,
      message: "You are not allowed to create workspace",
    });
  }

  next();
};

// ======================================
// 3. FOLDER ACCESS
// ======================================
exports.folderAccess = async (req, res, next) => {
  try {
    const folderId = req.params.folderId;
    const workspaceId = req.params.workspaceId;

    if (!folderId || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Folder ID and Workspace ID are required",
      });
    }

    const folder = await Folder.findOne({
      _id: folderId,
      workspace: workspaceId,
    });

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    const userId = req.user._id.toString();

    // ======================================
    // WORKSPACE OWNER / MANAGER BYPASS
    // ======================================

    const isWorkspaceAdmin =
      req.workspaceRole === "owner" || req.workspaceRole === "manager";

    if (isWorkspaceAdmin) {
      req.folder = folder;
      req.folderRole = req.workspaceRole;

      return next();
    }

    // ======================================
    // PUBLIC FOLDER
    // ======================================

    if (folder.visibility === "public") {
      req.folder = folder;
      req.folderRole = req.workspaceRole || "viewer";

      return next();
    }

    // ======================================
    // PRIVATE FOLDER MEMBER CHECK
    // ======================================

    const folderMember = folder.members?.find(
      (m) => m.user.toString() === userId,
    );

    if (!folderMember) {
      return res.status(403).json({
        success: false,
        message: "Folder access denied",
      });
    }

    req.folder = folder;
    req.folderRole = folderMember.role;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// 4. LIST ACCESS
// ======================================
exports.listAccess = async (req, res, next) => {
  try {
    const listId = req.params.listId;

    if (!listId) {
      return res.status(400).json({
        success: false,
        message: "List ID is required",
      });
    }

    // ======================================
    // FIND LIST
    // ======================================

    const list = await List.findById(listId);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "List not found",
      });
    }

    // ======================================
    // FIND WORKSPACE
    // ======================================

    const workspace = await Workspace.findById(list.workspace);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    // ======================================
    // FIND FOLDER
    // ======================================

    const folder = await Folder.findById(list.folder);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Parent folder not found",
      });
    }

    const userId = req.user._id.toString();

    // ======================================
    // WORKSPACE ROLE
    // ======================================

    const workspaceMember = workspace.members?.find(
      (m) => m.user.toString() === userId,
    );

    req.workspace = workspace;
    req.workspaceRole = workspaceMember?.role || null;

    // ======================================
    // WORKSPACE ADMIN BYPASS
    // ======================================

    const isWorkspaceAdmin =
      req.workspaceRole === "owner" || req.workspaceRole === "manager";

    if (isWorkspaceAdmin) {
      req.folder = folder;
      req.list = list;

      req.folderRole = req.workspaceRole;
      req.listRole = req.workspaceRole;

      return next();
    }

    // ======================================
    // FOLDER ADMIN BYPASS
    // ======================================

    const folderMember = folder.members?.find(
      (m) => m.user.toString() === userId,
    );

    const isFolderAdmin =
      folderMember?.role === "owner" || folderMember?.role === "manager";

    if (isFolderAdmin) {
      req.folder = folder;
      req.list = list;

      req.folderRole = folderMember.role;
      req.listRole = folderMember.role;

      return next();
    }

    // ======================================
    // PUBLIC LIST
    // ======================================

    if (list.visibility === "public") {
      req.folder = folder;
      req.list = list;

      req.listRole = "viewer";

      return next();
    }

    // ======================================
    // PRIVATE LIST MEMBER CHECK
    // ======================================

    const listMember = list.members?.find((m) => m.user.toString() === userId);

    if (!listMember) {
      return res.status(403).json({
        success: false,
        message: "List access denied",
      });
    }

    req.folder = folder;
    req.list = list;
    req.listRole = listMember.role;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// 5. TASK ACCESS
// ======================================
exports.taskAccess = async (req, res, next) => {
  try {
    const taskId = req.params.taskId || req.params.id;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "Task ID is required",
      });
    }

    // ======================================
    // FIND TASK
    // ======================================

    const task = await TaskModel.findById(taskId);
    console.log(task);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // ======================================
    // FIND LIST
    // ======================================

    const list = await List.findById(task.list);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Parent list not found",
      });
    }

    // ======================================
    // FIND FOLDER
    // ======================================

    const folder = await Folder.findById(list.folder);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Parent folder not found",
      });
    }

    // ======================================
    // FIND WORKSPACE
    // ======================================

    const workspace = await Workspace.findById(task.workspace);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const userId = req.user._id.toString();

    // ======================================
    // WORKSPACE ROLE
    // ======================================

    const workspaceMember = workspace.members?.find(
      (m) => m.user.toString() === userId,
    );

    req.workspace = workspace;
    req.workspaceRole = workspaceMember?.role || null;

    // ======================================
    // WORKSPACE ADMIN BYPASS
    // ======================================

    const isWorkspaceAdmin =
      req.workspaceRole === "owner" || req.workspaceRole === "manager";

    if (isWorkspaceAdmin) {
      req.folder = folder;
      req.list = list;
      req.task = task;

      req.folderRole = req.workspaceRole;
      req.listRole = req.workspaceRole;

      return next();
    }

    // ======================================
    // FOLDER ADMIN BYPASS
    // ======================================

    const folderMember = folder.members?.find(
      (m) => m.user.toString() === userId,
    );

    const isFolderAdmin =
      folderMember?.role === "owner" || folderMember?.role === "manager";

    if (isFolderAdmin) {
      req.folder = folder;
      req.list = list;
      req.task = task;

      req.folderRole = folderMember.role;
      req.listRole = folderMember.role;

      return next();
    }

    // ======================================
    // LIST ADMIN BYPASS
    // ======================================

    const listMember = list.members?.find((m) => m.user.toString() === userId);

    const isListAdmin =
      listMember?.role === "owner" || listMember?.role === "manager";

    if (isListAdmin) {
      req.folder = folder;
      req.list = list;
      req.task = task;

      req.listRole = listMember.role;

      return next();
    }

    // ======================================
    // PUBLIC LIST
    // ======================================

    if (list.visibility === "public") {
      req.folder = folder;
      req.list = list;
      req.task = task;

      req.listRole = "viewer";

      return next();
    }

    // ======================================
    // PRIVATE LIST MEMBER CHECK
    // ======================================

    if (!listMember) {
      return res.status(403).json({
        success: false,
        message: "Task access denied",
      });
    }

    req.folder = folder;
    req.list = list;
    req.task = task;

    req.listRole = listMember.role;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// 6. SUBTASK ACCESS
// ======================================
exports.subTaskResolver = async (req, res, next) => {
  try {
    const subTaskId = req.params.subTaskId || req.params.id;

    if (!subTaskId) {
      return res.status(400).json({
        success: false,
        message: "SubTask ID is required",
      });
    }

    const subTask = await SubTaskModel.findOne({
      _id: subTaskId,
      task: req.task._id,
    });

    if (!subTask) {
      return res.status(404).json({
        success: false,
        message: "SubTask not found",
      });
    }

    req.subTask = subTask;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
