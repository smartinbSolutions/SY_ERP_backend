const { default: slugify } = require("slugify");
const productModel = require("../../../models/Stocks/products/productModel");
const safeParse = require("../../../utils/tools/safeParse");
const { createProductMovement } = require("../../../utils/productMovement");
const counterModel = require("../../../models/Settings/counterModel");
const { default: mongoose, Types } = require("mongoose");
const ApiError = require("../../../utils/apiError");
const xlsx = require("xlsx");
const csvtojson = require("csvtojson");
const currencyModel = require("../../../models/Settings/currency.model");
const CategoryModel = require("../../../models/CategoryModel");
const unitModel = require("../../../models/Settings/Definition/unit.model");
const taxModel = require("../../../models/Settings/Definition/tax.model");
const brandModel = require("../../../models/Settings/Definition/brand.model");

exports.getAllProductsForExportsService = async ({ req, companyId }) => {
  const products = await productModel
    .find({ companyId, type: req.query.type })
    .populate({
      path: "currency",
      select: "currencyCode currencyName exchangeRate is_primary  _id",
    })
    .populate({ path: "category" })
    .populate({ path: "brand", select: "name _id" })
    .populate({ path: "unit", select: "name code  _id" })
    .populate({ path: "tax" })
    .lean();

  return products;
};

exports.getAllProductsService = async ({ req, companyId }) => {
  const pageSize = req.query.limit || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId, $and: [] };

  if (req.query.keyword) {
    const lang = req.query.lang || "en";

    const nameField =
      lang === "tr" ? "nameTR" : lang === "ar" ? "nameAR" : "name";

    query.$or = [
      { [nameField]: { $regex: req.query.keyword, $options: "i" } },
      {
        qr: {
          $elemMatch: {
            $regex: req.query.keyword,
            $options: "i",
          },
        },
      },
    ];
  }

  if (req.query.archives === "true") {
    query.$and.push({ archives: true });
  } else {
    query.$and.push({ archives: false });
  }

  if (req.query.categoryId) {
    query.$and.push({ category: new Types.ObjectId(req.query.categoryId) });
  }

  if (req.query.brandId) {
    query.$and.push({ brand: new Types.ObjectId(req.query.brandId) });
  }

  if (req.query.unitId) {
    query.$and.push({ unit: new Types.ObjectId(req.query.unitId) });
  }

  if (req.query.productType) {
    let types = req.query.productType;

    types = types.split(",");

    query.type = { $in: types };
  }

  let sortQuery = {};
  if (req.query.sold) {
    sortQuery = { sold: parseInt(req.query.sold) === 1 ? 1 : -1 };
  } else {
    sortQuery = { createdAt: -1 };
  }

  const totalItems = await productModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);

  const product = await productModel
    .find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "category" })
    .populate({ path: "brand", select: "name _id" })
    .populate({ path: "unit", select: "name code  _id" })
    .populate({ path: "tax" })
    .populate({
      path: "currency",
      select: "currencyCode currencyName exchangeRate is_primary  _id",
    })
    .populate({
      path: "tax",
      populate: { path: "purchaseAccountTax" },
    })
    .populate({
      path: "tax",
      populate: {
        path: "purchaseAccountTax",
        populate: { path: "currency" },
      },
    })
    .populate({
      path: "tax",
      populate: { path: "salesAccountTax" },
    })
    .populate({
      path: "tax",
      populate: {
        path: "salesAccountTax",
        populate: { path: "currency" },
      },
    })
    .lean();

  return {
    totalItems,
    totalPages,
    product,
  };
};

