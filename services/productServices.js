const asyncHandler = require("express-async-handler");
const productModel = require("../models/productModel");
const slugify = require("slugify");
const multer = require("multer");
const ApiError = require("../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const csvtojson = require("csvtojson");
const xlsx = require("xlsx");
const { default: mongoose, Types } = require("mongoose");
const brandModel = require("../models/brandModel");
const categoryModel = require("../models/CategoryModel");
const UnitsModel = require("../models/UnitsModel");
const stockModel = require("../models/stockModel");
const taxModel = require("../models/taxModel");
const currencyModel = require("../models/currencyModel");
const { createProductMovement } = require("../utils/productMovement");

const getAllChildCategories = require("../utils/CategoriesChild");

const { getParasutOneProduct } = require("./parasut/parasutServices");
const productMovementModel = require("../models/productMovementModel");
const orderModel = require("../models/orderModel");

// @desc Get list product
// @route Get /api/product
// @access Public
exports.getAllProdcuts = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const product = await productModel
    .find({ companyId })
    .populate({
      path: "currency",
      select: "currencyCode currencyName exchangeRate is_primary  _id",
    })
    .populate({ path: "category" })
    .lean()
    .populate({ path: "brand", select: "name _id" })
    .populate({ path: "unit", select: "name code  _id" })
    .populate({ path: "tax" });

  res.status(200).json({
    status: "true",
    results: product.length,
    data: product,
  });
});

exports.updateNumber = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // Step 1: Clear `productNo` for all products
  await productModel.updateMany({}, { $set: { productNo: 0 } });

  // Step 2: Fetch only products that have a valid `importDate` and sort them
  const products = await productModel
    .find({ importDate: { $ne: null }, companyId })
    .sort({ importDate: 1 });

  // Step 3: Assign a sequential number to each product
  for (let i = 0; i < products.length; i++) {
    products[i].productNo = i + 1; // Start numbering from 1
    console.log(
      `Updating product ${products[i]._id} with productNo ${products[i].productNo}`,
    );
    await products[i].save(); // Save the updated product
  }

  res.status(200).json({
    status: "true",
    results: products.length,
    data: products,
  });
});

exports.getProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = req.query.limit || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };

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

  query.$and = query.$and || [];

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

  // if (req.query.label) {
  //   query.label = req.query.label;
  // }

  let sortQuery = {};
  if (req.query.sold) {
    sortQuery = { sold: parseInt(req.query.sold) === 1 ? 1 : -1 };
  } else {
    sortQuery = { createdAt: -1 };
  }
  query.$and = query.$and || []; // Ensure $and exists

  if (req.query.archives === "true") {
    query.$and.push({ archives: "true" });
  } else {
    query.$and.push({ archives: "false" });
  }

  const totalItems = await productModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);

  const product = await productModel
    .find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "category" })
    .lean()
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
    });

  res.status(200).json({
    status: "true",
    results: totalItems,
    Pages: totalPages,
    data: product,
  });
});

