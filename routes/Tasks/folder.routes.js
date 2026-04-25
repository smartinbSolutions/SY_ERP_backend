const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");
const {
  createFolder,
  updateFolder,
  deleteFolder,
} = require("../../controllers/Tasks/folder.controller");
const {
  getFoldersByWorkspace,
} = require("../../services/Tasks/folder.service");
const { folderAccess } = require("../../middlewares/Tasks/folderAccess");

// CREATE
router.post("/", hrAuthServices.protectStaffOrERP, createFolder);

// GET BY WORKSPACE
router.get(
  "/:workspaceId",
  hrAuthServices.protectStaffOrERP,
  getFoldersByWorkspace,
);

// UPDATE
router.put(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  folderAccess,
  updateFolder,
);

// DELETE
router.delete(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  folderAccess,
  deleteFolder,
);

module.exports = router;