exports.getProductPosService = async ({ req, companyId }) => {
  const stockId = req.query.stockId;

  const pageSize = parseInt(req.query.limit, 10) || 25;
  const page = parseInt(req.query.page, 10) || 1;
  const skip = (page - 1) * pageSize;

  let query = {
    companyId,
    $or: [{ type: "Service" }, { "stocks.stockId": stockId }],
    // type: { $nin: ["rawmaterial", "manufactured"] },
  };
  if (req.query.keyword) {
    query.$or = [
      { name: { $regex: req.query.keyword, $options: "i" } },
      {
        qr: {
          $elemMatch: {
            $regex: req.query.keyword,
            $options: "i",
          },
        },
      },
      { "variants.qr": { $regex: req.query.keyword, $options: "i" } },

      { "variants.name": { $regex: req.query.keyword, $options: "i" } },
    ];
  }

  if (!stockId) {
    return res
      .status(400)
      .json({ status: "false", message: "Stock ID is required" });
  }

  if (req.query.label) {
    query.label = req.query.label;
  }

  let sortQuery = req.query.sold
    ? { sold: parseInt(req.query.sold, 10) === 1 ? 1 : -1 }
    : { createdAt: -1 };

  const [totalItems, products] = await Promise.all([
    productModel.countDocuments(query),
    productModel
      .find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(pageSize)
      .populate({ path: "currency" })
      .populate({ path: "tax", select: "tax name _id  salesAccountTax" })
      .populate({ path: "unit" }),
  ]);

  const productsWithQuantity = products.map((product) => {
    const productObject = product.toObject();
    const stockEntry = product.stocks.find(
      (stock) => stock?.stockId?.toString() === stockId,
    );
    productObject.activeCount = stockEntry ? stockEntry.productQuantity : 0;
    return productObject;
  });

  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    totalPages,
    productsWithQuantity,
  };
};

exports.getOneProductService = async ({ req, companyId, id }) => {
  let query = mongoose.Types.ObjectId.isValid(id)
    ? { _id: id, companyId }
    : { slug: id, companyId };

  const product = await productModel
    .findOne(query)

    .populate({ path: "category", populate: { path: "parentCategory" } })
    .populate({ path: "brand", select: "name _id" })
    .populate({ path: "unit", select: "name code _id" })
    .populate({ path: "tax", select: "tax _id" })
    .populate({ path: "currency" });
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const setImageURL = (doc) => {
    if (doc.image) {
      doc.image = `${process.env.BASE_URL}/product/${doc.image}`;
    }
    if (doc.imagesArray) {
      doc.imagesArray = doc.imagesArray.map((imageObj) => ({
        image: `${process.env.BASE_URL}/product/${imageObj.image}`,
      }));
    }
  };
  setImageURL(product);

  return product;
};

exports.createProductService = async ({ req, companyId, session }) => {
  const productData = req.body;

  productData.slug = slugify(productData.name);
  productData.qr = safeParse(req.body.qr);
  productData.serialNumbers = safeParse(req.body.serialNumbers);
  if (productData.type && req.body.type !== "Service") {
    productData.unitsPrices = safeParse(req.body.unitsPrices);
    productData.variants = safeParse(req.body.variants);
    productData.variantName = safeParse(req.body.variantName);
  }
  if (req.body.customAttributes) {
    productData.customAttributes = safeParse(req.body.customAttributes);
  }
  const counter = await counterModel.findOneAndUpdate(
    { companyId, name: "Product" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session },
  );

  productData.counter = counter.seq;
  const [product] = await productModel.create([productData], { session });

  await product.populate("currency");

  console.log(product);

  await createProductMovement({
    productId: product._id,
    reference: product._id,
    newQuantity: 0,
    quantity: 0,
    movementType: "in",
    source: "Create",
    companyId,
    enterPrice: product.buyingprice || 0,
    enterPriceMainCurrency:
      Number(product.buyingprice || 0) / product.currency.exchangeRate || 0,
    stockId: null,
    buyingPrice: product.buyingprice || 0,
    exchangeRate: product.currency.exchangeRate || 1,
    movementDate: new Date(),
    session,
  });

  return product;
};

exports.updateProductService = async ({ id, req, companyId, session }) => {
  const productData = { ...req.body };

  if (productData.name) {
    productData.slug = slugify(productData.name);
  }

  productData.qr = safeParse(req.body.qr);
  productData.serialNumbers = safeParse(req.body.serialNumbers);

  if (productData.type && productData.type !== "Service") {
    productData.unitsPrices = safeParse(req.body.unitsPrices);
    productData.variants = safeParse(req.body.variants);
    productData.variantName = safeParse(req.body.variantName);
  }

  if (req.body.customAttributes) {
    productData.customAttributes = safeParse(req.body.customAttributes);
  }

  const product = await productModel
    .findOneAndUpdate({ _id: id, companyId }, productData, {
      new: true,
      session,
    })
    .populate("currency");

  if (!product) {
    throw new ApiError(`No Product for this id ${id}`, 404);
  }

  return product;
};

