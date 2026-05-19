const asyncHandler = require("express-async-handler");
const billOfMaterialsModel = require("../../models/manufacturing/billOfMaterialsModel");
const productionLogModel = require("../../models/manufacturing/productionLogModel");
const productModel = require("../../models/productModel");
const mongoose = require("mongoose");
const { createProductBatch } = require("../productBatchServices");
const { createProductMovement } = require("../../utils/productMovement");
const stockModel = require("../../models/stockModel");
const counterModel = require("../../models/Settings/counterModel");
const prodcutBatchModel = require("../../models/Stocks/products/prodcutBatchModel");

exports.createBOM = asyncHandler(async (req, res) => {
  const {
    productId,
    baseQuantity,
    selectedUnit,
    unitEqual,
    ingredients,
    preparationSteps = [],
  } = req.body;

  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!productId || !baseQuantity || !ingredients?.length) {
    return res.status(400).json({ message: "Invalid BOM data" });
  }

  // deactivate old BOM
  await billOfMaterialsModel.updateMany(
    { productId, companyId, isActive: true },
    { isActive: false },
  );

  const normalizedIngredients = ingredients.map((ing) => ({
    rawMaterialId: ing.rawMaterialId,
    quantity: {
      value: Number(ing.quantity?.value),
      unit: ing.quantity?.unit,
    },
    selectedUnit: ing.selectedUnit || ing.quantity?.unit,
    unitEqual: Number(ing.unitEqual) || 1,
  }));

  const normalizedPreparationSteps = (preparationSteps || []).map(
    (step, index) => ({
      stepNumber: Number(step.stepNumber) || index + 1,
      instruction: String(step.instruction || "").trim(),
      ingredients: (step.ingredients || []).map((item) => ({
        rawMaterialId: item.rawMaterialId,
        quantity: Number(item.quantity) || 0,
      })),
      preparationTimeMinutes: Number(step.preparationTimeMinutes) || 0,
    }),
  );

  const bom = await billOfMaterialsModel.create({
    productId,
    baseQuantity: {
      value: Number(baseQuantity.value),
      unit: baseQuantity.unit,
    },
    selectedUnit: selectedUnit || baseQuantity.unit,
    unitEqual: Number(unitEqual) || 1,
    ingredients: normalizedIngredients,
    preparationSteps: normalizedPreparationSteps,
    isActive: true,
    companyId,
  });

  res.status(201).json({
    status: "success",
    message: "BOM created",
    data: bom,
  });
});

exports.getActiveBOM = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const bom = await billOfMaterialsModel
    .findOne({ productId, isActive: true })
    .populate({ path: "baseQuantity.unit" })
    .populate({ path: "ingredients.rawMaterialId" })
    .populate({ path: "ingredients.quantity.unit" });

  if (!bom) {
    return res.status(404).json({ message: "No active BOM found" });
  }

  res.status(200).json({ status: "success", data: bom });
});

exports.updateBOM = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const {
    baseQuantity,
    selectedUnit,
    unitEqual,
    ingredients,
    preparationSteps = [],
  } = req.body;

  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!baseQuantity || !ingredients?.length) {
    return res.status(400).json({ message: "Invalid BOM data" });
  }

  const currentBOM = await billOfMaterialsModel.findOne({
    productId,
    companyId,
    isActive: true,
  });

  if (!currentBOM) {
    return res.status(404).json({ message: "No active BOM found" });
  }

  const normalizedIngredients = ingredients.map((ing) => ({
    rawMaterialId: ing.rawMaterialId,
    quantity: {
      value: Number(ing.quantity?.value),
      unit: ing.quantity?.unit,
    },
    selectedUnit: ing.selectedUnit || ing.quantity?.unit,
    unitEqual: Number(ing.unitEqual) || 1,
  }));

  const normalizedPreparationSteps = (preparationSteps || []).map(
    (step, index) => ({
      stepNumber: Number(step.stepNumber) || index + 1,
      instruction: String(step.instruction || "").trim(),
      ingredients: (step.ingredients || []).map((item) => ({
        rawMaterialId: item.rawMaterialId,
        quantity: Number(item.quantity) || 0,
      })),
      preparationTimeMinutes: Number(step.preparationTimeMinutes) || 0,
    }),
  );

  const newBOM = await billOfMaterialsModel.findOneAndUpdate(
    { productId, companyId, isActive: true },
    {
      baseQuantity: {
        value: Number(baseQuantity.value),
        unit: baseQuantity.unit,
      },
      selectedUnit: selectedUnit || baseQuantity.unit,
      unitEqual: Number(unitEqual) || 1,
      ingredients: normalizedIngredients,
      preparationSteps: normalizedPreparationSteps,
    },
    { new: true },
  );

  res.status(200).json({
    status: "success",
    message: "BOM updated",
    data: newBOM,
  });
});

