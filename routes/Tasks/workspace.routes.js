const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");
const { workspaceAccess } = require("../../middlewares/Tasks/workspaceAccess");

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

// CREATE + GET ALL
router
  .route("/")
  .post(hrAuthServices.protectStaffOrERP, createWorkspace)
  .get(hrAuthServices.protectStaffOrERP, getMyWorkspaces);

// TREE
router.get("/tree", hrAuthServices.protectStaffOrERP, getUserWorkspaceTree);
// GET ONE + UPDATE + DELETE
router
  .route("/:id")
  .get(hrAuthServices.protectStaffOrERP, workspaceAccess, getWorkspace)
  .patch(hrAuthServices.protectStaffOrERP, workspaceAccess, updateWorkspace)
  .delete(hrAuthServices.protectStaffOrERP, workspaceAccess, deleteWorkspace);

// MEMBERS
router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  addMember,
);
router.delete(
  "/:id/members/:userId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  removeMember,
);

module.exports = router;
