const express = require("express");
const authService = require("../../services/authService");
const {
  createFile,
  deleteFile,
  getAllFiles,
  getOneFile,
  updateFile,
} = require("../../services/Hr/filesService");

const filesRoute = express.Router();

filesRoute.route("/").get(getAllFiles).post(createFile);

filesRoute.route("/:id").get(getOneFile).put(updateFile).delete(deleteFile);

module.exports = filesRoute;
