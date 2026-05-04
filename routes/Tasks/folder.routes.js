const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  folderAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const {
  createFolder,
  updateFolder,
  deleteFolder,
  getFolders,
} = require("../../controllers/Tasks/folder.controller");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ===============================
// CREATE FOLDER
// ===============================
router.post(
  "/",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("create"),
  createFolder,
);

// ===============================
// GET FOLDERS BY WORKSPACE
// ===============================
router.get(
  "/workspace/:workspaceId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  getFolders,
);

// ===============================
// UPDATE FOLDER
// ===============================
router.patch(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  checkPermission("update"), //
  updateFolder,
);

// ===============================
// DELETE FOLDER
// ===============================
router.delete(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  checkPermission("delete"),
  deleteFolder,
);

module.exports = router;