exports.getProductsByType = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  let query = { companyId };
  query.$and = [];

  // ===== Keyword Search =====
  if (req.query.keyword) {
    const lang = req.query.lang || "en";
    const nameField =
      lang === "tr" ? "nameTR" : lang === "ar" ? "nameAR" : "name";

    query.$and.push({
      $or: [
        { [nameField]: { $regex: req.query.keyword, $options: "i" } },
        { qr: { $elemMatch: { $regex: req.query.keyword, $options: "i" } } },
      ],
    });
  }

  // ===== Filters =====
  if (req.query.categoryId) {
    query.$and.push({ category: new Types.ObjectId(req.query.categoryId) });
  }

  if (req.query.brandId) {
    query.$and.push({ brand: new Types.ObjectId(req.query.brandId) });
  }

  if (req.query.unitId) {
    query.$and.push({ unit: new Types.ObjectId(req.query.unitId) });
  }

  // ===== Product Types (array) =====
  if (req.query.productType) {
    let types = req.query.productType;

    // If frontend sends comma-separated string, split into array
    if (typeof types === "string") {
      types = types.split(",").map((t) => t.trim());
    }

    query.$and.push({ type: { $in: types } });
  }

  // ===== Archives =====
  if (req.query.archives === "true") {
    query.$and.push({ archives: "true" });
  } else {
    query.$and.push({ archives: "false" });
  }

  // ===== Sorting =====
  let sortQuery = {};
  if (req.query.sold) {
    sortQuery = { sold: parseInt(req.query.sold) === 1 ? 1 : -1 };
  } else {
    sortQuery = { createdAt: -1 };
  }

  // ===== Count and Pagination =====
  const totalItems = await productModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const products = await productModel
    .find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "category" })
    .populate({ path: "brand", select: "name _id" })
    .populate({ path: "unit", select: "name code _id" })
    .populate({ path: "tax" })
    .populate({
      path: "currency",
      select: "currencyCode currencyName exchangeRate is_primary _id",
    })
    .populate({
      path: "tax",
      populate: { path: "purchaseAccountTax", populate: { path: "currency" } },
    })

    .lean();

  res.status(200).json({
    status: true,
    results: totalItems,
    pages: totalPages,
    data: products,
  });
});

exports.getProductPos = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const stockId = req.query.stockId;

  const pageSize = parseInt(req.query.limit, 10) || 25;
  const page = parseInt(req.query.page, 10) || 1;
  const skip = (page - 1) * pageSize;

  let query = {
    companyId,
    $or: [{ type: "Service" }, { "stocks.stockId": stockId }],
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
  res.status(200).json({
    status: "true",
    results: productsWithQuantity.length,
    pages: totalPages,
    data: productsWithQuantity,
  });
});

const multerOptions = () => {
  const multerStorage = multer.memoryStorage();

  const multerFilter = function (req, file, cb) {
    if (file.mimetype.startsWith("image")) {
      cb(null, true);
    } else {
      cb(new ApiError("Only images Allowed", 400), false);
    }
  };

  const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

  return upload;
};

const uploadMixOfImages = (arrayOfFilelds) =>
  multerOptions().fields(arrayOfFilelds);

exports.uploadProductImage = uploadMixOfImages([
  { name: "image", maxCount: 1 },
  { name: "imageCover", maxCount: 1 },
  { name: "imagesArray", maxCount: 5 },
]);

exports.resizerImage = asyncHandler(async (req, res, next) => {
  if (req.files.image) {
    const imageCoverFilename = `product-${uuidv4()}-${Date.now()}-cover.png`;

    await sharp(req.files.image[0].buffer)
      .toFormat("png")
      .png({ quality: 70 })
      .toFile(`uploads/product/${imageCoverFilename}`);

    //save image into our db
    req.body.image = imageCoverFilename;
  }
  if (req.files.imageCover) {
    const imageECoverFilename = `product-${uuidv4()}-${Date.now()}-cover.png`;

    await sharp(req.files.imageCover[0].buffer)
      .toFormat("png")
      .png({ quality: 70 })
      .toFile(`uploads/product/${imageECoverFilename}`);

    //save image into our db
    req.body.imageCover = imageECoverFilename;
  }
  let coverImageName = null;
  //-2 Images
  if (req.files.imagesArray) {
    req.body.imagesArray = [];

    // Initialize a variable to store the cover image
    let coverImageName = null;

    // Process the images
    await Promise.all(
      req.files.imagesArray.map(async (img, index) => {
        const imageName = `product-${uuidv4()}-${Date.now()}-${index + 1}.png`;

        await sharp(img.buffer)
          .toFormat("png")
          .png({ quality: 70 })
          .toFile(`uploads/product/${imageName}`);

        // Check if this image should be the cover image
        if (index === 0) {
          coverImageName = imageName; // Set the first image as the cover
        } else {
          // Save other images into the imagesArray
          req.body.imagesArray.push({
            image: imageName,
            isCover: false,
          });
        }
      }),
    );

    // If there's a cover image, add it to the imagesArray
    if (coverImageName) {
      req.body.imagesArray.unshift({
        image: coverImageName,
        isCover: true, // Mark this image as the cover
      });
    }
  }
  next();
});

