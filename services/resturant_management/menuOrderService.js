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
  const { companyId, orderStatus } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    let filter = { companyId };
    if (orderStatus) {
      filter.orderStatus = orderStatus;
    }

    const menuOrders = await menuOrderModel
      .find(filter)
      .populate("orderItems.productId");

    res.status(200).json({
      status: true,
      message: "orders fecthed successfully",
      orderNumber: menuOrders.length,
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
    console.error(`Error deleting menuOrder: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});


async function moveOrderToInProgress(orderId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await MenuOrder.findById(orderId)
      .populate("orderItems.productId")
      .session(session);  

    if (!order) throw new Error("Order not found");
    if (order.orderStatus !== "Pending") {
      throw new Error("Order must be in Pending state");
    }

    for (let item of order.orderItems) {
      const product = item.productId;

      const recipe = await Recipe.findById(product.recipeId)
        .populate("rawMaterials.rawMaterialId")
        .session(session);

      if (!recipe) throw new Error(`Recipe not found for product ${product._id}`);

      for (let material of recipe.rawMaterials) {
        const requiredQty = material.quantity * item.quantity;

        let batches = await Batch.find({
          rawMaterialId: material.rawMaterialId,
          amount: { $gt: 0 }
        })
          .sort({ createdAt: 1 })
          .session(session);

        let remaining = requiredQty;

        for (let batch of batches) {
          if (remaining <= 0) break;

          if (batch.amount >= remaining) {
            batch.amount -= remaining;
            await batch.save({ session });
            remaining = 0;
          } else {
            remaining -= batch.amount;
            batch.amount = 0;
            await batch.save({ session });
          }
        }

        if (remaining > 0) {
          throw new Error(`Not enough stock for raw material ${material.rawMaterialId}`);
        }
      }
    }

    order.orderStatus = "In Progress";
    await order.save({ session });

    // 6. Commit Transaction
    await session.commitTransaction();
    session.endSession();

    return order;

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

module.exports = { moveOrderToInProgress };