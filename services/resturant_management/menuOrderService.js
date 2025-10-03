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

  console.log("🚀 moveOrderToInProgress called with:", { orderId, productId, companyId });

  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    console.log("❌ Invalid or missing orderId");
    return res
      .status(400)
      .json({ status: false, message: "Invalid or missing orderId" });
  }

  if (!companyId) {
    console.log("❌ companyId is required");
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await menuOrderModel
      .findOne({ _id: orderId, companyId })
      .populate("orderItems.productId")
      .session(session);

    if (!order) throw new Error("Order not found");

    console.log("✅ Order fetched:", order._id);

    let itemsToProcess = order.orderItems;

    if (productId) {
      itemsToProcess = order.orderItems.filter(
        (item) => item.productId._id.toString() === productId
      );

      if (itemsToProcess.length === 0) {
        throw new Error("Product not found in this order");
      }

      console.log(`✅ Processing single product: ${productId}`);
    } else {
      console.log(`✅ Processing all products in the order`);
    }

    for (const item of itemsToProcess) {
      const product = item.productId;
      console.log(`➡ Processing item: ${item._id}, product: ${product.Productname}`);

      if (product.RecipeId) {
        console.log(`🔹 Product has recipe: ${product.RecipeId}`);

        const recipe = await recipeModel
          .findById(product.RecipeId)
          .populate("recipeArray.rawMatrialId")
          .session(session);

        if (!recipe) {
          console.log(`❌ Recipe not found for product ${product._id}`);
          throw new Error(`Recipe not found for product ${product._id}`);
        }

        for (const material of recipe.recipeArray) {
          const requiredQty = material.quantity * item.quantity;
          let remainingQty = requiredQty;
          console.log(`   🔸 Material: ${material.rawMatrialId}, requiredQty: ${requiredQty}`);

          const availableBatches = await batchModel
            .find({
              rawMaterialId: material.rawMatrialId,
              leftQuantity: { $gt: 0 },
            })
            .sort({ createdAt: 1 })
            .session(session);

          for (const batch of availableBatches) {
            if (remainingQty <= 0) break;

            const deductQty = Math.min(batch.leftQuantity, remainingQty);
            console.log(`      - Deducting ${deductQty} from batch ${batch._id}`);
            batch.leftQuantity -= deductQty;
            remainingQty -= deductQty;
            await batch.save({ session });
          }

          if (remainingQty > 0) {
            console.log(`⚠ Not enough stock for material ${material.rawMatrialId}. Missing: ${remainingQty}`);
          }
        }
      } else {
        console.log(`🔹 Product has no recipe, deducting from product stock`);

        const availableBatches = await batchModel
          .find({
            rawMaterialId: product._id,
            leftQuantity: { $gt: 0 },
          })
          .sort({ createdAt: 1 })
          .session(session);

        let remainingQty = item.quantity;
        for (const batch of availableBatches) {
          if (remainingQty <= 0) break;

          const deductQty = Math.min(batch.leftQuantity, remainingQty);
          console.log(`      - Deducting ${deductQty} from batch ${batch._id}`);
          batch.leftQuantity -= deductQty;
          remainingQty -= deductQty;
          await batch.save({ session });
        }

        if (remainingQty > 0) {
          console.log(`⚠ Not enough stock for product ${product._id}. Missing: ${remainingQty}`);
        }
      }

      item.status = "In Progress";
      console.log(`✅ Item ${item._id} status updated to In Progress`);
    }

    const allInProgress = order.orderItems.every(
      (i) => i.status === "In Progress"
    );
    if (allInProgress) {
      order.orderStatus = "In Progress";
      console.log(`✅ Order ${order._id} status updated to In Progress`);
    }

    await order.save({ session });
    await session.commitTransaction();

    console.log("🎉 Transaction committed successfully");

    res.status(200).json({
      status: true,
      message: productId
        ? `Product ${productId} moved to In Progress successfully`
        : "Order moved to In Progress successfully",
      data: order,
    });
  } catch (error) {
    await session.abortTransaction();
    console.log("❌ Transaction aborted due to error:", error.message);
    next(error);
  } finally {
    session.endSession();
    console.log("🛑 Session ended");
  }
});
