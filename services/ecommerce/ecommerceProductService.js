const asyncHandler = require("express-async-handler");
const multer = require("multer");
const ApiError = require("../../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const CategoryModel = require("../../models/CategoryModel");
const ecommerceProductModel = require("../../models/ecommerce/ecommerceProductModel");
const productModel = require("../../models/Stocks/products/productModel");
const mongoose = require("mongoose");
const slugify = require("slugify");
const orderModel = require("../../models/Accounting/Sales/orderModel");
const fs = require("fs");
const CompanyInfoModel = require("../../models/Settings/CompanyInfo/companyInfo.model");

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
  const dir = "uploads/product";

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  /*
   * ========================================
   * COVER IMAGE
   * ========================================
   */

  if (req.files?.imageCover?.length) {
    const file = req.files.imageCover[0];

    const filename = `product-${uuidv4()}-${Date.now()}-cover.png`;

    await sharp(file.buffer)
      .resize({
        width: 1200,
        withoutEnlargement: true,
      })
      .png({ quality: 70 })
      .toFile(`${dir}/${filename}`);

    /*
     * Save processed filename into req.body
     */

    req.body.imageCover = filename;
  }

  /*
   * ========================================
   * GALLERY IMAGES
   * ========================================
   */

  if (req.files?.imagesArray?.length) {
    req.body.imagesArray = [];

    await Promise.all(
      req.files.imagesArray.map(async (file, index) => {
        const filename = `product-${uuidv4()}-${Date.now()}-${index + 1}.png`;

        await sharp(file.buffer)
          .resize({
            width: 1200,
            withoutEnlargement: true,
          })
          .png({ quality: 70 })
          .toFile(`${dir}/${filename}`);
        req.body.imagesArray.push({
          image: filename,
        });
      }),
    );
  }

  next();
});

