const asyncHandler = require("express-async-handler");
const multer = require("multer");
const ApiError = require("../../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const CategoryModel = require("../../models/CategoryModel");
const ecommerceProductModel = require("../../models/ecommerce/ecommerceProductModel");

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

exports.uploadEcommercProductImage = uploadMixOfImages([
  { name: "imageCover", maxCount: 1 },
  { name: "imagesArray", maxCount: 5 },
]);

exports.resizerEcommercProductImage = asyncHandler(async (req, res, next) => {
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

// @desc get Product for Ecommerces
// @route Post /api/productLazy
// @access public
exports.getLezyProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const limit = parseInt(req.query.limit) || 16;
  const skip = parseInt(req.query.skip) || 0;

  let query = {
    publish: true,
    ecommerceActive: true,
    companyId,
  };

  // Default sort query
  let sortQuery = { importDate: -1 };
  if (req.query.sold) {
    sortQuery = { sold: parseInt(req.query.sold) === 1 ? 1 : -1 };
  } else if (req.query.taxPrice) {
    sortQuery = {
      ecommercePriceMainCurrency: parseInt(req.query.taxPrice) === 1 ? 1 : -1,
    };
  } else if (req.query.ratingsAverage) {
    sortQuery = {
      ratingsAverage: parseInt(req.query.ratingsAverage) === 1 ? 1 : -1,
    };
  } else if (req.query.addToFavourites) {
    sortQuery = {
      addToFavourites: parseInt(req.query.addToFavourites) === 1 ? 1 : -1,
    };
  }

  // Keyword search
  if (req.query.keyword) {
    if (req.query.lang === "en") {
      query.name = { $regex: req.query.keyword, $options: "i" };
    } else if (req.query.lang === "tr") {
      query.nameTR = { $regex: req.query.keyword, $options: "i" };
    } else if (req.query.lang === "ar") {
      query.nameAR = { $regex: req.query.keyword, $options: "i" };
    }
  }

  // Function to get all active child category IDs recursively
  const getActiveChildCategories = async (categoryId) => {
    let categoryIds = [categoryId];
    const categories = await CategoryModel.find({
      parentCategory: categoryId,
      ecommerceVisible: true,
    }).select("_id");

    for (const category of categories) {
      const childIds = await getActiveChildCategories(category._id);
      categoryIds = categoryIds.concat(childIds);
    }

    return categoryIds;
  };

  // Type filtering for category or brand
  if (req.query.type === "category" && req.query.id) {
    try {
      const categoryId = new mongoose.Types.ObjectId(req.query.id);
      const category = await CategoryModel.findOne({
        _id: categoryId,
        ecommerceVisible: true,
      });
      if (!category) {
        return next(new Error("Category not found or not active"));
      }

      const categoryIds = await getActiveChildCategories(categoryId);
      query.category = {
        $in: categoryIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    } catch (error) {
      return next(new Error("Invalid category ID format"));
    }
  }
  if (req.query.type === "brand" && req.query.id) {
    try {
      query.brand = new mongoose.Types.ObjectId(req.query.id);
    } catch (error) {
      return next(new Error("Invalid brand ID format"));
    }
  }

  // Handle multiple brand IDs
  if (req.query.brandId) {
    let brandIds;
    if (Array.isArray(req.query.brandId)) {
      brandIds = req.query.brandId.map((id) => new mongoose.Types.ObjectId(id));
    } else if (typeof req.query.brandId === "string") {
      brandIds = req.query.brandId
        .split(",")
        .map((id) => new mongoose.Types.ObjectId(id));
    } else {
      return next(new Error("Invalid brand ID format"));
    }
    query.brand = { $in: brandIds };
  }

  // Ratings filter
  if (req.query.minAvg || req.query.maxAvg) {
    query.ratingsAverage = {};
    if (req.query.minAvg) {
      query.ratingsAverage.$gte = parseFloat(req.query.minAvg);
    }
    if (req.query.maxAvg) {
      query.ratingsAverage.$lte = parseFloat(req.query.maxAvg);
    }
  }

  // Construct the aggregation pipeline
  const aggregationPipeline = [
    {
      $addFields: {
        effectivePrice: {
          $cond: {
            if: { $gt: ["$ecommercePriceAftereDiscount", 0] },
            then: "$ecommercePriceAftereDiscount",
            else: "$ecommercePriceMainCurrency",
          },
        },
      },
    },
    {
      $lookup: {
        from: "currencies",
        localField: "currency",
        foreignField: "_id",
        as: "currencyDetails",
      },
    },
    {
      $unwind: {
        path: "$currencyDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $addFields: {
        convertedPrice: {
          $multiply: ["$effectivePrice", "$currencyDetails.exchangeRate"],
        },
      },
    },
    {
      $match: {
        ...query,
        ...(req.query.taxPriceMin || req.query.taxPriceMax
          ? {
              ecommercePriceMainCurrency: {
                ...(req.query.taxPriceMin && {
                  $gte: parseFloat(req.query.taxPriceMin),
                }),
                ...(req.query.taxPriceMax && {
                  $lte: parseFloat(req.query.taxPriceMax),
                }),
              },
            }
          : {}),
      },
    },
    { $sort: sortQuery },
    { $skip: skip },
    { $limit: limit },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $unwind: {
        path: "$category",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand",
        foreignField: "_id",
        as: "brand",
      },
    },

    {
      $lookup: {
        from: "taxes",
        localField: "tax",
        foreignField: "_id",
        as: "tax",
      },
    },
    {
      $lookup: {
        from: "currencies",
        localField: "currency",
        foreignField: "_id",
        as: "currency",
      },
    },
  ];

  try {
    const products = await ecommerceProductModel.aggregate(aggregationPipeline);

    const totalItems = await ecommerceProductModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);

    const setImageURL = (doc) => {
      if (doc.image) {
        const imageUrl = `${process.env.BASE_URL}/product/${doc.image}`;
        doc.image = imageUrl;
      }
      if (doc.imagesArray) {
        const imageList = doc.imagesArray.map((imageObj) => {
          return {
            image: `${process.env.BASE_URL}/product/${imageObj.image}`,
          };
        });
        doc.imagesArray = imageList;
      }
    };

    products.forEach(setImageURL);

    res.status(200).json({
      status: "true",
      results: products.length,
      Pages: totalPages,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

// @desc Update the product to go in Ecommers
// @route put /api/ecommersproduct
// @access private
exports.updateEcommerceProducts = async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const productIds = Array.isArray(req.body.productId)
      ? req.body.productId
      : [req.body.productId].filter(Boolean); // Filter out null/undefined

    const categoryId = Array.isArray(req.body.categoryId)
      ? req.body.categoryId
      : [req.body.categoryId].filter(Boolean);

    const brandId = Array.isArray(req.body.brandId)
      ? req.body.brandId
      : [req.body.brandId].filter(Boolean);

    // Step 1: Get the highest productNo
    const lastProduct = await productModel
      .find({ productNo: { $nin: [null, "", 0] } })
      .sort({ productNo: -1 })
      .limit(1);

    let lastProductNo = lastProduct.length
      ? parseInt(lastProduct[0].productNo, 10)
      : 0;

    let updatedProducts = [];

    if (categoryId.length || brandId.length) {
      let categoryFilter = [];
      if (categoryId.length) {
        categoryFilter = await getAllChildCategories(
          categoryId,
          db,
          categorySchema,
        );
      }

      const filterConditions = [];
      if (categoryFilter.length)
        filterConditions.push({ category: { $in: categoryFilter } });
      if (brandId.length) filterConditions.push({ brand: { $in: brandId } });

      await productModel.updateMany({ $or: filterConditions }, [
        {
          $set: {
            ecommerceActive: true,
            importDate: new Date(),
            productNo: {
              $cond: {
                if: { $in: ["$productNo", [null, ""]] },
                then: { $toString: { $add: [lastProductNo, 1] } },
                else: "$productNo",
              },
            },
          },
        },
      ]);

      updatedProducts = await productModel.find({ $or: filterConditions });
    } else {
      updatedProducts = await Promise.all(
        productIds.map(async (productId) => {
          const product = await productModel.findById(productId);

          if (!product) {
            throw new Error(`Product with productId ${productId} not found.`);
          }

          if (!product.productNo) {
            product.productNo = (lastProductNo + 1).toString();
            lastProductNo++;
          }

          product.ecommerceActive = true;
          product.importDate = new Date();
          await product.save();

          return product;
        }),
      );
    }

    res.status(200).json({ success: true, data: updatedProducts });
  } catch (error) {
    console.error("Error updating ecommerce products:", error.message);
    res.status(500).json({ error: "Server Error" });
  }
};

exports.updateEcommerceProductDeActive = asyncHandler(
  async (req, res, next) => {
    const companyId = req.query.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }
    req.body.companyId = companyId;
    try {
      const { productId } = req.body;

      // Ensure productId is a string
      if (typeof productId !== "string") {
        return res.status(400).json({ error: "Invalid productId format" });
      }

      // Check if productId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ error: "Invalid productId" });
      }

      const updatedProduct = await productModel.findOneAndUpdate(
        { _id: productId, companyId },
        {
          ecommerceActive: false,
          publish: false,
          importDate: null,
        },
        { new: true },
      );

      if (!updatedProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.status(200).json({ success: true, data: updatedProduct });
    } catch (error) {
      console.error("Error updating ecommerce products:", error.message);
      res.status(500).json({ error: "Server Error" });
    }
  },
);

// @desc Update the product to go in Ecommers
// @route put /api/ecommersproduct
// @access private
exports.setEcommerceProductPublish = async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const id = req.body.id;
    const publish = req.body.publish;
    const product = await productModel.findOne({ _id: id, companyId });

    if (product.ecommercePrice <= 0) {
      const updatedProduct = await productModel.findOneAndUpdate(
        { _id: id, companyId },
        { publish: false },
      );
      return next(new ApiError("Please check the price of the product", 506));
    }
    // Await the findByIdAndUpdate operation
    const updatedProduct = await productModel.findOneAndUpdate(
      { _id: id, companyId },
      { publish: publish, slug: slugify(product.name) },
      { new: true },
    );

    res.status(200).json({ success: true, data: updatedProduct });
  } catch (error) {
    next(error);
  }
};

