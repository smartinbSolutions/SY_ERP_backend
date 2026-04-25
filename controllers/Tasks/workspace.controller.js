const workspaceService = require("../../services/Tasks/workspace.service");

// CREATE
exports.createWorkspace = async (req, res) => {
  try {
    const data = await workspaceService.createWorkspace(
      req.body,
      req.user._id
    );

    res.status(201).json({ message: "Created", data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getUserWorkspaceTree = async (req, res) => {
  try {
    const data = await workspaceService.getUserWorkspaceTree(
      req.user._id
    );

    res.json({ data });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

// GET MY WORKSPACES
exports.getMyWorkspaces = async (req, res) => {
  try {
    const data = await workspaceService.getUserWorkspaces(req.user._id);

    res.json({ count: data.length, data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET ONE
exports.getWorkspace = async (req, res) => {
  try {
    const data = await workspaceService.getWorkspaceById(req.params.id);

    res.json({ data });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// UPDATE
exports.updateWorkspace = async (req, res) => {
  try {
    const data = await workspaceService.updateWorkspace(
      req.params.id,
      req.body
    );

    res.json({ message: "Updated", data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE
exports.deleteWorkspace = async (req, res) => {
  try {
    await workspaceService.deleteWorkspace(req.params.id);

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

// ADD MEMBER
exports.addMember = async (req, res) => {
  try {
    const data = await workspaceService.addMember(
      req.params.id,
      req.body.userId,
      req.body.role
    );

    res.json({ message: "Member added", data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// REMOVE MEMBER
exports.removeMember = async (req, res) => {
  try {
    const data = await workspaceService.removeMember(
      req.params.id,
      req.params.userId
    );

    res.json({ message: "Member removed", data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};