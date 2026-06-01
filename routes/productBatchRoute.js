const express = require("express");

const authService = require("../services/authService");
const { getAllProductBatch } = require("../services/productBatchServices");

const productBatchRoute = express.Router();

productBatchRoute.use(authService.protect);

productBatchRoute.route("/:id").get(authService.allowedTo("products.read"), getAllProductBatch);

module.exports = productBatchRoute;
