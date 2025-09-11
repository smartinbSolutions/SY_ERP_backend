const asyncHandler = require("express-async-handler");
const Investor = require("../models/investorModel");
const shareTransactionSchema = require("../models/investorSharesModel");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const investmentCompaniesModel = require("../models/investmentCompaniesModel");
const multer = require("multer");

//for creating
const storage = multer.memoryStorage();
const upload = multer({ storage });
exports.uploadInvestorImages = upload.any();

// Image processing
exports.resizeInvestorImages = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  req.body.attachments = [];

  await Promise.all(
    req.files.map(async (file) => {
      const filename = `Investor-${uuidv4()}-${Date.now()}-${
        file.fieldname
      }.webp`;

      await sharp(file.buffer)
        .toFormat("webp")
        .webp({ quality: 70 })
        .toFile(`uploads/Investor/${filename}`);

      // Special case for profileImage
      if (file.fieldname === "profileImage") {
        req.body.profileImage = filename;
      } else {
        req.body.attachments.push({
          key: file.fieldname,
          fileUrl: filename,
        });
      }
    })
  );

  next();
});

// @desc Create Investor
// @route POST /api/Investor
// @access Private
exports.createInvestor = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    req.body.companyId = companyId;

    if (req.body.ibanNumbers) {
      req.body.ibanNumbers = JSON.parse(req.body.ibanNumbers);
    }

    const investor = await Investor.create(req.body);

    res.status(201).json({
      status: true,
      message: "success",
      data: investor,
    });
  } catch (error) {
    console.error(`Error creating investor: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get all investors
// @route GET /api/investor
// @access Private
exports.getAllInvestors = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const { keyword, page = 1, limit = 10, sort = "-createdAt" } = req.query;

  try {
    const query = { companyId };

    if (keyword && keyword.trim() !== "") {
      query.$or = [
        { fullName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { phoneNumber: { $regex: keyword, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [investors, total, company] = await Promise.all([
      Investor.find(query).sort(sort).skip(skip).limit(parseInt(limit)),

      Investor.countDocuments(query),
      investmentCompaniesModel.findOne({ companyId }),
    ]);

    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company not found",
      });
    }

    const totalPages = Math.ceil(total / limit);

    const investorsList = investors.map((inv) => {
      const ownershipPercentage = company.totalShares
        ? ((inv.ownedShares || 0) / company.totalShares) * 100
        : 0;

      return {
        ...inv.toObject(),
        ownershipPercentage,
      };
    });

    res.status(200).json({
      status: true,
      message: "success",
      pagination: {
        totalItems: total,
        totalPages,
        currentPage: parseInt(page),
        itemsPerPage: parseInt(limit),
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      data: investorsList,
    });
  } catch (error) {
    console.error(`error while fetching investors data: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get one Investor
// @route GET /api/Investor/:id
// @access Private
exports.getOneInvestor = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const investor = await Investor.findOne({ companyId, _id: req.params.id });

    if (!investor) {
      return res.status(404).json({
        status: false,
        message: "Investor not found",
      });
    }

    const company = await investmentCompaniesModel.findOne({ companyId });
    if (!company) {
      return res.status(404).json({
        status: false,
        message: "Company not found",
      });
    }

    const ownershipPercentage = company.totalShares
      ? ((investor.ownedShares || 0) / company.totalShares) * 100
      : 0;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalTransactions = await shareTransactionSchema.countDocuments({
      companyId,
      investorId: req.params.id,
    });

    const transactions = await shareTransactionSchema
      .find({ companyId, investorId: req.params.id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("counterpartyId", "fullName email");

    res.status(200).json({
      status: true,
      message: "success",
      data: {
        ...investor.toObject(),
        ownershipPercentage: ownershipPercentage,
      },
      transactions: {
        total: totalTransactions,
        page,
        limit,
        totalPages: Math.ceil(totalTransactions / limit),
        items: transactions,
      },
    });
  } catch (error) {
    console.error(`Error fetching investor: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Update investor
// @route PUT /api/investorShares/:id
// @access Private
exports.updateInvestorShares = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  const { shares, type, counterpartyId, sharePrice } = req.body;

  if (!companyId) {
    return res
      .status(400)
      .json({ status: false, message: "companyId is required" });
  }

  if (!shares || isNaN(shares) || shares <= 0) {
    return res
      .status(400)
      .json({ status: false, message: "Valid shares value is required" });
  }

  if (!sharePrice || isNaN(sharePrice) || sharePrice <= 0) {
    return res
      .status(400)
      .json({ status: false, message: "Valid share price value is required" });
  }

  if (!["buy", "sell"].includes(type)) {
    return res
      .status(400)
      .json({ status: false, message: "Invalid transaction type" });
  }

  if (!counterpartyId) {
    return res
      .status(400)
      .json({ status: false, message: "counterpartyId is required" });
  }

  try {
    // Actor = the one performing the action (buyer if type="buy", seller if type="sell")
    const actor = await Investor.findOne({ _id: req.params.id, companyId });
    if (!actor) {
      return res
        .status(404)
        .json({ status: false, message: "Actor investor not found" });
    }

    // Counterparty = the other side of the trade
    const counterparty = await Investor.findOne({
      _id: counterpartyId,
      companyId,
    });
    if (!counterparty) {
      return res
        .status(404)
        .json({ status: false, message: "Counterparty investor not found" });
    }

    // Validate enough shares to sell
    if (type === "buy") {
      if (counterparty.ownedShares < shares) {
        return res.status(400).json({
          status: false,
          message: "Counterparty does not have enough shares to sell",
        });
      }
    } else if (type === "sell") {
      if (actor.ownedShares < shares) {
        return res
          .status(400)
          .json({ status: false, message: "Not enough shares to sell" });
      }
    }

    // Perform trade
    if (type === "buy") {
      actor.ownedShares += Number(shares);
      counterparty.ownedShares -= Number(shares);
    } else {
      actor.ownedShares -= Number(shares);
      counterparty.ownedShares += Number(shares);
    }

    await actor.save();
    await counterparty.save();

    // Record both sides of transaction
    const buyerId = type === "buy" ? actor._id : counterparty._id;
    const sellerId = type === "sell" ? actor._id : counterparty._id;

    await shareTransactionSchema.create([
      {
        investorId: buyerId,
        counterpartyId: sellerId,
        type: "buy",
        shares: Number(shares),
        sharePrice: Number(sharePrice),
        companyId,
      },
      {
        investorId: sellerId,
        counterpartyId: buyerId,
        type: "sell",
        shares: Number(shares),
        sharePrice: Number(sharePrice),
        companyId,
      },
    ]);

    res.status(200).json({
      status: true,
      message: "Trade completed successfully",
      data: { actor, counterparty },
    });
  } catch (error) {
    console.error(`Error updating shares: ${error.message}`);
    res.status(500).json({ status: false, message: error.message });
  }
});

// for updating
const storageDisk = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/Investor");
  },
  filename: (req, file, cb) => {
    const filename = `Investor-${uuidv4()}-${Date.now()}-${
      file.fieldname
    }.webp`;
    cb(null, filename);
  },
});
const uploadDisk = multer({ storage: storageDisk });

// allow ANY field name as attachment key
exports.uploadInvestorImagesDisk = uploadDisk.any();

// @desc Update investor
// @route PUT /api/investor/:id
// @access Private
exports.updateInvestor = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;
  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const existingInvestor = await Investor.findOne({
      _id: req.params.id,
      companyId,
    });
    if (!existingInvestor) {
      return res.status(404).json({
        status: false,
        message: "Investor not found",
      });
    }

    // Update basic fields
    if (req.body.fullName) existingInvestor.fullName = req.body.fullName;
    if (req.body.phoneNumber)
      existingInvestor.phoneNumber = req.body.phoneNumber;
    if (req.body.email) existingInvestor.email = req.body.email;
    if (req.body.birthDate) existingInvestor.birthDate = req.body.birthDate;
    if (req.body.ibanNumbers) {
      existingInvestor.ibanNumbers = JSON.parse(req.body.ibanNumbers);
    }

    // Update profile image if uploaded
    if (req.files?.profileImage?.length > 0) {
      existingInvestor.profileImage = req.files.profileImage[0].path;
    }

    // Add/merge attachments
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        if (file.fieldname === "profileImage") {
          existingInvestor.profileImage = file.filename;
        } else {
          const index = existingInvestor.attachments.findIndex(
            (att) => att.key === file.fieldname
          );
          const newFile = { key: file.fieldname, fileUrl: file.filename };

          if (index > -1) {
            existingInvestor.attachments[index] = newFile;
          } else {
            existingInvestor.attachments.push(newFile);
          }
        }
      });
    }

    const updatedInvestor = await existingInvestor.save();

    res.status(200).json({
      status: true,
      message: "success",
      data: updatedInvestor,
    });
  } catch (error) {
    console.error(`Error updating Investor: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Delete Investor
// @route DELETE /api/Investor/:id
// @access Private
exports.deleteInvestor = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    // Find and delete the Investor
    const deletedInvestor = await Investor.findOneAndDelete({
      companyId,
      _id: req.params.id,
    });

    // If the Investor is not found
    if (!deletedInvestor) {
      return res.status(404).json({
        status: false,
        message: "Investor not found",
      });
    }

    // Respond with success message
    res.status(200).json({
      status: true,
      message: "Investor deleted",
    });
  } catch (error) {
    // Handle errors
    console.error(`Error deleting Investor: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