// @desc Get ecommerce products where ecommerceActive is true
// @route GET /api/product/importEcommerceProduct
// @access Private
exports.getEcommerceImportProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  let query = { companyId };

  // Search by QR, Name, Product Number, or Category
  if (req.query.keyword) {
    const keywordRegex = new RegExp(req.query.keyword, "i");
    query.$or = [
      { name: { $regex: keywordRegex } },
      {
        qr: {
          $elemMatch: {
            $regex: req.query.keyword,
            $options: "i",
          },
        },
      },
      { productNumber: { $regex: keywordRegex } },
    ];
  }

  // Filter by Published/Unpublished
  if (req.query.status) {
    query.ecommerceActive = req.query.status;
  }

  const pageSize = 20;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;

  const sortQuery = { updatedAt: -1 };

  // Count total matching products
  const totalItems = await productModel.countDocuments(query);

  // Fetch products with pagination and population
  const products = await productModel
    .find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "category", select: "name _id" })
    .populate({ path: "brand", select: "name _id" })
    .lean();

  const totalPages = Math.ceil(totalItems / pageSize);

  res.status(200).json({
    status: "success",
    results: products.length,
    totalItems: totalItems,
    pages: totalPages,
    data: products,
  });
});

// @desc Get Ecommerc Active Product
// @route GET /api/product/ecommerce-active-product
// @access private
exports.ecommerceActiveProudct = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const pageSize = req.query.limit || 100;
  const page = parseInt(req.query.page) || 1;
  const skip = (page - 1) * pageSize;
  let sortQuery = { importDate: -1 };
  let query = { ecommerceActive: true, companyId };

  if (req.query.category) {
    query.category = req.query.category;
  }

  if (req.query.publish) {
    const publishStatus = req.query.publish === "true";
    query.publish = publishStatus;
  }
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

  if (req.query.quantity) {
    sortQuery = { quantity: parseInt(req.query.quantity) === 1 ? 1 : -1 };
  }
  if (req.query.productNo) {
    sortQuery = { productNo: parseInt(req.query.productNo) === 1 ? 1 : -1 };
  }
  if (req.query.ecommercePrice) {
    sortQuery = {
      ecommercePrice: parseInt(req.query.ecommercePrice) === 1 ? 1 : -1,
    };
  }

  if (req.query.name) {
    sortQuery = {
      name: req.query.name == 1 ? 1 : -1,
    };
  }
  if (req.query.importDate) {
    sortQuery = {
      importDate: req.query.importDate == 1 ? 1 : -1,
    };
  }
  const totalItems = await productModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);
  const product = await productModel
    .find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .populate({ path: "category" })
    .populate("unit")
    .populate("brand");

  res.status(200).json({
    status: "true",
    results: product.length,
    Pages: totalPages,
    data: product,
  });
});

