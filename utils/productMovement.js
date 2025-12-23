const mongoose = require("mongoose");
const ProductMovementSchema = require("../models/productMovementModel");
const ApiError = require("./apiError");

const createProductMovement = async ({
  productId,
  reference,
  newQuantity,
  quantity,
  movementType,
  source,
  companyId,
  desc,
  enterPrice,
  outPrice,
  stockId,
  sellingPrice,
  buyingPrice,
}) => {
  try {
    const newMovement = new ProductMovementSchema({
      productId,
      reference,
      quantity,
      newQuantity,
      movementType,
      source,
      desc,
      companyId,
      enterPrice: enterPrice,
      outPrice: outPrice,
      referenceModel:
        source === "Sales Invoice"
          ? "Sales"
          : source === "Purchase Invoice"
          ? "PurchaseInvoices"
          : source === "Stock reconciliation"
          ? "Reconciliation"
          : source === "Stock Transfer"
          ? "StockTransfer"
          : null,
      stockId,
      sellingPrice,
      buyingPrice,
    });
    const savedMovement = await newMovement.save();

    return savedMovement;
  } catch (error) {
    console.error("Error saving product movement:", error);
    throw new ApiError(
      `Error creating product movement: ${error.message}`,
      500
    );
  }
};

module.exports = { createProductMovement };
