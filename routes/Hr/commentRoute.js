const express = require("express");

const authService = require("../../services/authService");
const {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} = require("../../controllers/Hr/comment.controller");

const commentRoute = express.Router();

commentRoute
  .route("/")
  .get(authService.protect, getComments)
  .post(authService.protect, createComment);

commentRoute
  .route("/:id")
  .put(authService.protect, updateComment)
  .delete(authService.protect, deleteComment);

module.exports = commentRoute;
