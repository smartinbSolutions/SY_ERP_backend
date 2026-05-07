const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const TaskModel = require("../../models/Tasks/TaskModel");

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
    req.isWorkspaceMember = true;

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
// 4. LIST ACCESS
// ======================================
exports.listAccess = async (req, res, next) => {
  try {
    const listId = req.params.listId;
    const workspaceId = req.params.workspaceId;

    if (!listId || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: "List ID and Workspace ID are required",
      });
    }

    const list = await List.findOne({
      _id: listId,
      workspace: workspaceId,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "List not found",
      });
    }

    const isAdmin = ["owner", "admin"].includes(req.workspaceRole);

    if (isAdmin) {
      req.list = list;
      return next();
    }

    if (list.visibility === "private") {
      const allowed = list.members?.some(
        (m) => m.user.toString() === req.user._id.toString(),
      );

      if (!allowed) {
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
// 5. TASK ACCESS
// ======================================
exports.taskAccess = async (req, res, next) => {
  try {
    const taskId = req.params.taskId || req.params.id;
    const workspaceId = req.params.workspaceId;

    if (!taskId || !workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Task ID and Workspace ID are required",
      });
    }

    const task = await TaskModel.findOne({
      _id: taskId,
      workspace: workspaceId,
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const list = await List.findOne({
      _id: task.list,
      workspace: workspaceId,
    });

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "Parent list not found",
      });
    }

    const isAdmin = ["owner", "admin"].includes(req.workspaceRole);

    if (isAdmin) {
      req.task = task;
      req.list = list;
      return next();
    }

    if (list.visibility === "private") {
      const allowed = list.members?.some(
        (m) => m.user.toString() === req.user._id.toString(),
      );

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Task access denied",
        });
      }
    }

    req.task = task;
    req.list = list;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
