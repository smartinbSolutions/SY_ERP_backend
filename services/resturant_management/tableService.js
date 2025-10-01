const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const tablesModel = require("../../models/resturant_management/tablesModel");

// @desc Create Table
// @route POST /api/table
// @access Private
exports.createTable = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  try {
    // Create Table with the provided currency
    const table = await tablesModel.create(req.body);

    // Respond with success message and created Table data
    res.status(201).json({
      status: "true",
      message: "Table inserted",
      data: table,
    });
  } catch (error) {
    // Handle errors
    console.error(`Error creating Table: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Get all Tables
// @route GET /api/table
// @access Private
exports.getAllTables = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 10; // عدد العناصر في الصفحة
  const page = parseInt(req.query.page) || 1; // رقم الصفحة الحالي
  const skip = (page - 1) * pageSize;

  try {
    const query = { companyId };

    // حساب العدد الكلي للـ Tables
    const totalItems = await tablesModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / pageSize);

    // Fetch Tables with pagination
    const tables = await tablesModel.find(query).skip(skip).limit(pageSize);

    // Respond with success message and data
    res.status(200).json({
      status: true,
      message: "Tables fetched",
      totalItems,
      currentPage: page,
      totalPages,
      results: tables.length,
      data: tables,
    });
  } catch (error) {
    console.error(`Error fetching Tables: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get one Table
// @route GET /api/table
// @access Private
exports.getOneTable = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const table = await tablesModel.findOne({ _id: req.params.id, companyId });
    if (!table) {
      return res.status(404).json({
        status: false,
        message: "Table not found",
      });
    }

    res.status(200).json({
      status: "true",
      message: "Table fetched",
      data: table,
    });
  } catch (error) {
    console.error(`Error fetching Table: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Update Table
// @route PUT /api/table/:id
// @access Private
exports.updateTable = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const tableId = req.params.id;
  const updatedData = req.body;

  try {
    // Find and update the Table
    const updatedTable = await tablesModel.findOneAndUpdate(
      { _id: tableId, companyId },
      updatedData,
      { new: true, runValidators: true }
    );

    // If the Table is not found
    if (!updatedTable) {
      return res.status(404).json({
        status: false,
        message: "Table not found",
      });
    }

    // Respond with success message and updated data
    res.status(200).json({
      status: "true",
      message: "Table updated",
      data: updatedTable,
    });
  } catch (error) {
    // Handle errors
    console.error(`Error updating Table: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Delete Table
// @route DELETE /api/table/:id
// @access Private
exports.deleteTable = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const tableId = req.params.id;

  try {
    // Find and delete the Table
    const deletedTable = await tablesModel.findOneAndDelete({
      _id: tableId,
      companyId,
    });

    // If the Table is not found
    if (!deletedTable) {
      return res.status(404).json({
        status: false,
        message: "Table not found",
      });
    }

    // Respond with success message
    res.status(200).json({
      status: "true",
      message: "Table deleted",
    });
  } catch (error) {
    // Handle errors
    console.error(`Error deleting Table: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