exports.archiveProductService = async ({ id, companyId, session }) => {
  const product = await productModel
    .findOne({ _id: id, companyId })
    .session(session);

  if (!product) {
    throw new ApiError(`No Product for this id ${id}`, 404);
  }

  const updatedProduct = await productModel.findOneAndUpdate(
    { _id: id, companyId },
    { $set: { archives: !product.archives } },
    { new: true, session },
  );

  return updatedProduct;
};

exports.importProductService = async ({ file, body, companyId, session }) => {
  if (!file) {
    throw new ApiError("File is required", 400);
  }

  const { buffer, originalname, mimetype } = file;

  let csvData = [];

  if (originalname.endsWith(".csv") || mimetype === "text/csv") {
    csvData = await csvtojson().fromString(buffer.toString());
  } else if (
    originalname.endsWith(".xlsx") ||
    mimetype ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    csvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  } else {
    throw new ApiError("Unsupported file type", 400);
  }

  const [currencies, categories, units, brands, taxes] = await Promise.all([
    currencyModel.find({ companyId }).session(session),
    CategoryModel.find({ companyId }).session(session),
    unitModel.find({ companyId }).session(session),
    brandModel.find({ companyId }).session(session),
    taxModel.find({ companyId }).session(session),
  ]);

  const currencyMap = new Map(currencies.map((c) => [c.currencyCode, c._id]));
  const categoryMap = new Map(categories.map((c) => [c.name, c._id]));
  const unitMap = new Map(units.map((u) => [u.name, u._id]));
  const brandMap = new Map(brands.map((b) => [b.name, b._id]));
  const taxMap = new Map(taxes.map((t) => [String(t.tax), t._id]));

  const preparedProducts = [];

  for (const row of csvData) {
    const price = Number(row.price) || 0;
    const buyingprice = Number(row.buyingprice) || 0;

    const profitRatio = price > 0 ? ((price - buyingprice) / price) * 100 : 0;

    const qrArray = row.qr
      ? String(row.qr)
          .split(/[,\s]+/)
          .map((q) => q.trim())
          .filter(Boolean)
      : [];

    const customAttributes = Object.keys(row)
      .filter((k) => k.startsWith("attr_"))
      .map((k) => ({
        key: k.replace("attr_", "").trim(),
        value: String(row[k] || ""),
      }))
      .filter((a) => a.key && a.value);

    const unitsPrices = [];

    for (let i = 1; i <= 1; i++) {
      const unitName = row[`unitPrice_${i}_name`] || row.unit;
      const equal = Number(row[`unitPrice_${i}_equal`]) || 0;

      const unitId = unitMap.get(unitName);
      if (!unitName || !unitId || equal <= 0) continue;

      const prices = [
        "buyingprice",
        "price",
        "semiWholesalePrice",
        "distributionPrice",
        "wholesalePrice",
        "importPrice",
        "exportPrice",
      ]
        .map((key) => {
          let value = Number(row[`unitPrice_${i}_${key}`]);

          if (!value || value <= 0) {
            if (key === "buyingprice") value = buyingprice;
            if (key === "price") value = price;
          }

          return value > 0 ? { title: key, price: value } : null;
        })
        .filter(Boolean);

      if (prices.length) {
        unitsPrices.push({
          name: unitName,
          equal: String(equal),
          unitId,
          prices,
        });
      }
    }

    preparedProducts.push({
      name: row.name,
      description: row.description || "",
      price,
      buyingprice,
      profitRatio,
      alarm: Number(row.alarm) || 0,
      qr: qrArray,
      customAttributes,
      unitsPrices,
      currency: currencyMap.get(row.currency),
      category: categoryMap.get(row.category),
      unit: unitMap.get(row.unitPrice_1_name),
      brand: brandMap.get(row.brand),
      tax: taxMap.get(String(row.tax || 0)),
      type: body.type,
      companyId,
    });
  }

  const duplicateQRs = [];

  try {
    await productModel.insertMany(preparedProducts, {
      session,
      ordered: false,
    });
  } catch (error) {
    if (error.code === 11000) {
      error.writeErrors?.forEach((e) => {
        if (e?.err?.op?.qr) {
          duplicateQRs.push(e.err.op.qr);
        }
      });
    } else {
      throw error;
    }
  }

  return {
    inserted: preparedProducts.length,
    duplicateQRs,
  };
};

