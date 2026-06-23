const asyncHandler = require("express-async-handler");
const {
  getAllProductsForExportsService,
  createProductService,
  getOneProductService,
  updateProductService,
  archiveProductService,
  importProductService,
  bulkUpdateProductPriceService,
  bulkUpdateProductInfoService,
  getNullQrProductService,
  getAllProductsService,
  generateBarCodeService,
  getProductPosService,
} = require("../../../services/Stocks/Products/product.service");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { default: mongoose } = require("mongoose");

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

exports.getAllProductsForExports = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const products = await getAllProductsForExportsService({ req, companyId });

  res.status(200).json({
    status: "true",
    results: products.length,
    data: products,
  });
});

exports.getProducts = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { totalItems, totalPages, product } = await getAllProductsService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    results: totalItems,
    Pages: totalPages,
    data: product,
  });
});

exports.getProductPos = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { productsWithQuantity, totalPages } = await getProductPosService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    results: productsWithQuantity.length,
    pages: totalPages,
    data: productsWithQuantity,
  });
});

exports.getOneProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  const { id } = req.params;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const product = await getOneProductService({ req, companyId, id });
  res.status(200).json({
    status: "true",
    data: product,
  });
});
exports.createProduct = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    req.body.companyId = companyId;
    const product = await createProductService({ req, companyId, session });
    await session.commitTransaction();
    session.endSession();
    res.status(201).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    req.body.companyId = companyId;
    const product = await updateProductService({ id, req, companyId, session });
    await session.commitTransaction();
    session.endSession();
    res.status(201).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.archiveProduct = asyncHandler(async (req, res) => {
  const companyId = req.companyId;
  const { id } = req.params;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await archiveProductService({
      id,
      companyId,
      session,
    });
    await session.commitTransaction();
    session.endSession();
    res.status(201).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.importProduct = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await importProductService({
      file: req.file,
      body: req.body,
      companyId,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      inserted: result.inserted,
      duplicateQRs: result.duplicateQRs,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});

exports.bulkUpdateProductPrice = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await bulkUpdateProductPriceService({
      companyId,
      updates: req.body,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    throw error;
  }
});

exports.bulkUpdateProductInfo = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const result = await bulkUpdateProductInfoService({
      companyId,
      updates: req.body,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      ...result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    throw error;
  }
});

exports.generateBarCode = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await generateBarCodeService({
      companyId,
      qrFormat: req.body.qrFormat,
      ids: req.body.ids,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      status: "success",
      message: "QR codes generated successfully",
      data: result,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    throw error;
  }
});

exports.getNullQrProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return next(new ApiError("companyId is required", 400));
  }
  const products = await getNullQrProductService({ companyId });

  res.status(200).json({
    status: "success",
    data: products,
  });
});
