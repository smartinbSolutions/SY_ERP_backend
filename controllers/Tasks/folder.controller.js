const folderService = require("../../services/Tasks/folder.service");

// ===============================
// CREATE FOLDER
// ===============================
exports.createFolder = async (req, res) => {
  try {
    const data = await folderService.createFolder(
      req.body,
      req.user._id,
      req.workspace,
    );

    return res.status(201).json({
      success: true,
      message: "Folder created successfully",
      data,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// GET FOLDERS BY WORKSPACE
// ===============================
exports.getFolders = async (req, res) => {
  try {
    const data = await folderService.getFoldersByWorkspace(
      req.workspace,
      req.user._id,
    );

    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// UPDATE FOLDER
// ===============================
exports.updateFolder = async (req, res) => {
  try {
    const data = await folderService.updateFolder(
      req.params.folderId,
      req.body,
      req.user._id,
      req.workspace,
    );

    return res.status(200).json({
      success: true,
      message: "Folder updated successfully",
      data,
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }
};

// ===============================
// DELETE FOLDER
// ===============================
exports.deleteFolder = async (req, res) => {
  try {
    await folderService.deleteFolder(
      req.params.folderId,
      req.user._id,
      req.workspaceRole,
      req.workspace,
    );

    return res.status(200).json({
      success: true,
      message: "Folder deleted successfully",
    });
  } catch (err) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }
};
