const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const menuOrderModel = require("../../models/resturant_management/menuOrderModel");
const recipeModel = require("../../models/resturant_management/recipeModel");
const batchModel = require("../../models/resturant_management/batchModel");
const { model } = require("mongoose");

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
  const { companyId, orderStatus } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  try {
    let filter = { companyId };
    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    if (pageSize > 0) {
      query = query.skip(skip).limit(pageSize);
    }
    const totalItems = await menuOrderModel.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / pageSize);

    const menuOrders = await menuOrderModel
      .find(filter)
      .populate("orderItems.productId")
      .populate("table")
      .skip(skip)
      .limit(pageSize);

    res.status(200).json({
      status: true,
      message: "Orders fetched successfully",
      results: menuOrders.length,
      totalItems,
      currentPage: page,
      totalPages,
      orders: menuOrders,
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
    const menuOrder = await menuOrderModel
      .findOne({
        _id: req.params.id,
        companyId,
      })
      .populate({
        path: "orderItems.productId",
        model: "manufactorProduct",
        populate: {
          path: "RecipeId",
          model: "recipe",
          populate: {
            path: "recipeArray.rawMatrialId",
            model: "RawMaterial",
            populate: {
              path: "unit",
              model: "Unit",
            },
          },
        },
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
//////
//////
exports.moveOrderToInProgress = asyncHandler(async (req, res, next) => {
  const { orderId, productId, companyId } = req.query;

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    return res.status(400).json({
      status: false,
      message: "Invalid or missing orderId",
    });
  }

  if (!companyId) {
    return res.status(400).json({
      status: false,
      message: "companyId is required",
    });
  }

  try {
    const order = await menuOrderModel
      .findOne({ _id: orderId, companyId })
      .populate("orderItems.productId", "_id");

    if (!order) throw new Error("Order not found");

    let itemsToProcess = order.orderItems;

    if (productId) {
      itemsToProcess = order.orderItems.filter(
        (item) => item.productId._id.toString() === productId
      );

      if (itemsToProcess.length === 0) {
        throw new Error("Product not found in this order");
      }
    } else {
    }

    for (const item of itemsToProcess) {
      const product = item.productId;

      if (product.RecipeId) {
        const recipe = await recipeModel
          .findById(product.RecipeId)
          .populate("recipeArray.rawMatrialId", "_id")
          .lean();

        if (!recipe) {
          throw new Error(`Recipe not found for product ${product._id}`);
        }

        for (const material of recipe.recipeArray) {
          const requiredQty = material.quantity * item.quantity;
          let remainingQty = requiredQty;

          const availableBatches = await batchModel
            .find({
              rawMaterialId: material.rawMatrialId,
              leftQuantity: { $gt: 0 },
            })
            .sort({ createdAt: 1 });

          for (const batch of availableBatches) {
            if (remainingQty <= 0) break;

            const deductQty = Math.min(batch.leftQuantity, remainingQty);
            batch.leftQuantity -= deductQty;
            remainingQty -= deductQty;
            await batch.save();
          }

          if (remainingQty > 0) {
          }
        }
      } else {
        const availableBatches = await batchModel
          .find({
            rawMaterialId: product._id,
            leftQuantity: { $gt: 0 },
          })
          .sort({ createdAt: 1 });

        let remainingQty = item.quantity;
        for (const batch of availableBatches) {
          if (remainingQty <= 0) break;

          const deductQty = Math.min(batch.leftQuantity, remainingQty);
          batch.leftQuantity -= deductQty;
          remainingQty -= deductQty;
          await batch.save();
        }
      }

      item.status = "In Progress";
    }

    const allInProgress = order.orderItems.every(
      (i) => i.status === "In Progress"
    );
    if (allInProgress) {
      order.orderStatus = "In Progress";
    }

    await order.save();

    res.status(200).json({
      status: true,
      message: productId
        ? `Product ${productId} moved to In Progress successfully`
        : "Order moved to In Progress successfully",
      data: order,
    });
  } catch (error) {
    console.log("❌ Error:", error.message);
    next(error);
  }
});
