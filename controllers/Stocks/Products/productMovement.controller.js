const asyncHandler = require("express-async-handler");
const service = require("../services/productMovementService");

exports.getAllProductsMovements = asyncHandler(async (req, res) => {
  const { companyId } = req;
  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const { keyword, stockId, productId } = req.query;
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;

  const { movements, totalPages } = await service.getAllMovements({
    companyId,
    keyword,
    stockId,
    productId,
    pageSize,
    page,
  });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: movements.length,
    data: movements,
  });
});

exports.getProductMovementByID = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { companyId } = req;
  if (!companyId)
    return res.status(400).json({ message: "companyId is required" });

  const { movementType, startDate, endDate } = req.query;
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;

  if (
    startDate &&
    endDate &&
    (isNaN(new Date(startDate)) || isNaN(new Date(endDate)))
  ) {
    return res
      .status(400)
      .json({ status: "false", message: "Invalid date range" });
  }

  const { movements, totalPages } = await service.getOneMovement({
    companyId,
    productId: id,
    movementType,
    startDate,
    endDate,
    pageSize,
    page,
  });

  res.status(200).json({
    status: "true",
    Pages: totalPages,
    results: movements.length,
    data: movements,
  });
});