// @desc Get Ecommerce dashboard stats
// @route GET /api/product/ecommerce-dashboard-stats
// @access private
exports.ecommerceDashboardStats = asyncHandler(async (req, res) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const zeroQuantityCount = await productModel.countDocuments({
    quantity: 0,
    companyId,
  });

  const ecommerceActiveCount = await productModel.countDocuments({
    ecommerceActive: true,
    companyId,
  });

  const ecommerceInactiveCount = await productModel.countDocuments({
    ecommerceActive: true,
    publish: false,
    companyId,
  });

  const othersCount = await productModel.countDocuments({
    ecommerceActive: false,
    publish: false,
    companyId,
  });

  const publishedCount = await productModel.countDocuments({
    publish: true,
    companyId,
  });

  const totalOrderCount = await orderModel.countDocuments({ companyId });

  res.status(200).json({
    status: "true",
    zeroQuantityCount,
    ecommerceActiveCount,
    ecommerceInactiveCount,
    publishedCount,
    totalOrderCount,
    othersCount,
  });
});

// @desc Update the product to be featured
// @route PUT /api/featureProduct
// @access private
exports.setEcommerceProductFeatured = async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const { productIds, categoryId, brandId, featured = true } = req.body;

    let updatedProducts;

    if (categoryId) {
      // Fetch all child categories for the given categoryId
      const allCategories = await getAllChildCategories(
        categoryId,
        db,
        categorySchema,
      );

      // Update products by category
      updatedProducts = await productModel.updateMany(
        { category: { $in: allCategories }, companyId },
        { $set: { featured } },
      );

      if (updatedProducts.matchedCount === 0) {
        console.log("No products found for the given category ID.");
      }
    } else if (brandId) {
      updatedProducts = await productModel.updateMany(
        { brand: { $in: brandId }, companyId },
        { $set: { featured } },
      );
    } else {
      // Update products matching the given productIds
      updatedProducts = await Promise.all(
        productIds.map(async (productId) => {
          const product = await productModel.findOneAndUpdate(
            { _id: productId, companyId },
            { featured },
            { new: true },
          );

          if (!product) {
            throw new Error(`Product with productId ${productId} not found.`);
          }

          return product;
        }),
      );
    }

    res.status(200).json({ success: true, data: updatedProducts });
  } catch (error) {
    console.error("Error featuring product:", error.message);
    res.status(500).json({ error });
  }
};

