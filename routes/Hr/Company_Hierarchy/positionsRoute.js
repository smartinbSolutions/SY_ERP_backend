const express = require("express");
const authService = require("../../../services/authService");
const {
  getAllPositions,
  createPositions,
  getOnePositions,
  updatePositions,
  deletePositions,
} = require("../../../services/Hr/Company_Hierarchy/positionsServices");

const positionsRout = express.Router();

positionsRout.use(authService.protect);

positionsRout
  .route("/")
  .get(authService.allowedTo("positions.read"), getAllPositions)
  .post(createPositions);

positionsRout
  .route("/:id")
  .get(authService.allowedTo("positions.read"), getOnePositions)
  .put(updatePositions)
  .delete(deletePositions);

module.exports = positionsRout;
