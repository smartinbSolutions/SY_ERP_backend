const listService = require("../../services/Tasks/list.service");

// CREATE
exports.createList = async (req, res) => {
  try {
    const data = await listService.createList(req.body, req.user._id);
    res.status(201).json({ message: "Created", data });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// GET BY WORKSPACE
exports.getLists = async (req, res) => {
  try {
    const data = await listService.getListsByWorkspace(
      req.params.workspaceId,
      req.user._id
    );

    res.json({ count: data.length, data });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

// GET ONE
exports.getList = async (req, res) => {
  try {
    const data = await listService.getListById(
      req.params.id,
      req.user._id
    );

    res.json({ data });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

// UPDATE
exports.updateList = async (req, res) => {
  try {
    const data = await listService.updateList(
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
exports.deleteList = async (req, res) => {
  try {
    await listService.deleteList(req.params.id, req.user._id);

    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};

// ADD MEMBER
exports.addMember = async (req, res) => {
  try {
    const data = await listService.addMember(
      req.params.id,
      req.body.userId,
      req.body.role,
      req.user._id
    );

    res.json({ message: "Member added", data });
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
};