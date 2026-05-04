const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const TaskModel = require("../../models/Tasks/TaskModel");

// ======================================
// 1. WORKSPACE BASE ACCESS (CORE)
// ======================================
exports.workspaceAccess = async (req, res, next) => {
  try {
    const workspaceId = req.params.workspaceId || req.params.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID is required",
      });
    }

    const workspace = await Workspace.findOne({
      _id: workspaceId,
      "members.user": req.user._id,
      "members.status": "active",
    });

    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this workspace",
      });
    }

    const member = workspace.members.find(
      (m) => m.user.toString() === req.user._id.toString(),
    );

    req.workspace = workspace;
    req.workspaceRole = member?.role;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

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
// 2. FOLDER ACCESS (inherits workspace)
// ======================================
exports.folderAccess = async (req, res, next) => {
  try {
    const folderId = req.params.id;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: "Folder ID is required",
      });
    }

    const folder = await Folder.findById(folderId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    const workspace = req.workspace;

    if (
      !workspace ||
      folder.workspace.toString() !== workspace._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Invalid workspace access",
      });
    }

    req.folder = folder;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// 3. LIST ACCESS (WORKSPACE SCOPED + LIST RULES)
// ======================================
exports.listAccess = async (req, res, next) => {
  try {
    const listId = req.params.id;

    if (!listId) {
      return res.status(400).json({
        success: false,
        message: "List ID is required",
      });
    }

    const list = await List.findById(listId);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "List not found",
      });
    }

    const workspace = req.workspace;

    if (!workspace || list.workspace.toString() !== workspace._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Invalid workspace access",
      });
    }

    // LIST IS THE REAL ACCESS LAYER
    if (list.visibility === "private") {
      const isAllowed = list.members?.some(
        (m) => m.user.toString() === req.user._id.toString(),
      );

      if (!isAllowed) {
        return res.status(403).json({
          success: false,
          message: "List access denied",
        });
      }
    }

    req.list = list;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ======================================
// 4. TASK ACCESS (INHERITS LIST RULES)
// ======================================
exports.taskAccess = async (req, res, next) => {
  try {
    const taskId = req.params.id;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: "Task ID is required",
      });
    }

    const task = await TaskModel.findById(taskId);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const list = await List.findById(task.list);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Parent list not found",
      });
    }

    const workspace = req.workspace;

    if (!workspace || list.workspace.toString() !== workspace._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Task does not belong to workspace",
      });
    }

    // TASK ACCESS DEPENDS ON LIST MEMBERSHIP ONLY
    const isListMember =
      list.visibility === "public" ||
      list.members?.some((m) => m.user.toString() === req.user._id.toString());

    if (!isListMember) {
      return res.status(403).json({
        success: false,
        message: "No access to this task",
      });
    }

    req.task = task;
    req.taskList = list;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
