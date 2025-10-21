const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const menuOrderModel = require("../../models/resturant_management/menuOrderModel");
const recipeModel = require("../../models/resturant_management/recipeModel");
const batchModel = require("../../models/resturant_management/batchModel");
const { createRawMatrialMovement } = require("../../utils/rawMatrialMovement");
const { getIo } = require("../../utils/socket");

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
    const io = getIo();
    const salePointId = menuOrder.salePointId?.toString();

    if (salePointId) {
      io.to("kitchen").emit("newOrderCreated", {
        eventType: "newOrderCreated",
        orderId: menuOrder._id,
        salePointId,
        orderStatus: menuOrder.orderStatus,
        orderData: menuOrder,
        message: `🆕 New order received from SalePoint ${salePointId}`,
      });

      io.to(salePointId).emit("orderCreated", {
        eventType: "orderCreated",
        orderId: menuOrder._id,
        salePointId,
        orderStatus: menuOrder.orderStatus,
        orderData: menuOrder,
        message: `🆕 New order has been added from SalePoint ${salePointId}`,
      });
    }

    res.status(201).json({
      status: true,
      message: "menuOrder inserted successfully",
      data: menuOrder,
    });
  } catch (error) {
    console.error(`❌ Error creating menuOrder: ${error.message}`);

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
  const { companyId, orderStatus, salePointId } = req.query;

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

    if (salePointId) {
      filter.salePointId = salePointId;
    }

    const totalItems = await menuOrderModel.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / pageSize);

    const menuOrders = await menuOrderModel
      .find(filter)
      .populate("orderItems.productId")
      .populate("table")
      .populate({
        path: "salePointId",
        model: "salesPoints",
        populate: { path: "salesPointCurrency", model: "Currency" },
      })
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: true,
      message: "Orders retrieved successfully",
      results: menuOrders.length,
      totalItems,
      currentPage: page,
      totalPages,
      orders: menuOrders,
    });
  } catch (error) {
    console.error(Error`while fetching orders: ${error.message}`);
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
    // get copy for send notification to front
    const previousOrder = await menuOrderModel.findById(menuOrderId).lean();

    // update status
    const updatedmenuOrder = await menuOrderModel
      .findOneAndUpdate({ _id: menuOrderId, companyId }, updatedData, {
        new: true,
        runValidators: true,
      })
      .populate("orderItems.productId")
      .populate("salePointId");

    if (!updatedmenuOrder) {
      return res.status(404).json({
        status: false,
        message: "menuOrder not found",
      });
    }

    if (previousOrder.orderStatus !== updatedmenuOrder.orderStatus) {
      const io = getIo();
      const salePointRoomId = updatedmenuOrder.salePointId._id?.toString();

      if (salePointRoomId) {
        io.to(salePointRoomId).emit("orderUpdated", {
          eventType: "orderUpdated",
          orderStatus: updatedmenuOrder.orderStatus,
          salePointId: salePointRoomId,
        });
      }
    }

    res.status(200).json({
      status: true,
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
      .populate("orderItems.productId", "_id RecipeId name");

    if (!order) throw new Error("Order not found");

    let itemsToProcess = order.orderItems;

    if (productId) {
      itemsToProcess = order.orderItems.filter(
        (item) => item.productId._id.toString() === productId
      );

      if (itemsToProcess.length === 0) {
        throw new Error("Product not found in this order");
      }
    }

    for (const item of itemsToProcess) {
      const product = item.productId;

      if (product.RecipeId) {
        const recipe = await recipeModel
          .findById(product.RecipeId)
          .populate("recipeArray.rawMatrialId", "_id name")
          .lean();

        if (!recipe) {
          throw new Error(`Recipe not found for product ${product._id}`);
        }

        for (const material of recipe.recipeArray) {
          const requiredQty = material.quantity * item.quantity;
          let remainingQty = requiredQty;

          const availableBatches = await batchModel
            .find({
              rawMaterialId: material.rawMatrialId._id,
              leftQuantity: { $gt: 0 },
            })
            .sort({ createdAt: 1 });

          for (const batch of availableBatches) {
            if (remainingQty <= 0) break;

            const deductQty = Math.min(batch.leftQuantity, remainingQty);
            batch.leftQuantity -= deductQty;
            remainingQty -= deductQty;
            await batch.save();

            await createRawMatrialMovement(
              material.rawMatrialId._id,
              order._id,
              deductQty,
              batch.leftQuantity,
              batch.buyingPrice,
              batch.buyingPrice,
              "Menu Order Consumption",
              "out",
              "MenuOrder",
              companyId,
              `Consumed in order ${order._id}`,
              batch.currency || "",
              batch.currency || ""
            );
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

          await createRawMatrialMovement(
            product._id,
            order._id,
            deductQty,
            batch.leftQuantity,
            batch.buyingPrice,
            batch.buyingPrice,
            "Menu Order Consumption",
            "out",
            "MenuOrder",
            companyId,
            `Consumed in order ${order._id}`,
            batch.currency || "",
            batch.currency || ""
          );
        }
      }

      item.status = "In Progress";
    }

    const allInProgress = order.orderItems.some(
      (i) => i.status === "In Progress"
    );
    if (allInProgress) {
      order.orderStatus = "In Progress";
    }

    await order.save();

    // 🔹 Emit socket event for status update
    const io = getIo();
    io.to(order.salePointId?._id.toString()).emit("orderUpdated", {
      eventType: "orderUpdated",
      orderId: order._id,
      orderStatus: order.orderStatus,
      updatedProducts: order.orderItems.map((item) => ({
        productId: item.productId._id,
        productName: item.productId.name || "",
        quantity: item.quantity,
        status: item.status,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        note: item.note || "",
      })),
      salePointId: order.salePointId?._id?.toString() || null,
    });

    res.status(200).json({
      status: true,
      message: productId
        ? `Product ${productId} moved to In Progress successfully`
        : "Order moved to In Progress successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
});
