const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const menuOrderModel = require("../../models/resturant_management/menuOrderModel");

// @desc Create menuOrder
// @route POST /api/menuOrder
// @access Private

exports.createmenuOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;
  const menuOrderData = req.body;

  try {
    const menuOrder = await menuOrderModel.create(menuOrderData);

    res.status(201).json({
      status: "true",
      message: "menuOrder inserted",
      data: menuOrder,
    });
  } catch (error) {
    console.error(`Error creating menuOrder: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Get all menuOrder
// @route GET /api/menuOrder
// @access Private
exports.getAllmenuOrders = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const menuOrders = await menuOrderModel.find({ companyId }).populate("orderItems.productId");
    console.log(menuOrders);
    
    res.status(200).json({
      status: "true",
      message: "menuOrders fetched",
      data: menuOrders,
    });
  } catch (error) {

    console.error(`Error fetching menuOrders: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Get one menuOrder
// @route GET /api/menuOrder
// @access Private
exports.getOnemenuOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const menuOrder = await menuOrderModel.findOne({
      _id: req.params.id,
      companyId,
    });

    if (!menuOrder) {
      return res.status(404).json({
        status: false,
        message: "menuOrder not found",
      });
    }

    res.status(200).json({
      status: "true",
      message: "menuOrder fetched",
      data: menuOrder,
    });
  } catch (error) {
    console.error(`Error fetching menuOrder: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Update menuOrder
// @route PUT /api/menuOrder/:id
// @access Private
exports.updatemenuOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const menuOrderId = req.params.id;
  const updatedData = req.body;

  try {
    const updatedmenuOrder = await menuOrderModel.findOneAndUpdate(
      { _id: menuOrderId, companyId },
      updatedData,
      { new: true, runValidators: true }
    );

    if (!updatedmenuOrder) {
      return res.status(404).json({
        status: false,
        message: "menuOrder not found",
      });
    }

    res.status(200).json({
      status: "true",
      message: "menuOrder updated",
      data: updatedmenuOrder,
    });
  } catch (error) {
    console.error(`Error updating menuOrder: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Delete menuOrder
// @route DELETE /api/menuOrder/:id
// @access Private
exports.deletemenuOrder = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const menuOrderId = req.params.id;

  try {
    const deletedmenuOrder = await menuOrderModel.findOneAndDelete({
      _id: menuOrderId,
      companyId,
    });

    if (!deletedmenuOrder) {
      return res.status(404).json({
        status: false,
        message: "menuOrder not found",
      });
    }

    res.status(200).json({
      status: "true",
      message: "menuOrder deleted",
    });
  } catch (error) {
    // Handle errors
    console.error(`Error deleting menuOrder: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
