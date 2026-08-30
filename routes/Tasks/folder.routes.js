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
// GLOBAL MIDDLEWARE
// ======================================

router.use(hrAuthServices.protectStaffOrERP);
router.use(workspaceAccess);

// ======================================
// CREATE FOLDER
// POST /workspaces/:workspaceId/folders
// ======================================

router.post("/", checkPermission("create:folder"), createFolder);

// ======================================
// GET FOLDERS
// GET /workspaces/:workspaceId/folders
// ======================================

router.get("/", checkPermission("read:folder"), getFolders);

// ======================================
// GET SINGLE FOLDER
// GET /workspaces/:workspaceId/folders/:folderId
// ======================================

router.get(
  "/:folderId",
  folderAccess,
  checkPermission("read:folder"),
  getFolder,
);

// ======================================
// UPDATE FOLDER
// PATCH /workspaces/:workspaceId/folders/:folderId
// ======================================

router.patch(
  "/:folderId",
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
  folderAccess,
  checkPermission("delete:folder"),
  deleteFolder,
);

// ======================================
// ADD FOLDER MEMBER
// POST /workspaces/:workspaceId/folders/:folderId/members
// ======================================

router.post(
  "/:folderId/members",
  folderAccess,
  checkPermission("manage:members"),
  addMember,
);

// ======================================
// REMOVE FOLDER MEMBER
// DELETE /workspaces/:workspaceId/folders/:folderId/members/:userId
// ======================================

router.delete(
  "/:folderId/members/:userId",
  folderAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
