const asyncHandler = require("express-async-handler");
const Investor = require("../models/investorModel");
const shareTransactionSchema = require("../models/investorSharesModel");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const bcrypt = require("bcryptjs");
const investmentCompaniesModel = require("../models/investmentCompaniesModel");
const multer = require("multer");
const fs = require("fs");
const generatePassword = require("../utils/tools/generatePassword");
const sendEmail = require("../utils/sendEmail");

//for creating
const storage = multer.memoryStorage();
const upload = multer({ storage });
exports.uploadInvestorImages = upload.any();

// Image processing
exports.resizeInvestorImages = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  req.body.attachments = [];

  await Promise.all(
    req.files.map(async (file, i) => {
      const isImage = file.mimetype.startsWith("image/");
      const filename = `Investor-${uuidv4()}-${Date.now()}-${file.fieldname}${
        isImage ? ".webp" : ".pdf"
      }`;
      const outputPath = `uploads/Investor/${filename}`;

      if (isImage) {
        await sharp(file.buffer)
          .toFormat("webp")
          .webp({ quality: 70 })
          .toFile(outputPath);
      } else if (file.mimetype === "application/pdf") {
        await fs.promises.writeFile(outputPath, file.buffer);
      } else {
        throw new Error("Unsupported file type");
      }

      // handle attachments
      const key = req.body[`attachment_${i}_key`] || file.fieldname;

      if (file.fieldname === "profileImage" && isImage) {
        req.body.profileImage = filename;
      } else {
        req.body.attachments.push({
          key,
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
    const isFounder = req.body.isFounder === "true";
    req.body.isFounder = isFounder;

    if (req.body.ibanNumbers) {
      req.body.ibanNumbers = JSON.parse(req.body.ibanNumbers);
    }

    const investorPass = generatePassword();
    const hashedPassword = await bcrypt.hash(investorPass, 12);

    req.body.password = hashedPassword;
    //Sned password to email
    await sendEmail({
      email: req.body.email,
      subject: "New Password",
      message: `Hello ${req.body.fullName}, your password is ${investorPass}`,
    });

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

  const { keyword, page = 1, limit = 10, sort } = req.query;

  try {
    const query = { companyId };

    if (keyword && keyword.trim() !== "") {
      query.$or = [
        { fullName: { $regex: keyword, $options: "i" } },
        { latinName: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { phoneNumber: { $regex: keyword, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const sortOption = sort && sort.trim() !== "" ? sort : "-createdAt";

    const [investors, total, company] = await Promise.all([
      Investor.find(query)
        .sort(sortOption) // newest first by default
        .skip(skip)
        .limit(parseInt(limit)),

      Investor.countDocuments(query),
      investmentCompaniesModel.findOne({ companyId }),
    ]);

    // if (!company) {
    //   return res.status(404).json({
    //     status: false,
    //     message: "Company not found",
    //   });
    // }

    const totalPages = Math.ceil(total / limit);

    const investorsList = investors.map((inv) => {
      const ownershipPercentage = company?.totalShares
        ? ((inv.ownedShares || 0) / company?.totalShares) * 100
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
    console.error(`Error while fetching investors data: ${error.message}`);
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
      .populate("counterpartyId", "fullName email")
      .populate("investorId", "fullName email");

    // Calculate total invested, current value, and profit
    let totalInvested = 0;
    let currentValue = 0;

    transactions.forEach((t) => {
      const invested = t.purchaseValue || t.shares * t.sharePrice;
      const current = t.shares * company.sharePrice;
      totalInvested += invested;
      currentValue += current;
    });

    const totalProfit = currentValue - totalInvested;
    const profitPercentage =
      totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

    res.status(200).json({
      status: true,
      message: "success",
      data: {
        ...investor.toObject(),
        ownershipPercentage,
        totalInvested,
        currentValue,
        totalProfit,
        profitPercentage,
        currentSharePrice: company.sharePrice,
      },
      transactions: {
        total: totalTransactions,
        page,
        limit,
        totalPages: Math.ceil(totalTransactions / limit),
        items: transactions.map((t) => ({
          ...t.toObject(),
          currentValue: t.shares * company.sharePrice,
          profit:
            t.shares * company.sharePrice -
            (t.purchaseValue || t.shares * t.sharePrice),
          profitPercentage:
            ((t.shares * company.sharePrice -
              (t.purchaseValue || t.shares * t.sharePrice)) /
              (t.purchaseValue || t.shares * t.sharePrice)) *
            100,
        })),
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
  const {
    shares,
    type,
    counterpartyId,
    sharePrice,
    purchaseValue,
    description,
  } = req.body;

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
    actor.deletable = false;
    counterparty.deletable = false;

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
        purchaseValue,
        description,
        companyId,
      },
      {
        investorId: sellerId,
        counterpartyId: buyerId,
        type: "sell",
        shares: Number(shares),
        sharePrice: Number(sharePrice),
        purchaseValue,
        description,
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
    const ext = file.mimetype.startsWith("image/")
      ? ".webp"
      : file.mimetype === "application/pdf"
      ? ".pdf"
      : "";

    const safeFieldname = file.fieldname.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Investor-${uuidv4()}-${Date.now()}-${safeFieldname}${ext}`;
    cb(null, filename);
  },
});

const uploadDisk = multer({
  storage: storageDisk,
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only image and PDF files are allowed!"), false);
    }
  },
});

exports.uploadInvestorImagesDisk = uploadDisk.any();

exports.processInvestorFiles = asyncHandler(async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  req.body.attachments = [];

  await Promise.all(
    req.files.map(async (file, i) => {
      const isImage = file.mimetype.startsWith("image/");
      const outputPath = file.path;

      // Convert only images (PDFs are fine)
      if (isImage) {
        await sharp(outputPath)
          .toFormat("webp")
          .webp({ quality: 70 })
          .toFile(outputPath);
      }

      const key = req.body[`attachment_${i}_key`] || file.fieldname;

      if (file.fieldname === "profileImage" && isImage) {
        req.body.profileImage = file.filename;
      } else {
        req.body.attachments.push({
          key,
          fileUrl: file.filename,
        });
      }
    })
  );

  next();
});

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

    const fields = [
      "fullName",
      "phoneNumber",
      "email",
      "birthDate",
      "latinName",
    ];
    fields.forEach((f) => {
      if (req.body[f]) existingInvestor[f] = req.body[f];
    });

    if (req.body.ibanNumbers) {
      existingInvestor.ibanNumbers = JSON.parse(req.body.ibanNumbers);
    }

    // === Keep-list approach: delete attachments that are NOT included in existingAttachments ===
    if (typeof req.body.existingAttachments !== "undefined") {
      let keepKeys = [];
      try {
        keepKeys = JSON.parse(req.body.existingAttachments || "[]");
      } catch (err) {
        console.warn("Invalid existingAttachments payload:", err.message);
        keepKeys = [];
      }

      existingInvestor.attachments = existingInvestor.attachments.filter(
        (att) => {
          const shouldKeep = keepKeys.includes(att.key);
          if (!shouldKeep) {
            try {
              fs.unlinkSync(path.join("uploads/Investor", att.fileUrl));
            } catch (err) {
              console.warn("Failed to delete removed attachment:", err.message);
            }
          }
          return shouldKeep;
        }
      );
    }

    // === Handle uploaded files (req.files is an array from upload.any()) ===
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        // file.fieldname is like "attachment_0" or "profileImage"
        // the client sends attachment_{index}_key for new files
        const key =
          req.body[`${file.fieldname}_key`] ||
          file.fieldname.replace(/^attachment_\d+/, "attachment");

        if (file.fieldname === "profileImage") {
          // delete old profile image
          if (existingInvestor.profileImage) {
            try {
              fs.unlinkSync(
                path.join("uploads/Investor", existingInvestor.profileImage)
              );
            } catch (err) {
              console.warn("Failed to delete old profile image:", err.message);
            }
          }
          existingInvestor.profileImage = file.filename;
        } else {
          const index = existingInvestor.attachments.findIndex(
            (att) => att.key === key
          );
          const newFile = { key, fileUrl: file.filename };

          if (index > -1) {
            // replace: delete old file then set new
            try {
              fs.unlinkSync(
                path.join(
                  "uploads/Investor",
                  existingInvestor.attachments[index].fileUrl
                )
              );
            } catch (err) {
              console.warn("Failed to delete old attachment:", err.message);
            }
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
      message: "Investor updated successfully",
      data: updatedInvestor,
    });
  } catch (error) {
    console.error("Error updating investor:", error.message);
    res.status(500).json({
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
    // Find the investor first
    const investor = await Investor.findOne({
      companyId,
      _id: req.params.id,
    });

    if (!investor) {
      return res.status(404).json({
        status: false,
        message: "Investor not found",
      });
    }

    // Check if investor is deletable
    if (!investor.deletable) {
      return res.status(403).json({
        status: false,
        message: "This investor cannot be deleted.",
      });
    }

    // Delete the investor
    await Investor.deleteOne({ _id: investor._id });

    res.status(200).json({
      status: true,
      message: "Investor deleted successfully.",
    });
  } catch (error) {
    console.error(`Error deleting Investor: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});
