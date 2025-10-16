const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const BatchModel = require("../../models/resturant_management/batchModel");
const RawMaterialModel = require("../../models/resturant_management/rawMaterialModel");
// const stockSchema = require("../../models/stockModel");
const { createRawMatrialMovement } = require("../../utils/rawMatrialMovement");

// @desc Create Batch
// @route POST /api/Batch
// @access Private

exports.createBatch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    console.log("❌ companyId is missing");
    return res.status(400).json({ message: "companyId is required" });
  }

  req.body.companyId = companyId;
  const BatchData = req.body;

  try {
    console.log("➡️ Starting Batch creation process...");
    console.log("📦 Incoming Batch Data:", BatchData);

    // ✅ Validate rawMaterialId
    if (!mongoose.Types.ObjectId.isValid(BatchData.rawMaterialId)) {
      console.log("❌ Invalid rawMaterialId:", BatchData.rawMaterialId);
      return res.status(400).json({
        status: false,
        message: "Invalid rawMaterialId",
      });
    }

    // ✅ Update RawMaterial
    console.log("🔍 Updating raw material with ID:", BatchData.rawMaterialId);
    const rawMaterial = await RawMaterialModel.findOneAndUpdate(
      { _id: BatchData.rawMaterialId, companyId },
      { $inc: { quantity: req.body.quantity, cost: req.body.buyingPrice } },
      { new: true }
    );

    if (!rawMaterial) {
      console.log("❌ Raw material not found for ID:", BatchData.rawMaterialId);
      return res.status(404).json({
        status: false,
        message: "Raw Material not found",
      });
    }

    console.log("✅ Raw material updated successfully:", rawMaterial._id);

    // ✅ Create Batch
    const Batch = await BatchModel.create(BatchData);
    console.log("✅ Batch created successfully:", Batch._id);

    // ✅ Create Raw Material Movement
    console.log("📊 Creating raw material movement record...");
    const movement = await createRawMatrialMovement(
      rawMaterial._id,
      Batch._id,
      req.body.quantity,
      rawMaterial.quantity,
      req.body.buyingPrice,
      rawMaterial.cost - req.body.buyingPrice,
      "Batch Creation",
      "in",
      "Batch",
      companyId,
      `A new batch has been added to raw material: ${rawMaterial.name}`,
      req.body.currency || "",
      rawMaterial.currency || ""
    );

    console.log("✅ Raw material movement created successfully:", movement._id);

    // ✅ Response
    console.log("🎉 Batch creation process completed successfully!");
    res.status(201).json({
      status: true,
      message: "Batch inserted successfully",
      data: Batch,
    });
  } catch (error) {
    console.error("🔥 Error during Batch creation process:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get allBatches
// @route GET /api/Batch
// @access Private
exports.getAllBatches = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params; // rawMaterialId
  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  try {
    const totalItems = await BatchModel.countDocuments({
      rawMaterialId: id,
      companyId,
    });

    const totalPages = Math.ceil(totalItems / pageSize);

    const batches = await BatchModel.find({ rawMaterialId: id, companyId })
      .populate("stockId")
      .skip(skip)
      .limit(pageSize);

    res.status(200).json({
      status: true,
      message: "Batches fetched",
      results: batches.length,
      totalItems,
      currentPage: page,
      totalPages,
      data: batches,
    });
  } catch (error) {
    console.error(`Error fetching Batches: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get one Batch
// @route GET /api/Batch
// @access Private
exports.getOneBatch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const Batch = await BatchModel.findOne({
      _id: req.params.id,
      companyId,
    }).populate("stockId");

    if (!Batch) {
      return res.status(404).json({
        status: false,
        message: "Batch not found",
      });
    }

    res.status(200).json({
      status: "true",
      message: "Batch fetched",
      data: Batch,
    });
  } catch (error) {
    console.error(`Error fetching Batch: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Update Batch
// @route PUT /api/Batch/:id
// @access Private
exports.updateBatch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const BatchId = req.params.id;
  const updatedData = req.body;

  try {
    // Find and update the Batch
    const updatedBatch = await BatchModel.findOneAndUpdate(
      { _id: BatchId, companyId },
      updatedData,
      { new: true, runValidators: true }
    );

    // If the Batch is not found
    if (!updatedBatch) {
      return res.status(404).json({
        status: false,
        message: "Batch not found",
      });
    }

    // Respond with success message and updated data
    res.status(200).json({
      status: "true",
      message: "Batch updated",
      data: updatedBatch,
    });
  } catch (error) {
    // Handle errors
    console.error(`Error updating Batch: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
// @desc Delete Batch
// @route DELETE /api/Batch/:id
// @access Private
exports.deleteBatch = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const BatchId = req.params.id;

  try {
    // Find and delete the Batch
    const deletedBatch = await BatchModel.findOneAndDelete({
      _id: BatchId,
      companyId,
    });

    // If the Batch is not found
    if (!deletedBatch) {
      return res.status(404).json({
        status: false,
        message: "Batch not found",
      });
    }

    // Respond with success message
    res.status(200).json({
      status: "true",
      message: "Batch deleted",
    });
  } catch (error) {
    // Handle errors
    console.error(`Error deleting Batch: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
