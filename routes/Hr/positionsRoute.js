const express = require("express");
const authService = require("../../services/authService");
const {
  getAllPositions,
  createPositions,
  getOnePositions,
  updatePositions,
  deletePositions,
} = require("../../services/Hr/positionsServices");

const positionsRout = express.Router();

positionsRout.use(authService.protect);

positionsRout
  .route("/")
  .get(authService.allowedTo("positions.read"), getAllPositions)
  .post(authService.checkCompanyEditable, createPositions);

positionsRout
  .route("/:id")
  .get(authService.allowedTo("positions.read"), getOnePositions)
  .put(authService.checkCompanyEditable, updatePositions)
  .delete(authService.checkCompanyEditable, deletePositions);

module.exports = positionsRout;