exports.deleteBOM = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const bom = await billOfMaterialsModel.findOneAndUpdate(
    { productId, isActive: true },
    { isActive: false },
    { new: true },
  );

  if (!bom) {
    return res.status(404).json({ message: "No active BOM found" });
  }

  res.status(200).json({
    status: "success",
    message: "BOM deactivated",
    data: bom,
  });
});

exports.getAllBOMs = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * limit;

  const query = { companyId };

  // Optional filters
  if (req.query.productId) {
    query.productId = req.query.productId;
  }

  if (req.query.isActive !== undefined) {
    query.isActive = req.query.isActive === "true";
  }

  if (req.query.keyword) {
    const products = await productModel
      .find({
        name: { $regex: req.query.keyword, $options: "i" },
        companyId,
      })
      .select("_id");

    const productIds = products.map((p) => p._id);

    query.productId = { $in: productIds };
  }

  const totalItems = await billOfMaterialsModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit);

  const boms = await billOfMaterialsModel
    .find(query)
    .populate({ path: "productId", select: "name _id image" })
    .populate({ path: "ingredients.rawMaterialId", select: "name _id" })
    .populate({ path: "ingredients.quantity.unit", select: "name _id code" })
    .populate({ path: "baseQuantity.unit", select: "name _id code" })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.status(200).json({
    status: "success",
    results: boms.length,
    totalPages,
    data: boms,
  });
});

exports.produceProduct = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      productId,
      consumedMaterials,
      producedQuantity,
      stockId,
      unitId,
      selectedUnit,
      unitEqual,
      counter,
    } = req.body;
    const companyId = req.query.companyId;

    //BASIC VALIDATION
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    if (
      !productId ||
      !Array.isArray(consumedMaterials) ||
      !consumedMaterials.length ||
      !producedQuantity?.value ||
      !stockId
    ) {
      return res.status(400).json({ message: "Invalid production data" });
    }

    //PRODUCT + RECEIVING STOCK

    const receivingStock = await stockModel
      .findOne({
        _id: stockId,
        companyId,
      })
      .session(session);

    if (!receivingStock) {
      return res.status(400).json({
        message: "Invalid receiving stock selected",
      });
    }

    //ACTIVE BOM
    const bom = await billOfMaterialsModel
      .findOne({ productId, isActive: true })
      .session(session);

    if (!bom) {
      return res.status(400).json({ message: "No active BOM found" });
    }

    //VALIDATE RAW MATERIAL STOC
    const rawProductsMap = new Map();

    for (const item of consumedMaterials) {
      const rawProduct = await productModel
        .findById(item.rawMaterialId)
        .session(session);

      if (!rawProduct) {
        throw new Error("Raw material not found");
      }

      const totalAvailable = rawProduct.stocks.reduce(
        (sum, s) => sum + (Number(s.productQuantity) || 0),
        0,
      );

      const requiredQty = Number(item?.quantity?.value || 0);

      if (totalAvailable < requiredQty) {
        throw new Error(`Insufficient stock for ${rawProduct.name}`);
      }

      rawProductsMap.set(rawProduct._id.toString(), rawProduct);
    }
    const productionLogCounter = await counterModel.findOneAndUpdate(
      { companyId, name: "productionLog" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    //CREATE PRODUCTION LOG
    const [productionLog] = await productionLogModel.create(
      [
        {
          productId,
          bomId: bom._id,
          consumedMaterials,
          producedQuantity,
          selectedUnit,
          unitEqual,
          companyId,
          counter: counter + productionLogCounter.seq,
        },
      ],
      { session },
    );

    const logId = productionLog._id;

    let totalManufacturingCost = 0;

    for (const item of consumedMaterials) {
      const rawProduct = rawProductsMap.get(item.rawMaterialId.toString());
      if (!rawProduct) throw new Error("Raw product not found");

      let remaining = Number(item.quantity.value);
      if (remaining <= 0) continue;

      const batches = await prodcutBatchModel
        .find({
          productId: rawProduct._id,
          companyId,
          stockId,
          remaining: { $gt: 0 },
        })
        .sort({ createdAt: 1 })
        .session(session);

      if (!batches.length) {
        throw new Error(`No stock batches for ${rawProduct.name}`);
      }

      let totalDeducted = 0;
      let stockBalance =
        rawProduct.stocks.find(
          (s) => s.stockId.toString() === stockId.toString(),
        )?.productQuantity || 0;

      for (const batch of batches) {
        if (remaining <= 0) break;

        const deduct = Math.min(batch.remaining, remaining);

        batch.remaining -= deduct;
        remaining -= deduct;
        totalDeducted += deduct;
        stockBalance -= deduct;

        const unitCost = Number(
          batch.costBuyingPrice || batch.buyingprice || 0,
        );
        totalManufacturingCost += deduct * unitCost;

        await createProductMovement({
          productId: rawProduct._id,
          reference: logId,
          quantity: deduct,
          newQuantity: stockBalance,
          movementType: "out",
          source: "Manufacturing",
          companyId,
          stockId,
          batchId: batch._id,
          outPrice: unitCost,
          session,
        });

        await batch.save({ session });
      }

      if (remaining > 0) {
        throw new Error(`Insufficient stock for ${rawProduct.name}`);
      }

      await productModel.updateOne(
        {
          _id: rawProduct._id,
          "stocks.stockId": stockId,
        },
        {
          $inc: {
            "stocks.$.productQuantity": -totalDeducted,
            quantity: -totalDeducted,
          },
        },
        { session },
      );
    }

    //INCREASE MANUFACTURED STOC
    const producedQty = Number(producedQuantity.value);
    const unitManufacturingCost =
      producedQty > 0 ? totalManufacturingCost / producedQty : 0;

    const product = await productModel.findOneAndUpdate(
      {
        _id: productId,
        "stocks.stockId": stockId,
        companyId,
      },
      {
        $inc: {
          "stocks.$.productQuantity": producedQty,
        },
        $set: {
          buyingprice: unitManufacturingCost,
          costBuyingPrice: unitManufacturingCost,
          "unitsPrices.$[u].prices.$[p].price": unitManufacturingCost,
        },
      },
      {
        new: true,
        session,
        arrayFilters: [{ "u.unitId": unitId }, { "p.title": "buyingprice" }],
      },
    );

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const totalStockQuantity = product.stocks.reduce(
      (total, stock) => total + stock.productQuantity || 0,
      0,
    );

    await createProductMovement({
      productId: product._id,
      reference: logId,
      quantity: producedQty,
      newQuantity: totalStockQuantity + producedQty,
      movementType: "in",
      source: "Manufacturing",
      companyId,
      stockId: receivingStock._id,
      enterPrice: unitManufacturingCost,
      buyingPrice: unitManufacturingCost,
    });

    await createProductBatch({
      productId: product._id,
      companyId,
      stockId: receivingStock._id,
      quantity: producedQty,
      buyingprice: unitManufacturingCost,
      costBuyingPrice: unitManufacturingCost,
      sourceType: "manufacturing",
      sourceId: logId,
    });

    //COMMIT
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      status: "success",
      message: "Product manufactured successfully",
      data: productionLog,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("Manufacturing error:", err);

    return res.status(400).json({
      status: "fail",
      message: err.message || "Manufacturing failed",
    });
  }
});

