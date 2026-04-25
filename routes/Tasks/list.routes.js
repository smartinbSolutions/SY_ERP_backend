const express = require("express");
const router = express.Router();

const hrAuthServices = require("../../services/Hr/hrAuthServices");
const {
  createList,
  getLists,
  getList,
  updateList,
  deleteList,
  addMember,
} = require("../../controllers/Tasks/list.controller");
const { listAccess } = require("../../middlewares/Tasks/listAccess");

// CREATE
router.post("/", hrAuthServices.protectStaffOrERP, createList);

// GET BY WORKSPACE
router.get("/:workspaceId", hrAuthServices.protectStaffOrERP, getLists);

// GET ONE
router.get(
  "/single/:id",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  getList,
);

// UPDATE
router.put("/:id", hrAuthServices.protectStaffOrERP, listAccess, updateList);

// DELETE
router.delete("/:id", hrAuthServices.protectStaffOrERP, listAccess, deleteList);

// ADD MEMBER
router.post(
  "/:id/members",
  hrAuthServices.protectStaffOrERP,
  listAccess,
  addMember,
);

module.exports = router;