// @desc update Stock product Quantity
const updateStocks = async (productId, stocks, quantity, productName) => {
  try {
    // Update stock information for each stock provided
    for (const stockInfo of stocks) {
      const { stockId, stockName, productQuantity } = stockInfo;
      // Skip updating or adding the product if productQuantity is 0
      if (productQuantity === 0) {
        console.log(
          `Skipping product ${productId} in stock ${stockId} due to quantity 0`,
        );
        continue;
      }
    }
  } catch (error) {
    throw new Error(`Error updating stocks: ${error.message}`);
  }
};

// @desc Create  product
const createProductHandler = async (productData) => {
  try {
    // Connect to the appropriate database
    // Create a slug for the product name
    const product = await productModel.create(productData);

    return product;
  } catch (error) {
    throw new Error(`Error creating product: ${error.message}`);
  }
};

// @desc Create  product
// @route Post /api/product
// @access Private
exports.createProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  req.body.companyId = companyId;

  req.body.counter = await productModel
    .countDocuments({ companyId })
    .then((count) => count + 1);

  const productData = req.body;

  productData.slug = slugify(productData.name);
  productData.qr = JSON.parse(req.body.qr);
  productData.serialNumbers = JSON.parse(req.body.serialNumbers);
  if (req.body.type !== "Service") {
    productData.unitsPrices = JSON.parse(req.body.unitsPrices);
    productData.variants = JSON.parse(req.body.variants);
    productData.variantName = JSON.parse(req.body.variantName);
  }
  if (req.body.customAttributes) {
    productData.customAttributes = JSON.parse(req.body.customAttributes);
  }
  try {
    // Create product
    const product = await createProductHandler(productData);
    // Update stocks with product ID
    if (productData.type !== "Service") {
      await createProductMovement({
        productId: product._id,
        newQuantity: 0,
        quantity: 0,
        movementType: "in",
        source: "Create",
        companyId,
        enterPrice: req.body.buyingprice,
      });
    }

    // Respond with success message and data
    res.status(201).json({
      status: "true",
      message: "Product Inserted",
      data: product,
    });
  } catch (error) {
    // Handle errors
    console.error(`Error creating product: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get specific product by id
// @route Get /api/product/:id
// @access Private
exports.getOneProduct = asyncHandler(async (req, res, next) => {
  try {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const { id } = req.params;

    let query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id, companyId }
      : { slug: id, companyId };

    // Fetch product and movements concurrently
    const product = await productModel
      .findOne(query)

      .populate({ path: "category", populate: { path: "parentCategory" } })
      .populate({ path: "brand", select: "name _id" })
      .populate({ path: "unit", select: "name code _id" })
      .populate({ path: "tax", select: "tax _id" })
      .populate({ path: "currency" });
    // .populate({ path: "review", options: { limit: 10 } });

    // Check if product exists
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    // Fetch stock count from Parasut API
    // if (product?.parasutID.length > 5) {
    //   const parasutProduct = await getParasutOneProduct(product?.parasutID);

    //   product.quantity = parasutProduct?.data?.attributes?.stock_count || 0;
    // }
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
    res.status(200).json({ data: product });
  } catch (error) {
    next(error);
  }
});

// @desc Update specific product
// @route Put /api/product/:id
// @access Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;
  const productData = req.body;
  productData.qr = JSON.parse(req.body.qr);
  productData.serialNumbers = JSON.parse(req.body.serialNumbers);
  if (req.body.type !== "Service") {
    productData.unitsPrices = JSON.parse(req.body.unitsPrices);
    productData.variants = JSON.parse(req.body.variants);
    productData.variantName = JSON.parse(req.body.variantName);
  }
  if (req.body.customAttributes) {
    productData.customAttributes = JSON.parse(req.body.customAttributes);
  }
  // Parse metas if provided
  if (req.body.metas) {
    try {
      req.body.metas = JSON.parse(req.body.metas);
    } catch (error) {
      console.error("Invalid metas format:", error);
      return next(new ApiError("Invalid metas format", 400));
    }
  }

  // Generate slug if name is provided
  if (req.body.name) {
    req.body.slug = slugify(req.body.name);
  }

  try {
    // Fetch existing product
    const existingProduct = await productModel
      .findOne({ _id: id, companyId })
      .populate("currency");

    if (!existingProduct) {
      console.error(`No Product found with ID: ${id}`);
      return next(new ApiError(`No Product for this id ${id}`, 404));
    }

    // Find currency if provided
    let findCurrency = null;
    if (req.body.currency) {
      findCurrency = await currencyModel.findOne({
        _id: req.body.currency,
        companyId,
      });
      if (!findCurrency) {
        console.error(`Currency not found with ID: ${req.body.currency}`);
      }
    }
    const totalQuantity = existingProduct?.stocks.reduce(
      (sum, stock) => sum + stock.productQuantity,

      0,
    );

    // Update product in the database
    const product = await productModel.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      {
        new: true,
      },
    );

    if (!product) {
      console.error(`Failed to update product with ID: ${id}`);
      return next(new ApiError(`No Product for this id ${id}`, 404));
    }

    let savedMovement;

    // Record product movement if quantity changed
    // if (req.body.totalQuantity && quantityChanged) {
    //   savedMovement = await createProductMovement(
    //     id,
    //     id,
    //     Number(req.body.totalQuantity),
    //     Number(req.body.totalQuantity) - Number(totalQuantity),
    //     0,
    //     0,
    //     "movement",
    //     "edit",
    //     "update",
    //     companyId,
    //     "",
    //     "",
    //     "",
    //     product.buyingprice,
    //     product.taxPrice
    //   );
    // }

    // // Record product movement if buying price changed
    // if (req.body.buyingprice && priceChanged) {
    //   savedMovement = await createProductMovement(
    //     id,
    //     id,
    //     0,
    //     0,
    //     req.body.buyingprice,
    //     existingProduct.buyingprice,
    //     "price",
    //     "edit",
    //     "update",
    //     companyId,
    //     "",
    //     findCurrency ? findCurrency.currencyCode : "N/A",
    //     existingProduct.currency
    //       ? existingProduct.currency.currencyCode
    //       : "N/A",
    //     existingProduct.buyingprice,
    //     existingProduct.taxPrice
    //   );
    // }

    // Update stocks if provided
    if (productData.stocks) {
      await updateStocks(
        id,
        productData.stocks,
        productData.quantity,
        productData.name,
      );
    }

    res.status(200).json({
      status: "true",
      message: "Product updated",
      data: product,
      movement: savedMovement,
    });
  } catch (error) {
    console.error("Error updating product:", error);
    return next(new ApiError(`Error updating product: ${error.message}`, 500));
  }
});

// @desc Delete specific product
// @route Delete /api/product/:id
// @access Private
exports.archiveProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { id } = req.params;

  // Find the product by ID
  const product = await productModel.findOne({ _id: id, companyId });

  if (!product) {
    return next(new ApiError(`No Product for this id ${id}`, 404));
  }
  try {
    product.archives = product.archives === "true" ? "false" : "true";

    // Update only the 'archives' field
    const updatedProduct = await productModel.findOneAndUpdate(
      { _id: id },
      { $set: { archives: product.archives } },
      { new: true },
    );

    const movementType = product.archives === "true" ? "out" : "in";

    const savedMovement = await createProductMovement(
      product._id,
      product._id,
      product.quantity,
      product.quantity,
      0,
      0,
      "movement",
      movementType,
      "archive",
      companyId,
      "",
      "",
      "",
      product.buyingprice,
      product.taxPrice,
    );

    res.status(200).json({
      status: "success",
      message: "Product Archived",
      data: updatedProduct,
      movement: savedMovement,
    });
  } catch (error) {
    return new ApiError(`Error archiving product: ${error.message}`, 500);
  }
});

// @desc import products from Excel
// @route add /api/add
// @access Private
exports.importProduct = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const { buffer } = req.file;
    let csvData = [];

    if (
      req.file.originalname.endsWith(".csv") ||
      req.file.mimetype === "text/csv"
    ) {
      csvData = await csvtojson().fromString(buffer.toString());
    } else if (
      req.file.originalname.endsWith(".xlsx") ||
      req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      csvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    const [currencies, categories, units, brands, taxes, stocks] =
      await Promise.all([
        currencyModel.find({ companyId }),
        categoryModel.find({ companyId }),
        UnitsModel.find({ companyId }),
        brandModel.find({ companyId }),
        taxModel.find({ companyId }),
        stockModel.find({ companyId }),
      ]);

    const currencyMap = new Map(currencies.map((c) => [c.currencyName, c._id]));
    const categoryMap = new Map(categories.map((c) => [c.name, c._id]));
    const unitMap = new Map(units.map((u) => [u.name, u._id]));
    const brandMap = new Map(brands.map((b) => [b.name, b._id]));
    const taxMap = new Map(taxes.map((t) => [String(t.tax), t._id]));
    const stockMap = new Map(stocks.map((s) => [s.name, s]));

    const preparedProducts = [];

    for (const row of csvData) {
      const qrArray =
        row.qr !== undefined && row.qr !== null
          ? String(row.qr)
              .split(",")
              .map((q) => q.trim())
              .filter(Boolean)
          : [];

      const customAttributes = [];
      for (const key of Object.keys(row)) {
        if (key.startsWith("attr_")) {
          const k = key.replace("attr_", "").trim();
          const v = row[key];
          if (k && v !== undefined && v !== "") {
            customAttributes.push({
              key: k,
              value: String(v),
            });
          }
        }
      }

      const stocksArr = [];
      let totalQuantity = 0;

      const excludedKeys = [
        "name",
        "qr",
        "tax",
        "buyingprice",
        "currency",
        "price",
        "category",
        "unit",
        "brand",
        "alarm",
        "description",
        "supplier",
        "origin",
        "active",
      ];

      for (const key of Object.keys(row)) {
        if (!excludedKeys.includes(key) && !key.startsWith("unitPrice_")) {
          const stock = stockMap.get(key);
          const qty = Number(row[key]) || 0;

          if (stock && qty > 0) {
            stocksArr.push({
              stockId: String(stock._id),
              stockName: stock.name,
              productQuantity: qty,
            });
            totalQuantity += qty;
          }
        }
      }

      const unitsPrices = [];

      for (let i = 1; i <= 4; i++) {
        const unitName = row[`unitPrice_${i}_name`];
        const equal = Number(row[`unitPrice_${i}_equal`]) || 0;
        const unitId2 = unitMap.get(unitName);

        if (!unitName || equal <= 0 || !unitId2) continue;

        const prices = [];
        [
          "buyingprice",
          "price",
          "semiWholesalePrice",
          "distributionPrice",
          "wholesalePrice",
          "importPrice",
          "exportPrice",
        ].forEach((p) => {
          const v = Number(row[`unitPrice_${i}_${p}`]) || 0;
          if (v > 0) prices.push({ title: p, price: v });
        });

        if (prices.length) {
          unitsPrices.push({
            name: unitName,
            equal: String(equal),
            unitId: unitId2,
            prices,
          });
        }
      }

      const price = Number(row.price) || 0;
      const buyingprice = Number(row.buyingprice) || 0;
      const profitRatio = price > 0 ? ((price - buyingprice) / price) * 100 : 0;

      preparedProducts.push({
        name: row.name,
        description: row.description || "Product description",

        price,
        buyingprice,
        profitRatio,
        quantity: totalQuantity,
        alarm: Number(row.alarm) || 0,

        qr: qrArray,
        customAttributes,

        stocks: stocksArr,
        unitsPrices,

        currency: currencyMap.get(row.currency),
        category: categoryMap.get(row.category),
        unit: unitMap.get(row.unit),
        brand: brandMap.get(row.brand),
        tax: taxMap.get(String(row.tax || 0)),

        companyId,
      });
    }

    const duplicateQRs = [];

    try {
      await productModel.insertMany(preparedProducts, { ordered: false });
    } catch (error) {
      if (error.code === 11000) {
        error.writeErrors.forEach((e) => {
          duplicateQRs.push(e.err.op.qr);
        });
      } else {
        throw error;
      }
    }

    res.json({
      success: true,
      inserted: preparedProducts.length,
      duplicateQRs,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

// @desc Update products from Excel (for ecommerce)
// @route POST /api/product/importEcommerceProduct
// @access Private
exports.updateProductFromExcel = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const { buffer } = req.file;
    let csvData;

    // Check the file type based on the file extension or content type
    if (
      req.file.originalname.endsWith(".csv") ||
      req.file.mimetype === "text/csv"
    ) {
      csvData = await csvtojson().fromString(buffer.toString());
    } else if (
      req.file.originalname.endsWith(".xlsx") ||
      req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheet_name_list = workbook.SheetNames;
      csvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    for (const item of csvData) {
      const lastProduct = await productModel
        .find({ productNo: { $ne: 0 }, companyId })
        .sort({ productNo: -1 })
        .limit(1);

      let lastProductNo = lastProduct.length ? lastProduct[0].productNo : 0;

      const finalPrice = item.price + item.price * (item.tax / 100);
      item.taxPrice = finalPrice;
      const priceWithoutTax = item.price / (1 + item.tax / 100);

      item.profitRatio = ((item.price - item.buyingprice) / item.price) * 100;

      await productModel.findOneAndUpdate(
        { category: item.qr, companyId },
        {
          publish: true,
          slug: slugify(item.name),
          ecommerceActive: true,
          importDate: new Date(),
          category: item.category,
          productNo: lastProductNo + 1,
          profitRatio: item.profitRatio,
          buyingprice: item.buyingprice,
          price: priceWithoutTax,
          taxPrice: item.price,
          ecommercePrice: item.price,
          ecommercePriceMainCurrency: item.price,
        },
        {
          new: true,
        },
      );
    }
    res.json({ success: "Success" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});

exports.getProductBySuppliers = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = parseInt(req.query.limit) || 25;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  // Get the supplier ID from the URL path and convert it to an array

  const query = { companyId };

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
    ];
  }

  const totalItems = await productModel.countDocuments(query);
  const totalPages = Math.ceil(totalItems / pageSize);

  const products = await productModel
    .find(query)
    .populate("currency")
    .populate("unit")
    .populate({ path: "tax" })
    .skip(skip)
    .limit(pageSize);

  res.json({
    status: "true",
    page,
    results: totalItems,
    Pages: totalPages,
    data: products,
  });
});

// @desc Update bulk products
// @route PUT /api/product/bulk-update
// @access Private
exports.bulkUpdate = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const updates = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: "Invalid or empty data array" });
  }

  let totalUpdatedProducts = 0;
  let totalLogs = 0;

  for (const item of updates) {
    const product = await productModel.findOne({
      _id: item.productId,
      companyId,
    });

    if (!product) continue;

    const originalUnits = product.unitsPrices || [];

    // ✅ FIX: extract updatedUnits correctly
    const newUnits = Array.isArray(item.unitsPrices)
      ? item.unitsPrices
      : item.unitsPrices?.updatedUnits || [];

    if (!Array.isArray(newUnits)) {
      console.error("Invalid unitsPrices payload:", item.unitsPrices);
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

        if (origPriceObj.price !== updatedPrice.price) {
          const oldPrice = origPriceObj.price;
          const newPrice = updatedPrice.price;

          productChanged = true;
          origPriceObj.price = newPrice;

          // Sync main product fields
          if (updatedPrice.title === "buyingprice") {
            product.buyingprice = newPrice;
          }
          if (updatedPrice.title === "price") {
            product.price = newPrice;
          }

          await createProductMovement(
            product._id,
            null,
            0,
            0,
            newPrice,
            oldPrice,
            "price",
            "edit",
            "bulk-update",
            companyId,
            `Unit "${origUnit.name}" price "${updatedPrice.title}" updated`,
            product.currency,
            product.currency,
            product.buyingprice,
            product.price,
          );

          totalLogs++;
        }
      }
    }

    if (productChanged) {
      product.unitsPrices = originalUnits;
      await product.save();
      totalUpdatedProducts++;
    }
  }

  res.status(200).json({
    status: "success",
    updatedProducts: totalUpdatedProducts,
    logsCreated: totalLogs,
  });
});

exports.bulkUpdateProductInfo = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const updates = req.body;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  // تجهيز bulk operations
  const bulkOps = updates.map((item) => {
    const updateFields = { ...item };
    delete updateFields.productId;

    return {
      updateOne: {
        filter: { _id: item.productId, companyId },
        update: { $set: updateFields },
        upsert: false,
      },
    };
  });

  if (bulkOps.length > 0) {
    await productModel.bulkWrite(bulkOps);
  }

  res.status(200).json({
    status: "success",
    message: `${bulkOps.length} products updated successfully`,
  });
});

exports.getNullQrProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }

  const products = await productModel.find({
    companyId,
    type: { $ne: "variant" },
    $or: [{ qr: { $exists: false } }, { qr: { $size: 0 } }],
  });

  res.status(200).json({
    status: "success",
    data: products,
  });
});

exports.generateBarCode = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { qrFormat, ids } = req.body;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  const products = await productModel
    .find({
      companyId,
      _id: { $in: ids },
    })
    .lean();

  if (!products.length)
    return next(new ApiError("No products found for these ids", 404));

  const updates = [];
  const newQrs = [];
  try {
    for (const product of products) {
      const counter = Number(product.counter);

      const generatedQr = qrFormat + "" + counter;

      const exists = await productModel.findOne({
        companyId,
        qr: generatedQr,
        _id: { $ne: product._id },
      });

      if (exists) {
        return next(
          new ApiError(
            `QR ${generatedQr} already exists for product ${exists.name}`,
            400,
          ),
        );
      }

      newQrs.push({ id: product._id, qr: generatedQr });

      updates.push({
        updateOne: {
          filter: { _id: product._id, companyId },
          update: {
            $addToSet: { qr: generatedQr },
          },
        },
      });
    }

    await productModel.bulkWrite(updates);
  } catch (e) {
    console.log(e);
  }
  res.status(200).json({
    status: "success",
    message: "QR codes generated successfully",
    data: newQrs,
  });
});

// const resetSold = asyncHandler(async (databaseName, field) => {
//   if (!["soldByMonth", "soldByWeek"].includes(field)) {
//     throw new Error("Invalid field to reset");
//   }

//   const db = mongoose.connection.useDb(databaseName);
//   const productModel = db.model("Product", productSchema);

//   try {
//     const result = await productModel.updateMany({}, { $set: { [field]: 0 } });
//     console.log(
//       `Reset ${field} for ${result.modifiedCount} products in ${databaseName}.`
//     );
//   } catch (error) {
//     console.error(`Error resetting ${field} in ${databaseName}:`, error);
//   }
// });

// const fetchAllSubscriberDatabases = async () => {
//   try {
//     console.log("Fetching subscriber databases...");

//     // Make a request to get all subscriber databases
//     const response = await axios.get(`${process.env.BASE_URL}/api/subscribers`);

//     if (response.data.status === "success") {
//       const subscriberDatabases = response.data.data.map((user) => user.dbName);
//       return subscriberDatabases;
//     } else {
//       throw new Error("Failed to fetch subscriber databases.");
//     }
//   } catch (error) {
//     console.error("Error fetching subscriber databases:", error);
//     return [];
//   }
// };

// const createSoldReport = asyncHandler(async (type, databaseName) => {
//   const db = mongoose.connection.useDb(databaseName);
//   const productModel = db.model("Product", productSchema);
//   const reportModel = db.model("SoldReport", soldReportSchema);

//   const soldField = type === "weekly" ? "soldByWeek" : "soldByMonth";

//   try {
//     const topProducts = await productModel
//       .find({ [soldField]: { $gt: 0 } })
//       .sort({ [soldField]: -1 })
//       .limit(10)
//       .select("name " + soldField);

//     const reportData = topProducts.map((product) => ({
//       productId: product._id,
//       name: product.name,
//       sold: product[soldField],
//     }));

//     const report = new reportModel({
//       type,
//       products: reportData,
//     });
//     await report.save();

//     await resetSold(databaseName, soldField);
//   } catch (error) {
//     console.error(`Error creating ${type} report for ${databaseName}:`, error);
//   }
// });

// Weekly task (every Sunday at 00:00)
// cron.schedule("0 0 * * 0", async () => {
//   //0 0 * * 0
//   console.log("Running weekly reports task for all databases...");
//   const subscriberDatabases = await fetchAllSubscriberDatabases();
//   for (const dbName of subscriberDatabases) {
//     await createSoldReport("weekly", dbName);
//     await resetSold(dbName, "soldByWeek");
//   }
// });

// Monthly task (1st of each month at 00:00)
// cron.schedule("0 0 1 * *", async () => {
//   //0 0 1 * *
//   console.log("Running monthly reports task for all databases...");
//   const subscriberDatabases = await fetchAllSubscriberDatabases();
//   for (const dbName of subscriberDatabases) {
//     await createSoldReport("monthly", dbName);
//     await resetSold(dbName, "soldByMonth");
//   }
// });

// This function was created to shorten Nahed's work because she doesn't want to do anything.
// Take this 1$ and don't tell her that I said this :)
// exports.updateAllForNahed = asyncHandler(async (req, res) => {
//   const companyId = req.query.companyId;

//   if (!companyId) {
//     return res.status(400).json({ message: "companyId is required" });
//   }

//   const { buffer } = req.file;
//   let csvData;

//   if (
//     req.file.originalname.endsWith(".csv") ||
//     req.file.mimetype === "text/csv"
//   ) {
//     csvData = await csvtojson().fromString(buffer.toString());
//   } else if (
//     req.file.originalname.endsWith(".xlsx") ||
//     req.file.mimetype ===
//       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   ) {
//     const workbook = xlsx.read(buffer, { type: "buffer" });
//     const sheet_name_list = workbook.SheetNames;
//     csvData = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
//   } else {
//     return res.status(400).json({ error: "Unsupported file type" });
//   }

//   // Sort or process products to ensure consistent productNo assignment
//   let productCounter = 1;

//   // Keep track of updated QRs to avoid duplicates
//   const updatedQRs = new Set();

//   for (const item of csvData) {
//     if (!item.qr || updatedQRs.has(item.qr)) continue;
//     updatedQRs.add(item.qr);

//     let basePrice = parseFloat(item.price);
//     let baseBuyingPrice = parseFloat(item.buyingprice);
//     let tax = parseFloat(item.tax);

//     if (isNaN(basePrice) || basePrice <= 0) basePrice = 1;
//     if (isNaN(baseBuyingPrice) || baseBuyingPrice <= 0) baseBuyingPrice = 1;
//     if (isNaN(tax) || tax < 0) tax = 0;

//     const priceWithTax = basePrice * (1 + tax / 100);
//     const buyingPriceWithTax = baseBuyingPrice * (1 + tax / 100);

//     const profitRatio =
//       priceWithTax === 0
//         ? 0
//         : ((priceWithTax - buyingPriceWithTax) / priceWithTax) * 100;

//     await productModel.findOneAndUpdate(
//       { qr: item.qr, companyId },
//       {
//         productNo: productCounter,
//         buyingprice: buyingPriceWithTax,
//         price: basePrice,
//         taxPrice: priceWithTax,
//         ecommercePrice: priceWithTax,
//         ecommercePriceMainCurrency: priceWithTax,
//         profitRatio: profitRatio,
//       },
//       { new: true }
//     );

//     productCounter++;
//   }
//   res.json({ success: "Products updated successfully." });
// });