// @desc Update the product to be featured
// @route GET /api/getFeatureProduct
// @access private
exports.getEcommerceProductFeatured = async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const product = await productModel
      .find({ featured: true, companyId })
      .populate({ path: "currency" });
    const setImageURL = (doc) => {
      if (doc.imagesArray) {
        const imageList = doc.imagesArray.map((imageObj) => {
          return {
            image: `${process.env.BASE_URL}/product/${imageObj.image}`,
          };
        });
        doc.imagesArray = imageList;
      }
    };

    product.forEach(setImageURL);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// @desc Update the product to be sponsored
// @route PUT /api/sponsorProduct
// @access private
exports.setEcommerceProductSponsored = async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const { productIds, brandId, categoryId, sponsored = true } = req.body;
    let updatedProducts;

    if (categoryId) {
      // Fetch all child categories for the given categoryId
      const allCategories = await getAllChildCategories(
        categoryId,
        db,
        categorySchema,
      );

      // Update products by category
      updatedProducts = await productModel.updateMany(
        { category: { $in: allCategories }, companyId },
        { $set: { sponsored } },
      );

      if (updatedProducts.matchedCount === 0) {
        console.log("No products found for the given category ID.");
      }
    } else if (brandId) {
      updatedProducts = await productModel.updateMany(
        { brand: { $in: brandId }, companyId },
        { $set: { sponsored } },
      );
    } else {
      // Update products matching the given productIds
      updatedProducts = await Promise.all(
        productIds.map(async (productId) => {
          const product = await productModel.findOneAndUpdate(
            { _id: productId, companyId },
            { sponsored },
            { new: true },
          );

          if (!product) {
            throw new Error(`Product with productId ${productId} not found.`);
          }

          return product;
        }),
      );
    }

    res.status(200).json({ success: true, data: updatedProducts });
  } catch (error) {
    console.error("Error sponsoring product:", error.message);
    res.status(500).json({ error });
  }
};

// @desc Update the product to be sponsored
// @route GET /api/sponsorProduct
// @access private
exports.getEcommerceProductSponsored = async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const product = await productModel
      .find({ sponsored: true, companyId })
      .populate({ path: "currency" });
    const setImageURL = (doc) => {
      if (doc.imagesArray) {
        const imageList = doc.imagesArray.map((imageObj) => {
          return {
            image: `${process.env.BASE_URL}/product/${imageObj.image}`,
          };
        });
        doc.imagesArray = imageList;
      }
    };

    product.forEach(setImageURL);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};
