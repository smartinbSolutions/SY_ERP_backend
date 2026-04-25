const folderService = require("../../services/Tasks/folder.service");

// CREATE
exports.createFolder = async (req, res) => {
  try {
    const data = await folderService.createFolder(req.body, req.user._id);
    res.status(201).json({ message: "Created", data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET BY WORKSPACE
exports.getFolders = async (req, res) => {
  try {
    const data = await folderService.getFoldersByWorkspace(
      req.params.workspaceId,
      req.user._id
    );

    res.json({ count: data.length, data });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

// UPDATE
exports.updateFolder = async (req, res) => {
  try {
    const data = await folderService.updateFolder(
      req.params.id,
      req.body,
      req.user._id
    );

    res.json({ message: "Updated", data });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

// DELETE
exports.deleteFolder = async (req, res) => {
  try {
    await folderService.deleteFolder(req.params.id, req.user._id);

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};