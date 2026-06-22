const express = require("express");

const authService = require("../../services/authService");
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
} = require("../../services/Stocks/stockService");

const stockRout = express.Router();

stockRout.use(authService.protect, authService.checkPlanFeatures("inventory"));

stockRout
  .route("/")
  .get(authService.allowedTo("stock.read"), getStocks)
  .post(
    authService.allowedTo("stock.create"),
    authService.checkCompanyEditable,
    createStock
  );
stockRout
  .route("/transfer")
  .get(authService.allowedTo("stock_transfers.read"), getTransferStock)
  .put(
    authService.allowedTo("stock_transfers.create"),
    authService.checkCompanyEditable,
    transformQuantity
  );
stockRout
  .route("/stock-report")
  .get(authService.allowedTo("stock.read"), getStocksProducts);
stockRout
  .route("/transfer/:id")
  .get(authService.allowedTo("stock_transfers.read"), getOneTransferStock);
stockRout
  .route("/transferforstock/:id")
  .get(authService.allowedTo("stock_transfers.read"), getTransferForStock);
stockRout
  .route("/transferallstatementstock")
  .get(authService.allowedTo("stock_transfers.read"), getAllStatementStock);
stockRout
  .route("/:id")
  .get(authService.protect, authService.allowedTo("stock.read"), getOneStock)
  .put(
    authService.allowedTo("stock.update"),
    authService.checkCompanyEditable,
    updateStock
  )
  .delete(
    authService.allowedTo("stock.delete"),
    authService.checkCompanyEditable,
    deleteStock
  );

module.exports = stockRout;