// @desc get Product for Ecommerces
// @route Post /api/productLazy
// @access public
// @desc Get products for Ecommerce storefront
// @route GET /api/productLazy
// @access Public
exports.getLezyProduct = asyncHandler(async (req, res, next) => {
  console.log("🔍 Debug getLezyProduct:");
  console.log("req.companyId:", req.companyId);
  console.log("req.query.companySlug:", req.query.companySlug);
  console.log("req.companySlug:", req.companySlug);
  console.log("");
  if (!req.companyId && req.query.companySlug) {
    const company = await CompanyInfoModel.findOne({
      slug: req.query.companySlug.toLowerCase(),
    });

    if (company) {
      req.companyId = company._id;
    }
  }

  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId or companySlug is required",
    });
  }

  const limit = Math.max(parseInt(req.query.limit) || 16, 1);
  const skip = Math.max(parseInt(req.query.skip) || 0, 0);

  /*
   * ========================================
   * ECOMMERCE PRODUCT FILTERS
   * ========================================
   *
   * These fields exist directly inside
   * ecommerceProductModel.
   */
  const ecommerceQuery = {
    publish: true,
    ecommerceActive: true,
    companyId: companyId.toString(),
  };

  /*
   * Search by Ecommerce product name
   */
  if (req.query.keyword) {
    ecommerceQuery.name = {
      $regex: req.query.keyword,
      $options: "i",
    };
  }

  /*
   * Ratings filter
   */
  if (req.query.minAvg || req.query.maxAvg) {
    ecommerceQuery.ratingsAverage = {};

    if (req.query.minAvg) {
      ecommerceQuery.ratingsAverage.$gte = parseFloat(req.query.minAvg);
    }

    if (req.query.maxAvg) {
      ecommerceQuery.ratingsAverage.$lte = parseFloat(req.query.maxAvg);
    }
  }

  /*
   * Price filter
   */
  if (req.query.taxPriceMin || req.query.taxPriceMax) {
    ecommerceQuery.ecommercePriceMainCurrency = {};

    if (req.query.taxPriceMin) {
      ecommerceQuery.ecommercePriceMainCurrency.$gte = parseFloat(
        req.query.taxPriceMin,
      );
    }

    if (req.query.taxPriceMax) {
      ecommerceQuery.ecommercePriceMainCurrency.$lte = parseFloat(
        req.query.taxPriceMax,
      );
    }
  }

  /*
   * ========================================
   * SORTING
   * ========================================
   */

  let sortQuery = {
    importDate: -1,
  };

  if (req.query.taxPrice) {
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

  /*
   * ========================================
   * ORIGINAL PRODUCT FILTERS
   * ========================================
   *
   * category and brand do NOT exist directly
   * inside ecommerceProduct.
   *
   * They exist inside:
   *
   * ecommerceProduct.product.category
   * ecommerceProduct.product.brand
   */

  const productQuery = {};

  /*
   * Get selected category + all active
   * child categories recursively.
   */
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

  /*
   * ========================================
   * CATEGORY FILTER
   * ========================================
   */

  if (req.query.type === "category" && req.query.id) {
    if (!mongoose.Types.ObjectId.isValid(req.query.id)) {
      return next(new ApiError("Invalid category ID format", 400));
    }

    const categoryId = new mongoose.Types.ObjectId(req.query.id);

    const category = await CategoryModel.findOne({
      _id: categoryId,
      ecommerceVisible: true,
    });

    if (!category) {
      return next(new ApiError("Category not found or not active", 404));
    }

    const categoryIds = await getActiveChildCategories(categoryId);

    productQuery["product.category"] = {
      $in: categoryIds,
    };
  }

  /*
   * ========================================
   * SINGLE BRAND FILTER
   * ========================================
   */

  if (req.query.type === "brand" && req.query.id) {
    if (!mongoose.Types.ObjectId.isValid(req.query.id)) {
      return next(new ApiError("Invalid brand ID format", 400));
    }

    productQuery["product.brand"] = new mongoose.Types.ObjectId(req.query.id);
  }

  /*
   * ========================================
   * MULTIPLE BRAND FILTER
   * ========================================
   */

  if (req.query.brandId) {
    let rawBrandIds = [];

    if (Array.isArray(req.query.brandId)) {
      rawBrandIds = req.query.brandId;
    } else if (typeof req.query.brandId === "string") {
      rawBrandIds = req.query.brandId.split(",").filter(Boolean);
    }

    if (!rawBrandIds.length) {
      return next(new ApiError("Invalid brand ID format", 400));
    }

    const invalidBrandId = rawBrandIds.find(
      (id) => !mongoose.Types.ObjectId.isValid(id),
    );

    if (invalidBrandId) {
      return next(new ApiError(`Invalid brand ID: ${invalidBrandId}`, 400));
    }

    productQuery["product.brand"] = {
      $in: rawBrandIds.map((id) => new mongoose.Types.ObjectId(id)),
    };
  }

  /*
   * ========================================
   * AGGREGATION
   * ========================================
   */

  const aggregationPipeline = [
    /*
     * First filter Ecommerce Products.
     *
     * We do this before lookups for better performance.
     */
    {
      $match: ecommerceQuery,
    },

    /*
     * Get original ERP/POS product.
     *
     * ecommerceProduct.product
     *        ↓
     * product._id
     */
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "product",
      },
    },

    /*
     * Convert product array returned by lookup
     * into a single object.
     */
    {
      $unwind: {
        path: "$product",
        preserveNullAndEmptyArrays: false,
      },
    },

    /*
     * Apply category / brand filters AFTER
     * original product has been joined.
     */
    ...(Object.keys(productQuery).length
      ? [
          {
            $match: productQuery,
          },
        ]
      : []),

    {
      $addFields: {
        effectivePrice: {
          $cond: {
            if: {
              $gt: ["$ecommercePriceAftereDiscount", 0],
            },

            then: "$ecommercePriceAftereDiscount",

            else: "$ecommercePriceMainCurrency",
          },
        },
      },
    },

    {
      $lookup: {
        from: "currencies",
        localField: "product.currency",
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
          $cond: {
            if: {
              $ne: ["$currencyDetails.exchangeRate", null],
            },

            then: {
              $multiply: ["$effectivePrice", "$currencyDetails.exchangeRate"],
            },

            else: "$effectivePrice",
          },
        },
      },
    },

    {
      $facet: {
        metadata: [
          {
            $count: "totalItems",
          },
        ],

        data: [
          {
            $sort: sortQuery,
          },

          {
            $skip: skip,
          },

          {
            $limit: limit,
          },

          {
            $lookup: {
              from: "categories",
              localField: "product.category",
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
              localField: "product.brand",
              foreignField: "_id",
              as: "brand",
            },
          },

          {
            $lookup: {
              from: "taxes",
              localField: "product.tax",
              foreignField: "_id",
              as: "tax",
            },
          },

          {
            $lookup: {
              from: "currencies",
              localField: "product.currency",
              foreignField: "_id",
              as: "currency",
            },
          },
        ],
      },
    },
  ];

  const aggregationResult =
    await ecommerceProductModel.aggregate(aggregationPipeline);

  const result = aggregationResult[0] || {
    metadata: [],
    data: [],
  };

  const products = result.data || [];

  const totalItems = result.metadata?.[0]?.totalItems || 0;

  const totalPages = Math.ceil(totalItems / limit);

  products.forEach((product) => {
    // معالجة صورة الغلاف
    if (product.imageCover) {
      product.imageCover = `${process.env.BASE_URL}/product/${product.imageCover}`;
    }

    // معالجة باقي الصور
    if (product.imagesArray?.length) {
      product.imagesArray = product.imagesArray.map((imageObj) => ({
        image: imageObj.image
          ? `${process.env.BASE_URL}/product/${imageObj.image}`
          : null,
      }));
    }
  });

  return res.status(200).json({
    status: "true",

    results: products.length,

    totalItems,

    Pages: totalPages,

    data: products,
  });
});