exports.bulkUpdateProductPriceService = async ({
  companyId,
  updates,
  session,
}) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ApiError("Invalid or empty data array", 400);
  }

  let totalUpdatedProducts = 0;
  let totalLogs = 0;

  for (const item of updates) {
    const product = await productModel
      .findOne({
        _id: item.productId,
        companyId,
      })
      .session(session);

    if (!product) continue;

    const originalUnits = product.unitsPrices || [];

    const newUnits = Array.isArray(item.unitsPrices)
      ? item.unitsPrices
      : item.unitsPrices?.updatedUnits || [];

    if (!Array.isArray(newUnits)) {
      continue;
    }

    let productChanged = false;

    for (const updatedUnit of newUnits) {
      const origUnit = originalUnits.find(
        (u) => u.unitId?.toString() === updatedUnit.unitId?.toString(),
      );

      if (!origUnit) continue;

      for (const updatedPrice of updatedUnit.prices || []) {
        const origPriceObj = origUnit.prices.find(
          (p) => p.title === updatedPrice.title,
        );

        if (!origPriceObj) continue;

        if (Number(origPriceObj.price) !== Number(updatedPrice.price)) {
          const oldPrice = origPriceObj.price;
          const newPrice = updatedPrice.price;

          productChanged = true;

          origPriceObj.price = newPrice;

          if (updatedPrice.title === "buyingprice") {
            product.buyingprice = newPrice;
          }

          if (updatedPrice.title === "price") {
            product.price = newPrice;
          }

          totalLogs++;
        }
      }
    }

    if (productChanged) {
      product.unitsPrices = originalUnits;

      await product.save({
        session,
      });

      totalUpdatedProducts++;
    }
  }

  return {
    updatedProducts: totalUpdatedProducts,
    logsCreated: totalLogs,
  };
};

exports.bulkUpdateProductInfoService = async ({
  companyId,
  updates,
  session,
}) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new ApiError("Invalid or empty data array", 400);
  }
  const bulkOps = updates.map((item) => {
    const updateFields = {
      ...item,
    };
    delete updateFields.productId;
    return {
      updateOne: {
        filter: {
          _id: item.productId,
          companyId,
        },
        update: {
          $set: updateFields,
        },
        upsert: false,
      },
    };
  });

  if (bulkOps.length > 0) {
    const result = await productModel.bulkWrite(bulkOps, {
      session,
    });
    return {
      updatedProducts: result.modifiedCount,
      matchedProducts: result.matchedCount,
    };
  }

  return {
    updatedProducts: 0,
    matchedProducts: 0,
  };
};

exports.generateBarCodeService = async ({
  companyId,
  qrFormat,
  ids,
  session,
}) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ApiError("Products ids are required", 400);
  }

  const products = await productModel
    .find({
      companyId,
      _id: { $in: ids },
    })
    .session(session)
    .lean();

  if (!products.length) {
    throw new ApiError("No products found for these ids", 404);
  }

  const generatedQrs = products.map((product) => {
    const counter = Number(product.counter) || 0;

    return {
      productId: product._id,
      qr: `${qrFormat}${counter}`,
    };
  });

  const existingProducts = await productModel
    .find({
      companyId,
      qr: {
        $in: generatedQrs.map((q) => q.qr),
      },
    })
    .session(session)
    .lean();

  if (existingProducts.length) {
    const duplicate = existingProducts[0];

    throw new ApiError(
      `QR ${
        generatedQrs.find((q) => q.qr === duplicate.qr)?.qr
      } already exists for product ${duplicate.name}`,
      400,
    );
  }

  const updates = generatedQrs.map((item) => {
    return {
      updateOne: {
        filter: {
          _id: item.productId,
          companyId,
        },
        update: {
          $addToSet: {
            qr: item.qr,
          },
        },
      },
    };
  });

  await productModel.bulkWrite(updates, {
    session,
  });

  return generatedQrs;
};

exports.getNullQrProductService = async ({ companyId }) => {
  const products = await productModel.find({
    companyId,
    type: { $ne: "variant" },
    $or: [{ qr: { $exists: false } }, { qr: { $size: 0 } }],
  });

  return products;
};
