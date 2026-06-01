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

groupsRoute
  .route("/")
  .get(authService.protect, authService.allowedTo("group.read"), getAllGroups)
  .post(authService.protect, authService.allowedTo("group.create"), createGroups);

groupsRoute
  .route("/:id")
  .get(authService.protect, authService.allowedTo("group.read"), getOneGroups)
  .put(authService.protect, authService.allowedTo("group.update"), updateGroups)
  .delete(authService.protect, authService.allowedTo("group.delete"), deleteGroups);

module.exports = groupsRoute;