// @desc Update the product to go in Ecommers
// @route put /api/ecommersproduct
// @access private
exports.updateEcommerceProducts = async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  try {
    const productIds = Array.isArray(req.body.productId)
      ? req.body.productId
      : [req.body.productId].filter(Boolean);

    const categoryIds = Array.isArray(req.body.categoryId)
      ? req.body.categoryId
      : [req.body.categoryId].filter(Boolean);

    const brandIds = Array.isArray(req.body.brandId)
      ? req.body.brandId
      : [req.body.brandId].filter(Boolean);

    /*
     * ========================================
     * BUILD ORIGINAL PRODUCT QUERY
     * ========================================
     */

    const productQuery = {
      companyId,
    };

    /*
     * Import by category / brand
     */
    if (categoryIds.length || brandIds.length) {
      const filterConditions = [];

      /*
       * CATEGORY
       *
       * Get selected categories + their children.
       */
      if (categoryIds.length) {
        const getChildCategories = async (categoryId) => {
          let ids = [categoryId];

          const children = await CategoryModel.find({
            parentCategory: categoryId,
          }).select("_id");

          for (const child of children) {
            const childIds = await getChildCategories(child._id);
            ids = ids.concat(childIds);
          }

          return ids;
        };

        let allCategoryIds = [];

        for (const categoryId of categoryIds) {
          if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({
              message: `Invalid categoryId: ${categoryId}`,
            });
          }

          const ids = await getChildCategories(categoryId);

          allCategoryIds = allCategoryIds.concat(ids);
        }

        filterConditions.push({
          category: {
            $in: allCategoryIds,
          },
        });
      }

      /*
       * BRAND
       */
      if (brandIds.length) {
        const validBrandIds = [];

        for (const brandId of brandIds) {
          if (!mongoose.Types.ObjectId.isValid(brandId)) {
            return res.status(400).json({
              message: `Invalid brandId: ${brandId}`,
            });
          }

          validBrandIds.push(brandId);
        }

        filterConditions.push({
          brand: {
            $in: validBrandIds,
          },
        });
      }

      productQuery.$or = filterConditions;
    } else if (productIds.length) {
      /*
       * Import selected products
       */
      for (const productId of productIds) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          return res.status(400).json({
            message: `Invalid productId: ${productId}`,
          });
        }
      }

      productQuery._id = {
        $in: productIds,
      };
    } else {
      /*
       * Nothing selected
       */
      return res.status(400).json({
        message: "productId, categoryId or brandId is required",
      });
    }

    /*
     * ========================================
     * GET ORIGINAL PRODUCTS
     * ========================================
     */

    const originalProducts = await productModel.find(productQuery);

    if (!originalProducts.length) {
      return res.status(404).json({
        message: "No products found",
      });
    }

    /*
     * ========================================
     * IMPORT TO ECOMMERCE
     * ========================================
     */

    const ecommerceProducts = [];

    /*
     * Using for...of intentionally instead of Promise.all
     * because productNo is generated in the pre-save hook.
     */
    for (const originalProduct of originalProducts) {
      /*
       * Check whether this product was already imported.
       */
      let ecommerceProduct = await ecommerceProductModel.findOne({
        product: originalProduct._id,
        companyId,
      });

      /*
       * ========================================
       * PRODUCT ALREADY EXISTS
       * ========================================
       */

      if (ecommerceProduct) {
        /*
         * Reactivate it without overwriting ecommerce data.
         *
         * We don't overwrite:
         * name
         * ecommercePrice
         * images
         * description
         * etc.
         *
         * Because admin may have customized them.
         */
        ecommerceProduct.ecommerceActive = true;
        ecommerceProduct.importDate = new Date();

        await ecommerceProduct.save();

        ecommerceProducts.push(ecommerceProduct);

        continue;
      }

      /*
       * ========================================
       * CREATE NEW ECOMMERCE PRODUCT
       * ========================================
       */

      ecommerceProduct = await ecommerceProductModel.create({
        product: originalProduct._id,
        name: originalProduct.name,
        latinName: originalProduct.latinName || "",
        description: originalProduct.description || "Product description",
        latinDescription: originalProduct.latinDescription || "",
        shortDescription:
          originalProduct.shortDescription || "Product short description",
        latinShortDescription: originalProduct.latinShortDescription || "",
        ecommercePrice: originalProduct.price || 0,
        ecommercePriceMainCurrency: originalProduct.price || 0,
        ecommerceActive: true,
        publish: false,
        importDate: new Date(),
        companyId,
      });

      ecommerceProducts.push(ecommerceProduct);
    }

    /*
     * ========================================
     * RESPONSE
     * ========================================
     */

    return res.status(200).json({
      success: true,
      results: ecommerceProducts.length,
      data: ecommerceProducts,
    });
  } catch (error) {
    console.error("Error importing ecommerce products:", error);

    next(error);
  }
};

