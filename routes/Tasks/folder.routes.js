const express = require("express");
const router = express.Router({ mergeParams: true });

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  folderAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

const {
  createFolder,
  getFolders,
  getFolder,
  updateFolder,
  deleteFolder,
  addMember,
  removeMember,
} = require("../../controllers/Tasks/folder.controller");

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
// GET SINGLE FOLDER
// GET /workspaces/:workspaceId/folders/:folderId
// ======================================
router.get(
  "/:folderId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  getFolder,
);

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

// ======================================
// ADD MEMBER
// POST /workspaces/:workspaceId/folders/:folderId/members
// ======================================
router.post(
  "/:folderId/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  checkPermission("manage:members"),
  addMember,
);

// ======================================
// REMOVE MEMBER
// DELETE /workspaces/:workspaceId/folders/:folderId/members/:userId
// ======================================
router.delete(
  "/:folderId/members/:userId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  folderAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
