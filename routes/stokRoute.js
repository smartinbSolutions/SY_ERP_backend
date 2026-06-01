const express = require("express");

const authService = require("../services/authService");
const {
  getStocks,
  createStock,
  getOneStock,
  updateStock,
  deleteStock,
  transformQuantity,
  getTransferStock,
  getOneTransferStock,
  getTransferForStock,
  getAllStatementStock,
  getStocksProducts,
} = require("../services/stockService");

const stockRout = express.Router();

stockRout
  .route("/")
  .get(authService.protect, authService.allowedTo("stock.read"), getStocks)
  .post(
    authService.protect,
    authService.allowedTo("stock.create"),
    authService.checkCompanyEditable,
    createStock,
  );
stockRout
  .route("/transfer")
  .get(authService.protect, authService.allowedTo("stock_transfers.read"), getTransferStock)
  .put(
    authService.protect,
    authService.allowedTo("stock_transfers.create"),
    authService.checkCompanyEditable,
    transformQuantity,
  );
stockRout.route("/stock-report").get(authService.protect, authService.allowedTo("stock.read"), getStocksProducts);
stockRout.route("/transfer/:id").get(authService.protect, authService.allowedTo("stock_transfers.read"), getOneTransferStock);
stockRout.route("/transferforstock/:id").get(authService.protect, authService.allowedTo("stock_transfers.read"), getTransferForStock);
stockRout.route("/transferallstatementstock").get(authService.protect, authService.allowedTo("stock_transfers.read"), getAllStatementStock);
stockRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("stock.read"), getOneStock)
  .put(
    authService.protect,
    authService.allowedTo("stock.update"),
    authService.checkCompanyEditable,
    updateStock,
  )
  .delete(
    authService.protect,
    authService.allowedTo("stock.delete"),
    authService.checkCompanyEditable,
    deleteStock,
  );

module.exports = stockRout;
