const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const {
  workspaceAccess,
  listAccess,
} = require("../../middlewares/Tasks/AccessMiddleware");

const {
  createList,
  getLists,
  getList,
  updateList,
  deleteList,
  addMember,
} = require("../../controllers/Tasks/list.controller");
const checkPermission = require("../../middlewares/Tasks/permssionMiddleware");

// ===============================
// CREATE LIST
// ===============================
router.post(
  "/",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  checkPermission("create:task"),
  createList,
);

// ===============================
// GET LISTS BY WORKSPACE
// ===============================
router.get(
  "/:workspaceId",
  hrAuthServices.protectStaffOrERP,
  workspaceAccess,
  getLists,
);

// ===============================
// GET SINGLE LIST
// ===============================
router.get(
  "/single/:id",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  getList,
);

// ===============================
// UPDATE LIST
// ===============================
router.patch(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  checkPermission("update:task"),
  updateList,
);

// ===============================
// DELETE LIST
// ===============================
router.delete(
  "/:id",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  checkPermission("delete:task"),
  deleteList,
);

// ===============================
// ADD MEMBER TO LIST
// ===============================
router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  checkPermission("manage:members"),
  addMember,
);

module.exports = router;
