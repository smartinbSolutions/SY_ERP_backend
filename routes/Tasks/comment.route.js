const express = require("express");

const authService = require("../../services/authService");
const {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} = require("../../controllers/Tasks/comment.controller");

const hrAuthServices = require("../../services/Hr/hrAuthServices");

const commentRoute = express.Router();

commentRoute
  .route("/")
  .get(hrAuthServices.protectStaffOrERP, getComments)
  .post(hrAuthServices.protectStaffOrERP, createComment);

commentRoute
  .route("/:id")
  .put(hrAuthServices.protectStaffOrERP, updateComment)
  .delete(hrAuthServices.protectStaffOrERP, deleteComment);

module.exports = commentRoute;