exports.updateEcommerceProductDeActive = asyncHandler(
  async (req, res, next) => {
    const companyId = req.companyId;

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

      const updatedProduct = await ecommerceProductModel.findOneAndUpdate(
        {
          product: productId,
          companyId,
        },
        {
          ecommerceActive: false,
          publish: false,
          importDate: null,
        },
        {
          new: true,
        },
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
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  try {
    const id = req.body.id;
    const publish = req.body.publish;
    const product = await ecommerceProductModel.findOne({ _id: id, companyId });

    if (product.ecommercePrice <= 0) {
      const updatedProduct = await ecommerceProductModel.findOneAndUpdate(
        { _id: id, companyId },
        { publish: false },
      );
      return next(new ApiError("Please check the price of the product", 506));
    }
    // Await the findByIdAndUpdate operation
    const updatedProduct = await ecommerceProductModel.findOneAndUpdate(
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
// @desc Get regular products for Ecommerce import
// @route GET /api/product/importEcommerceProduct
// @access Private
exports.getEcommerceImportProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  /*
   * ========================================
   * PAGINATION
   * ========================================
   */

  const pageSize = Math.max(parseInt(req.query.limit, 10) || 20, 1);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const skip = (page - 1) * pageSize;

  /*
   * ========================================
   * ORIGINAL PRODUCT QUERY
   * ========================================
   */

  const query = {
    companyId,
  };

  /*
   * ========================================
   * KEYWORD SEARCH
   * ========================================
   *
   * Search inside original product fields:
   *
   * name
   * sku
   * counter
   * qr
   */

  if (req.query.keyword) {
    const escapedKeyword = req.query.keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const keywordRegex = new RegExp(escapedKeyword, "i");

    query.$or = [
      {
        name: {
          $regex: keywordRegex,
        },
      },

      {
        sku: {
          $regex: keywordRegex,
        },
      },

      {
        counter: {
          $regex: keywordRegex,
        },
      },

      {
        qr: {
          $elemMatch: {
            $regex: escapedKeyword,
            $options: "i",
          },
        },
      },
    ];
  }

  /*
   * ========================================
   * CATEGORY FILTER
   * ========================================
   */

  if (req.query.category) {
    if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
      return next(new ApiError("Invalid category ID format", 400));
    }

    query.category = req.query.category;
  }

  /*
   * ========================================
   * ECOMMERCE STATUS FILTER
   * ========================================
   *
   * status=true
   * → products currently active in Ecommerce
   *
   * status=false
   * → products NOT currently active
   *    including:
   *
   *    - never imported
   *    - previously imported then deactivated
   */

  if (req.query.status !== undefined) {
    if (req.query.status !== "true" && req.query.status !== "false") {
      return next(new ApiError("status must be true or false", 400));
    }

    /*
     * Get original product IDs that currently
     * have an ACTIVE ecommerce product.
     */
    const activeEcommerceProductIds = await ecommerceProductModel.distinct(
      "product",
      {
        companyId,
        ecommerceActive: true,
      },
    );

    /*
     * Active Ecommerce products
     */
    if (req.query.status === "true") {
      query._id = {
        $in: activeEcommerceProductIds,
      };
    }

    /*
     * Products available to import/reactivate
     */
    if (req.query.status === "false") {
      query._id = {
        $nin: activeEcommerceProductIds,
      };
    }
  }

  /*
   * ========================================
   * COUNT
   * ========================================
   */

  const totalItems = await productModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);

  /*
   * ========================================
   * GET ORIGINAL PRODUCTS
   * ========================================
   */

  const products = await productModel
    .find(query)
    .sort({
      updatedAt: -1,
    })
    .skip(skip)
    .limit(pageSize)
    .populate({
      path: "category",
      select: "name _id",
    })
    .populate({
      path: "brand",
      select: "name _id",
    })
    .lean();

  /*
   * ========================================
   * GET ECOMMERCE STATUS FOR THESE PRODUCTS
   * ========================================
   *
   * This allows the frontend to know whether
   * every regular product:
   *
   * - was imported
   * - is active
   * - is published
   */

  const productIds = products.map((product) => product._id);

  const ecommerceProducts = await ecommerceProductModel
    .find({
      companyId,
      product: {
        $in: productIds,
      },
    })
    .select("_id product ecommerceActive publish")
    .lean();

  /*
   * Create quick lookup:
   *
   * originalProductId → ecommerce information
   */

  const ecommerceMap = new Map();

  ecommerceProducts.forEach((ecommerceProduct) => {
    ecommerceMap.set(ecommerceProduct.product.toString(), ecommerceProduct);
  });

  /*
   * ========================================
   * MERGE STATUS INTO REGULAR PRODUCTS
   * ========================================
   */

  const data = products.map((product) => {
    const ecommerceProduct = ecommerceMap.get(product._id.toString());

    return {
      ...product,

      /*
       * Was this product ever imported?
       */
      imported: !!ecommerceProduct,

      /*
       * Is it currently active?
       */
      ecommerceActive: ecommerceProduct?.ecommerceActive ?? false,

      /*
       * Is it published on storefront?
       */
      publish: ecommerceProduct?.publish ?? false,

      /*
       * Useful when frontend needs to open
       * Ecommerce Product directly.
       */
      ecommerceProductId: ecommerceProduct?._id ?? null,
    };
  });

  return res.status(200).json({
    status: "success",

    results: data.length,

    totalItems,

    pages: totalPages,

    data,
  });
});

// @desc Get Ecommerc Active Product
// @route GET /api/product/ecommerce-active-product
// @access private
// @desc Get Ecommerce Active Products
// @route GET /api/product/ecommerce-active-product
// @access Private

exports.ecommerceActiveProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const pageSize = Math.max(parseInt(req.query.limit, 10) || 100, 1);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

  const skip = (page - 1) * pageSize;

  const query = {
    ecommerceActive: true,
    companyId,
  };

  if (req.query.publish !== undefined) {
    if (req.query.publish !== "true" && req.query.publish !== "false") {
      return next(new ApiError("publish must be true or false", 400));
    }

    query.publish = req.query.publish === "true";
  }

  if (req.query.category) {
    if (!mongoose.Types.ObjectId.isValid(req.query.category)) {
      return next(new ApiError("Invalid category ID format", 400));
    }

    const categoryProductIds = await productModel
      .find({
        companyId,
        category: req.query.category,
      })
      .distinct("_id");

    query.product = {
      $in: categoryProductIds,
    };
  }

  if (req.query.keyword) {
    const escapedKeyword = req.query.keyword.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    const keywordRegex = new RegExp(escapedKeyword, "i");

    const matchedProductIds = await productModel
      .find({
        companyId,

        $or: [
          {
            name: {
              $regex: keywordRegex,
            },
          },

          {
            sku: {
              $regex: keywordRegex,
            },
          },

          {
            counter: {
              $regex: keywordRegex,
            },
          },

          {
            qr: {
              $elemMatch: {
                $regex: escapedKeyword,
                $options: "i",
              },
            },
          },
        ],
      })
      .distinct("_id");

    query.$or = [
      {
        name: {
          $regex: keywordRegex,
        },
      },

      {
        product: {
          $in: matchedProductIds,
        },
      },
    ];
  }

  let sortQuery = {
    importDate: -1,
  };

  if (req.query.productNo) {
    sortQuery = {
      productNo: parseInt(req.query.productNo, 10) === 1 ? 1 : -1,
    };
  }

  if (req.query.ecommercePrice) {
    sortQuery = {
      ecommercePrice: parseInt(req.query.ecommercePrice, 10) === 1 ? 1 : -1,
    };
  }

  if (req.query.name) {
    sortQuery = {
      name: parseInt(req.query.name, 10) === 1 ? 1 : -1,
    };
  }

  if (req.query.importDate) {
    sortQuery = {
      importDate: parseInt(req.query.importDate, 10) === 1 ? 1 : -1,
    };
  }

  const totalItems = await ecommerceProductModel.countDocuments(query);

  const totalPages = Math.ceil(totalItems / pageSize);

  const products = await ecommerceProductModel
    .find(query)
    .sort(sortQuery)
    .skip(skip)
    .limit(pageSize)
    .populate({
      path: "product",

      populate: [
        {
          path: "category",
        },

        {
          path: "brand",
        },
        {
          path: "unit",
        },
        {
          path: "currency",
        },

        {
          path: "tax",
        },
      ],
    });

  return res.status(200).json({
    status: "true",

    results: products.length,

    totalItems,

    Pages: totalPages,

    data: products,
  });
});

