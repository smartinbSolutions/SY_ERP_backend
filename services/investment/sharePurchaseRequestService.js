const asyncHandler = require("express-async-handler");
const sharePurchaseRequestModel = require("../../models/investment/sharePurchaseRequestModel");

// @desc Create share purchase request
// @route POST /api/purchaseRequest
// @access Private
exports.createPurchaseRequest = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    req.body.companyId = companyId;
    const purchaseRequest = await sharePurchaseRequestModel.create(req.body);

    // Respond with success message and created investor data
    res.status(201).json({
      status: true,
      message: "success",
      data: purchaseRequest,
    });
  } catch (error) {
    // Handle errors
    console.error(`Error creating purchase request: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get all purchase requests
// @route GET /api/purchaseRequests
// @access Private
exports.getAllInvestorPurchaseRequest = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 10, sort = "-createdAt" } = req.query;

  try {
    let query = { investorId: req.params.id };
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      sharePurchaseRequestModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .populate({
          path: "investorId",
          select: "_id fullName phoneNumber",
        }),

      sharePurchaseRequestModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: true,
      message: "success",
      pagination: {
        totalItems: total,
        totalPages,
        currentPage: Number(page),
        itemsPerPage: Number(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      data: requests,
    });
  } catch (error) {
    console.error(`Error fetching purchase requests: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
});

// @desc Get all purchase requests
// @route GET /api/purchaseRequests
// @access Private
exports.getAllPurchaseRequest = asyncHandler(async (req, res) => {
  const {
    companyId,
    page = 1,
    limit = 10,
    sort = "-createdAt",
    type,
    keyword,
  } = req.query;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const skip = (page - 1) * limit;

  const matchStage = {
    companyId,
    ...(type && { type }),
  };

  const searchStage =
    keyword && keyword.trim()
      ? {
          $or: [
            { "investor.fullName": { $regex: keyword, $options: "i" } },
            { paymentStatus: { $regex: keyword, $options: "i" } },
            { type: { $regex: keyword, $options: "i" } },
          ],
        }
      : {};

  const pipeline = [
    { $match: matchStage },

    {
      $lookup: {
        from: "investors",
        localField: "investorId",
        foreignField: "_id",
        as: "investor",
      },
    },
    { $unwind: "$investor" },

    { $match: searchStage },

    {
      $sort: sort.startsWith("-") ? { createdAt: -1 } : { createdAt: 1 },
    },

    { $skip: skip },
    { $limit: Number(limit) },
  ];

  const [data, total] = await Promise.all([
    sharePurchaseRequestModel.aggregate(pipeline),
    sharePurchaseRequestModel.countDocuments(matchStage),
  ]);

  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status: true,
    message: "success",
    pagination: {
      totalItems: total,
      totalPages,
      currentPage: Number(page),
      itemsPerPage: Number(limit),
    },
    data,
  });
});

// @desc Get one purchase request
// @route GET /api/purchaseRequests/:id
// @access Private
exports.getOnePurchaseRequest = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const request = await sharePurchaseRequestModel
      .findOne({
        _id: req.params.id,
        companyId,
      })
      .populate({
        path: "investorId",
        select: "_id fullName phoneNumber",
      });

    if (!request) {
      return res.status(404).json({
        status: false,
        message: "Purchase request not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "success",
      data: request,
    });
  } catch (error) {
    console.error(`Error fetching purchase request: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Update investor
// @route PUT /api/investor/:id
// @access Private
exports.updatePurchaseRequest = asyncHandler(async (req, res, next) => {
  const purchaseRequest = await sharePurchaseRequestModel.findByIdAndUpdate(
    { _id: req.params.id },
    req.body,
    {
      new: true,
    }
  );
  if (!purchaseRequest) {
    return res.status(404).json({
      status: false,
      message: "Purchase request not found",
    });
  }
  res
    .status(200)
    .json({ status: true, message: "success", data: purchaseRequest });
});

// @desc Delete purchase request
// @route DELETE /api/purchaseRequests/:id
// @access Private
exports.deletePurchaseRequest = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const deletedRequest = await sharePurchaseRequestModel.findOneAndDelete({
      _id: req.params.id,
      companyId,
    });

    if (!deletedRequest) {
      return res.status(404).json({
        status: false,
        message: "Purchase request not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "success",
    });
  } catch (error) {
    console.error(`Error deleting purchase request: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
