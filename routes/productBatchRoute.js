const express = require("express");

const authService = require("../services/authService");
const { getAllProductBatch } = require("../services/productBatchServices");

const productBatchRoute = express.Router();

productBatchRoute.use(authService.protect);

productBatchRoute.route("/:id").get(getAllProductBatch);

module.exports = productBatchRoute;
