const express = require("express");
const authService = require("../../services/authService");
const {
  createTable,
  deleteTable,
  getAllTables,
  getOneTable,
  updateTable,
} = require("../../services/resturant_management/tableService");

const router = express.Router();
router.use(authService.protect);

router
  .route("/")
  .get(authService.allowedTo("table.read"), getAllTables)
  .post(authService.allowedTo("table.create"), createTable);
router
  .route("/:id")
  .get(authService.allowedTo("table.read"), getOneTable)
  .put(authService.allowedTo("table.update"), updateTable)
  .delete(authService.allowedTo("table.delete"), deleteTable);

module.exports = router;
