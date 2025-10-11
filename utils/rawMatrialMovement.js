const mongoose = require("mongoose");
const RawMatrialMovement = require("../models/rawMatrialMovementModel");
const ApiError = require("./apiError");

const createRawMatrialMovement = async (
  rawMatrialId,
  reference,
  quantity,
  newQuantity,
  newPrice,
  oldPrice,
  type,
  movementType,
  source,
  companyId,
  desc,
  newCurrency,
  oldCurrency
) => {
  try {
    const newMovement = new RawMatrialMovement({
      rawMatrialId,
      reference,
      quantity,
      newQuantity,
      newPrice,
      oldPrice,
      type,
      movementType,
      source,
      desc,
      newCurrency,
      oldCurrency,
      companyId,
    });

    const savedMovement = await newMovement.save();
    return savedMovement;
  } catch (error) {
    console.error("Error saving raw material movement:", error);
    throw new ApiError(
      `Error creating raw material movement: ${error.message}`,
      500
    );
  }
};

module.exports = { createRawMatrialMovement };