// @desc Get Ecommerce dashboard stats
// @route GET /api/product/ecommerce-dashboard-stats
// @access private
exports.ecommerceDashboardStats = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  // Products that have no positive stock quantity
  const zeroQuantityCount = await productModel.countDocuments({
    companyId,
    stocks: {
      $not: {
        $elemMatch: {
          productQuantity: { $gt: 0 },
        },
      },
    },
  });

  // All products active in Ecommerce
  const ecommerceActiveCount = await ecommerceProductModel.countDocuments({
    ecommerceActive: true,
    companyId,
  });

  // Active in Ecommerce but not published
  const ecommerceInactiveCount = await ecommerceProductModel.countDocuments({
    ecommerceActive: true,
    publish: false,
    companyId,
  });

  // Products removed/deactivated from Ecommerce
  const othersCount = await ecommerceProductModel.countDocuments({
    ecommerceActive: false,
    publish: false,
    companyId,
  });

  // Published products
  const publishedCount = await ecommerceProductModel.countDocuments({
    ecommerceActive: true,
    publish: true,
    companyId,
  });

  // Ecommerce orders
  const totalOrderCount = await orderModel.countDocuments({
    companyId,
  });

  return res.status(200).json({
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
  const companyId = req.companyId;

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
  const companyId = req.companyId;

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
  const companyId = req.companyId;

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
  const companyId = req.companyId;

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

exports.getOneEcommerceProduct = asyncHandler(async (req, res, next) => {
  if (!req.companyId && req.query.companySlug) {
    const company = await CompanyInfoModel.findOne({
      slug: req.query.companySlug.toLowerCase(),
    });

    if (company) {
      req.companyId = company._id;
    }
  }

  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId or companySlug is required",
    });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ecommerce product ID", 400));
  }

  const ecommerceProduct = await ecommerceProductModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "product",
      populate: [
        {
          path: "category",
        },
        {
          path: "brand",
        },
        {
          path: "unit",
        },
        {
          path: "currency",
        },
        {
          path: "tax",
        },
      ],
    });

  if (!ecommerceProduct) {
    return next(new ApiError("Ecommerce product not found", 404));
  }

  return res.status(200).json({
    success: true,
    data: ecommerceProduct,
  });
});

