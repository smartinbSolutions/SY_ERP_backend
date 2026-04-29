const Workspace = require("../../models/Tasks/WorkspaceModel");
const Folder = require("../../models/Tasks/FolderModel");
const List = require("../../models/Tasks/ListModel");


// WORKSPACE ACCESS MIDDLEWARE
// Checks if the user is a member of the workspace

exports.workspaceAccess = async (req, res, next) => {
  try {
    // Get workspace ID from route params
    const workspaceId = req.params.workspaceId || req.params.id;

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID is required",
      });
    }

    // Find workspace and check if user is an active member
    const workspace = await Workspace.findOne({
      _id: workspaceId,
      "members.user": req.user._id,
      "members.status": "active",
    });

    // If workspace not found or user is not a member
    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this workspace",
      });
    }

    // Attach workspace to request for later use
    req.workspace = workspace;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// FOLDER ACCESS MIDDLEWARE
// Checks if user can access a folder inside a workspace

exports.folderAccess = async (req, res, next) => {
  try {
    const folderId = req.params.id;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        message: "Folder ID is required",
      });
    }

    // Find folder by ID
    const folder = await Folder.findById(folderId);

    if (!folder) {
      return res.status(404).json({
        success: false,
        message: "Folder not found",
      });
    }

    // Check if user is member of the folder's workspace
    const workspace = await Workspace.findOne({
      _id: folder.workspace,
      "members.user": req.user._id,
      "members.status": "active",
    });

    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: "Workspace access denied",
      });
    }

    // Attach data to request object
    req.folder = folder;
    req.workspace = workspace;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// LIST ACCESS MIDDLEWARE
// Handles workspace access + list visibility rules

exports.listAccess = async (req, res, next) => {
  try {
    const listId = req.params.id;

    if (!listId) {
      return res.status(400).json({
        success: false,
        message: "List ID is required",
      });
    }

    // Find list by ID
    const list = await List.findById(listId);

    if (!list) {
      return res.status(404).json({
        success: false,
        message: "List not found",
      });
    }

    // Check workspace membership
    const workspace = await Workspace.findOne({
      _id: list.workspace,
      "members.user": req.user._id,
      "members.status": "active",
    });

    if (!workspace) {
      return res.status(403).json({
        success: false,
        message: "Workspace access denied",
      });
    }

    // If list is private, check if user is explicitly added to it
    if (list.visibility === "private") {
      const isListMember = list.members.some(
        (member) => member.user.toString() === req.user._id.toString(),
      );

      if (!isListMember) {
        return res.status(403).json({
          success: false,
          message: "List access denied",
        });
      }
    }

    // Attach data to request
    req.list = list;
    req.workspace = workspace;

    next();
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
