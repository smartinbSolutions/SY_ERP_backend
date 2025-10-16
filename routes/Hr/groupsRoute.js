const express = require("express");
const authService = require("../../services/authService");
const {
  createGroups,
  deleteGroups,
  getAllGroups,
  getOneGroups,
  updateGroups,
} = require("../../services/Hr/groupsService");

const groupsRoute = express.Router();

groupsRoute.route("/").get(getAllGroups).post(createGroups);

groupsRoute
  .route("/:id")
  .get(getOneGroups)
  .put(updateGroups)
  .delete(deleteGroups);

module.exports = groupsRoute;
