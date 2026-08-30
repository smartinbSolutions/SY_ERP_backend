const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");
const TaskModel = require("../../models/Tasks/TaskModel");
const SubTaskModel = require("../../models/Tasks/SubTaskModel");

const { getHighestRole } = require("../../utils/permission.helper");

const getMemberRole = (members, userId) => {
  const normalizedUserId = String(userId);

  const member = members?.find((item) => {
    const memberUserId = String(item?.user?._id || item?.user || "");

    return memberUserId === normalizedUserId;
  });

  return member?.role || null;
};

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

    req.workspaceRole = getMemberRole(workspace.members, userId);

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

    const userId = String(req.user._id);

    const directFolderRole = getMemberRole(folder.members, userId);

    const publicFolderRole = folder.visibility === "public" ? "viewer" : null;

    /*
     * Workspace role هو الحد الأدنى.
     * Folder role تستطيع رفعه، وليس تخفيضه.
     */
    const effectiveFolderRole = getHighestRole(
      req.workspaceRole,
      directFolderRole,
      publicFolderRole,
    );

    if (!effectiveFolderRole) {
      return res.status(403).json({
        success: false,
        message: "Folder access denied",
      });
    }

    req.folder = folder;
    req.folderRole = effectiveFolderRole;

    return next();
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
    const { listId, folderId, workspaceId } = req.params;

    if (!listId) {
      return res.status(400).json({
        success: false,
        message: "List ID is required",
      });
    }

    if ((folderId && !workspaceId) || (workspaceId && !folderId)) {
      return res.status(400).json({
        success: false,
        message: "Folder ID and Workspace ID must be provided together",
      });
    }

    const listQuery = {
      _id: listId,
    };

    if (folderId && workspaceId) {
      listQuery.folder = folderId;
      listQuery.workspace = workspaceId;
    }

    const list = await List.findOne(listQuery);

    if (!list) {
      return res.status(404).json({
        success: false,
        message:
          folderId && workspaceId
            ? "List not found in the specified folder and workspace"
            : "List not found",
      });
    }

    const [workspace, folder] = await Promise.all([
      Workspace.findById(list.workspace),

      Folder.findOne({
        _id: list.folder,
        workspace: list.workspace,
      }),
    ]);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Parent workspace not found",
      });
    }

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Parent folder not found or hierarchy mismatch",
      });
    }

    const userId = String(req.user._id);

    const directWorkspaceRole = getMemberRole(workspace.members, userId);
    const directFolderRole = getMemberRole(folder.members, userId);
    const directListRole = getMemberRole(list.members, userId);
    const publicFolderRole = folder.visibility === "public" ? "viewer" : null;
    const publicListRole = list.visibility === "public" ? "viewer" : null;

    /*
     * نحسب الدور الفعلي داخل Folder.
     */
    const effectiveFolderRole = getHighestRole(
      directWorkspaceRole,
      directFolderRole,
      publicFolderRole,
    );

    /*
     * ثم نحسب الدور الفعلي داخل List.
     */
    const effectiveListRole = getHighestRole(
      effectiveFolderRole,
      directListRole,
      publicListRole,
    );

    req.workspace = workspace;
    req.folder = folder;
    req.list = list;

    req.workspaceRole = directWorkspaceRole;
    req.folderRole = effectiveFolderRole;
    req.listRole = effectiveListRole;

    if (!effectiveListRole) {
      return res.status(403).json({
        success: false,
        message: "List access denied",
      });
    }

    return next();
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

    const taskQuery = {
      _id: taskId,
    };

    if (req.params.listId) {
      taskQuery.list = req.params.listId;
    }

    const task = await TaskModel.findOne(taskQuery);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found in the specified list",
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

    if (
      task.workspace &&
      task.workspace.toString() !== list.workspace.toString()
    ) {
      return res.status(404).json({
        success: false,
        message: "Task hierarchy mismatch",
      });
    }

    // ======================================
    // FIND FOLDER
    // ======================================

    const folder = await Folder.findOne({
      _id: list.folder,
      workspace: list.workspace,
    });
    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Parent folder not found",
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

    const userId = String(req.user._id);

    const directWorkspaceRole = getMemberRole(workspace.members, userId);

    const directFolderRole = getMemberRole(folder.members, userId);

    const directListRole = getMemberRole(list.members, userId);

    const publicFolderRole = folder.visibility === "public" ? "viewer" : null;

    const publicListRole = list.visibility === "public" ? "viewer" : null;

    const effectiveFolderRole = getHighestRole(
      directWorkspaceRole,
      directFolderRole,
      publicFolderRole,
    );

    const effectiveListRole = getHighestRole(
      effectiveFolderRole,
      directListRole,
      publicListRole,
    );

    if (!effectiveListRole) {
      return res.status(403).json({
        success: false,
        message: "Task access denied",
      });
    }

    req.workspace = workspace;
    req.folder = folder;
    req.list = list;
    req.task = task;

    req.workspaceRole = directWorkspaceRole;
    req.folderRole = effectiveFolderRole;
    req.listRole = effectiveListRole;

    return next();
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