exports.getProductionLogs = asyncHandler(async (req, res) => {
  const { companyId, limit = 10, page = 1 } = req.query;
  const { productId } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const skip = (page - 1) * limit;

  const query = { companyId, productId };

  const totalItems = await productionLogModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limit);

  const logs = await productionLogModel
    .find(query)
    .populate("productId", "name")
    .populate("bomId", "name baseQuantity")
    .populate("consumedMaterials.rawMaterialId", "name")
    .populate("consumedMaterials.quantity.unit", "name symbol")
    .populate("producedQuantity.unit", "name symbol")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  res.status(200).json({
    status: "success",
    results: logs.length,
    totalPages,
    data: logs,
  });
});

exports.getAllProductionLogs = asyncHandler(async (req, res) => {
  const {
    companyId,
    limit = 10,
    page = 1,
    productId,
    bomId,
    stockId,
    from,
    to,
  } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const skip = (pageNum - 1) * limitNum;

  const query = { companyId };

  // Optional filters
  if (productId) query.productId = productId;
  if (bomId) query.bomId = bomId;
  if (stockId) query.stockId = stockId; // only if you actually store stockId in model

  // Optional date range
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(to);
  }

  const totalItems = await productionLogModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / limitNum);

  const logs = await productionLogModel
    .find(query)
    .populate("productId", "name")
    .populate("bomId", "name baseQuantity")
    .populate("consumedMaterials.rawMaterialId", "name")
    .populate("consumedMaterials.quantity.unit", "name symbol code")
    .populate("producedQuantity.unit", "name symbol code")
    .populate("selectedUnit", "name symbol code")
    .populate("consumedMaterials.selectedUnit", "name symbol code")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  res.status(200).json({
    status: "success",
    results: logs.length,
    totalItems,
    totalPages,
    page: pageNum,
    limit: limitNum,
    data: logs,
  });
});