exports.updateEcommerceProduct = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({
      message: "companyId is required",
    });
  }

  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ApiError("Invalid ecommerce product ID", 400));
  }

  const ecommerceProduct = await ecommerceProductModel.findOne({
    _id: id,
    companyId,
  });

  if (!ecommerceProduct) {
    return next(new ApiError("Ecommerce product not found", 404));
  }

  /*
   * ========================================
   * BASIC ECOMMERCE INFORMATION
   * ========================================
   */

  if (req.body.name !== undefined) {
    ecommerceProduct.name = req.body.name;
  }

  if (req.body.latinName !== undefined) {
    ecommerceProduct.latinName = req.body.latinName;
  }

  if (req.body.description !== undefined) {
    ecommerceProduct.description = req.body.description;
  }

  if (req.body.shortDescription !== undefined) {
    ecommerceProduct.shortDescription = req.body.shortDescription;
  }

  if (req.body.latinDescription !== undefined) {
    ecommerceProduct.latinDescription = req.body.latinDescription;
  }

  if (req.body.latinShortDescription !== undefined) {
    ecommerceProduct.latinShortDescription = req.body.latinShortDescription;
  }

  /*
   * ========================================
   * ECOMMERCE PRICE
   * ========================================
   */

  if (req.body.ecommercePrice !== undefined) {
    ecommerceProduct.ecommercePrice = Number(req.body.ecommercePrice) || 0;
  }

  if (req.body.ecommercePriceMainCurrency !== undefined) {
    ecommerceProduct.ecommercePriceMainCurrency =
      Number(req.body.ecommercePriceMainCurrency) || 0;
  }

  if (req.body.ecommercePriceAftereDiscount !== undefined) {
    ecommerceProduct.ecommercePriceAftereDiscount =
      Number(req.body.ecommercePriceAftereDiscount) || 0;
  }

  if (req.body.ecommercePriceBeforeTax !== undefined) {
    ecommerceProduct.ecommercePriceBeforeTax =
      Number(req.body.ecommercePriceBeforeTax) || 0;
  }

  /*
   * ========================================
   * SHIPPING
   * ========================================
   */

  if (req.body.width !== undefined) {
    ecommerceProduct.width = Number(req.body.width) || 0;
  }

  if (req.body.height !== undefined) {
    ecommerceProduct.height = Number(req.body.height) || 0;
  }

  if (req.body.length !== undefined) {
    ecommerceProduct.length = Number(req.body.length) || 0;
  }

  if (req.body.weight !== undefined) {
    ecommerceProduct.weight = Number(req.body.weight) || 0;
  }

  /*
   * ========================================
   * ECOMMERCE STATUS
   * ========================================
   */

  if (req.body.ecommerceActive !== undefined) {
    ecommerceProduct.ecommerceActive =
      req.body.ecommerceActive === true || req.body.ecommerceActive === "true";
  }

  /*
   * ========================================
   * SPECIFICATIONS
   * ========================================
   */

  if (req.body.specifications !== undefined) {
    try {
      let specifications = req.body.specifications;

      if (typeof specifications === "string") {
        specifications = JSON.parse(specifications);
      }

      if (!Array.isArray(specifications)) {
        return next(new ApiError("specifications must be an array", 400));
      }

      ecommerceProduct.specifications = specifications
        .filter((spec) => spec && spec.key && spec.value)
        .map((spec) => ({
          key: String(spec.key).trim(),
          value: String(spec.value).trim(),
        }));
    } catch (error) {
      return next(new ApiError("Invalid specifications format", 400));
    }
  }

  /*
   * ========================================
   * RELATED PRODUCTS
   * ========================================
   */

  if (req.body.alternateProducts !== undefined) {
    let alternateProducts = req.body.alternateProducts;

    if (!Array.isArray(alternateProducts)) {
      alternateProducts = [alternateProducts];
    }

    ecommerceProduct.alternateProducts = alternateProducts
      .filter((productId) => mongoose.Types.ObjectId.isValid(productId))
      .map((productId) => new mongoose.Types.ObjectId(productId));
  }

  /*
   * ========================================
   * META TAGS
   * ========================================
   */

  if (req.body.metas !== undefined) {
    try {
      ecommerceProduct.metas =
        typeof req.body.metas === "string"
          ? JSON.parse(req.body.metas)
          : req.body.metas;
    } catch (error) {
      return next(new ApiError("Invalid metas format", 400));
    }
  }

  /*
   * ========================================
   * KEYWORDS
   * ========================================
   */

  if (req.body.keywords !== undefined) {
    let keywords = req.body.keywords;

    if (typeof keywords === "string") {
      try {
        keywords = JSON.parse(keywords);
      } catch {
        keywords = keywords.split(",").map((k) => k.trim());
      }
    }

    if (!Array.isArray(keywords)) {
      return next(new ApiError("keywords must be an array", 400));
    }

    ecommerceProduct.keywords = keywords.filter(Boolean);
  }

  /*
   * ========================================
   * IMAGES
   * ========================================
   */

  const hasImageUpdate =
    req.body.existingImages !== undefined ||
    req.body.imagesArray !== undefined ||
    req.body.imageCover !== undefined;

  if (hasImageUpdate) {
    // 1. معالجة الصور الموجودة
    let existingImages = [];

    if (req.body.existingImages !== undefined) {
      try {
        existingImages =
          typeof req.body.existingImages === "string"
            ? JSON.parse(req.body.existingImages)
            : req.body.existingImages;
      } catch (error) {
        return next(new ApiError("Invalid existingImages format", 400));
      }

      if (!Array.isArray(existingImages)) {
        existingImages = [];
      }
    }

    // 2. معالجة الصور الجديدة
    let newImages = [];

    if (req.body.imagesArray !== undefined) {
      newImages = Array.isArray(req.body.imagesArray)
        ? req.body.imagesArray
        : [req.body.imagesArray];

      newImages = newImages
        .filter((item) => item?.image)
        .map((item) => ({
          image: item.image,
        }));
    }

    // 3. تحديث imagesArray
    ecommerceProduct.imagesArray = [
      ...existingImages
        .filter((item) => item?.image)
        .map((item) => ({
          image: item.image,
        })),
      ...newImages,
    ];

    // 4. تحديث صورة الغلاف
    if (req.body.imageCover !== undefined) {
      ecommerceProduct.imageCover = req.body.imageCover || null;
    }
  }

  /*
   * ========================================
   * SAVE PRODUCT
   * ========================================
   */

  await ecommerceProduct.save();

  /*
   * ========================================
   * GET UPDATED PRODUCT
   * ========================================
   */

  const updatedProduct = await ecommerceProductModel
    .findOne({
      _id: id,
      companyId,
    })
    .populate({
      path: "product",
      populate: [
        { path: "category" },
        { path: "brand" },
        { path: "unit" },
        { path: "currency" },
        { path: "tax" },
      ],
    });

  return res.status(200).json({
    success: true,
    data: updatedProduct,
  });
});
