const express = require("express");
const router = express.Router({ mergeParams: true });

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

// ======================================
// CREATE FOLDER
// POST /workspaces/:workspaceId/folders
// ======================================
router.post(
  "/",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("create:folder"),
  createFolder,
);

// ======================================
// GET FOLDERS
// GET /workspaces/:workspaceId/folders
// ======================================
router.get("/", hrAuthServices.protectStaffOrERP, workspaceAccess, getFolders);

// ======================================
// UPDATE FOLDER
// PATCH /workspaces/:workspaceId/folders/:folderId
// ======================================
router.patch(
  "/:folderId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  checkPermission("update:folder"),
  updateFolder,
);

// ======================================
// DELETE FOLDER
// DELETE /workspaces/:workspaceId/folders/:folderId
// ======================================
router.delete(
  "/:folderId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  checkPermission("delete:folder"),
  deleteFolder,
);

module.exports = router;
