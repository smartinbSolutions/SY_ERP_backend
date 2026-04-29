const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const { workspaceAccess } = require("../../middlewares/Tasks/AccessMiddleware");

const {
  getMyWorkspaces,
  getWorkspace,
  addMember,
  removeMember,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getUserWorkspaceTree,
} = require("../../controllers/Tasks/workspace.controller");
const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ===============================
// CREATE + GET ALL
// ===============================
router
  .route("/")
  .post(hrAuthServices.protectStaffOrERP, createWorkspace)
  .get(hrAuthServices.protectStaffOrERP, getMyWorkspaces);

// ===============================
// TREE
// ===============================
router.get("/tree", hrAuthServices.protectStaffOrERP, getUserWorkspaceTree);

// ===============================
// GET ONE + UPDATE + DELETE
// ===============================
router
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getWorkspace)
  .patch(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("manage:members"),
    updateWorkspace,
  )
  .delete(
    hrAuthServices.protectStaffOrERP,
    workspaceAccess,
    checkPermission("manage:members"),
    deleteWorkspace,
  );

// ===============================
// MEMBERS
// ===============================
router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage:members"),
  addMember,
);

router.delete(
  "/:id/members/:userId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("manage:members"),
  removeMember,
);

module.exports = router;
