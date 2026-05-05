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

// ======================================
// GLOBAL AUTH
// ======================================
router.use(hrAuthServices.protectStaffOrERP);

// ======================================
// CREATE LIST
// ======================================
router.post("/", workspaceAccess, checkPermission("create:list"), createList);

// ======================================
// GET LISTS BY WORKSPACE
// ======================================
router.get("/workspace/:workspaceId", workspaceAccess, getLists);

// ======================================
// GET SINGLE LIST
// ======================================
router.get("/single/:id", workspaceAccess, listAccess, getList);

// ======================================
// UPDATE LIST
// ======================================
router.patch(
  "/:id",
  workspaceAccess,
  listAccess,
  checkPermission("update:list"),
  updateList,
);

// ======================================
// DELETE LIST
// ======================================
router.delete(
  "/:id",
  workspaceAccess,
  listAccess,
  checkPermission("delete:list"),
  deleteList,
);

// ======================================
// ADD MEMBER TO LIST
// (admin operation → no listAccess needed)
// ======================================
router.post(
  "/:id/members",
  workspaceAccess,
  checkPermission("manage:members"),
  addMember,
);

module.exports = router;
