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

router.route("/").get(getAllTables).post(createTable);
router.route("/:id").get(getOneTable).put(updateTable).delete(deleteTable);

module.exports = router;
