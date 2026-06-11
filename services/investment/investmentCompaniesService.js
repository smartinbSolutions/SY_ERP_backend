const asyncHandler = require("express-async-handler");
const investmentCompanies = require("../../models/investment/investmentCompaniesModel");
const Investor = require("../../models/investment/investorModel");
const shareTransactionSchema = require("../../models/investment/investorSharesModel");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const { uploadSingleImage } = require("../../middlewares/uploadingImage");
const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
});

exports.uploadInvestmentCompaniesImage = uploadSingleImage("logo");

exports.uploadInvestmentCompaniesImages = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "bankQR", maxCount: 1 },
]);

// Image processing
exports.resizeInvestmentCompaniesImages = asyncHandler(
  async (req, res, next) => {
    // LOGO
    if (req.files?.logo?.[0]) {
      const logoFilename = `investmentCompanies-${uuidv4()}-${Date.now()}.webp`;

      await sharp(req.files.logo[0].buffer)
        .toFormat("webp")
        .webp({ quality: 70 })
        .toFile(`uploads/investmentCompanies/${logoFilename}`);

      req.body.logo = logoFilename;
    }

    // BANK QR
    if (req.files?.bankQR?.[0]) {
      const bankQRFilename = `bankQR-${uuidv4()}-${Date.now()}.webp`;

      await sharp(req.files.bankQR[0].buffer)
        .toFormat("webp")
        .webp({ quality: 70 })
        .toFile(`uploads/investmentCompanies/${bankQRFilename}`);

      req.body.qrCode = bankQRFilename;
    }

    next();
  },
);

// @desc Create investmentCompanies
// @route POST /api/investmentCompanies
// @access Private
exports.createInvestmentCompanies = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    req.body.companyId = companyId;
    const investCompany = await investmentCompanies.create(req.body);

    res.status(201).json({
      status: true,
      message: "success",
      data: investCompany,
    });
  } catch (error) {
    console.error(`Error creating investmentCompanies: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get all investmentCompaniess
// @route GET /api/investmentCompanies
// @access Private
exports.getAllInvestmentCompaniess = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const investCompanies = await investmentCompanies.find({ companyId });

    res.status(200).json({
      status: true,
      message: "success",
      data: investCompanies,
    });
  } catch (error) {
    console.error(`Error fetching investmentCompaniess: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Get one investmentCompanies
// @route GET /api/investmentCompanies/:id
// @access Private
exports.getOneInvestmentCompanies = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const investCompany = await investmentCompanies.findOne({
      companyId,
      _id: req.params.id,
    });

    if (!investCompany) {
      return res.status(404).json({
        status: false,
        message: "Investment company not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "success",
      data: investCompany,
    });
  } catch (error) {
    console.error(`Error fetching investmentCompanies: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Update investmentCompanies
// @route PUT /api/investmentCompanies/:id
// @access Private
exports.updateInvestmentCompanies = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    req.body.companyId = companyId;

    // Update the company
    const updatedInvestmentCompanies =
      await investmentCompanies.findOneAndUpdate(
        { companyId, _id: req.params.id },
        {
          totalShares: req.body.totalShares,
          availableShares: req.body.availableShares,
          sharePrice: req.body.sharePrice,
          foundersArray: req.body.foundersArray,
          bankQR: req.body.bankQR,
          logo: req.body.logo,
        },
        {
          new: true,
          runValidators: true,
        },
      );

    if (!updatedInvestmentCompanies) {
      return res.status(404).json({
        status: false,
        message: "Investment company not found",
      });
    }

    // Update founders shares
    if (req.body.foundersArray && req.body.foundersArray.length > 0) {
      await Promise.all(
        req.body.foundersArray.map(async (founder) => {
          const { investorId, shares } = founder;

          // Update investor shares
          await Investor.findOneAndUpdate(
            { companyId, _id: investorId },
            {
              $set: { ownedShares: shares, isFounder: true, deletable: false },
            },
            { new: true, upsert: false },
          );

          // Create a transaction record
          await shareTransactionSchema.create({
            investorId,
            type: "buy",
            shares: Number(shares),
            sharePrice: Number(req.body.sharePrice),
            companyId,
          });
        }),
      );
    }

    res.status(200).json({
      status: true,
      message: "success",
      data: updatedInvestmentCompanies,
    });
  } catch (error) {
    console.error(`Error updating investmentCompanies: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// @desc Delete investmentCompanies
// @route DELETE /api/investmentCompanies/:id
// @access Private
exports.deleteInvestmentCompanies = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const deletedinvestmentCompanies =
      await investmentCompanies.findOneAndDelete({
        companyId,
        _id: req.params.id,
      });

    if (!deletedinvestmentCompanies) {
      return res.status(404).json({
        status: false,
        message: "Investment company not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "success",
    });
  } catch (error) {
    console.error(`Error deleting investmentCompanies: ${error.message}`);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

exports.deleteCompanyBank = asyncHandler(async (req, res) => {
  const companyId = req.companyId;

  const { id, bankQRId } = req.params;

  if (!companyId || !bankQRId) {
    return res.status(400).json({
      status: false,
      message: "companyId and bankQRId are required",
    });
  }

  const updatedCompany = await investmentCompanies.findOneAndUpdate(
    {
      _id: id,
      companyId,
    },
    {
      $pull: {
        bankQR: { _id: bankQRId },
      },
    },
    { new: true },
  );

  if (!updatedCompany) {
    return res.status(404).json({
      status: false,
      message: "Investment company or Bank QR not found",
    });
  }

  res.status(200).json({
    status: true,
    message: "Bank QR deleted successfully",
  });
});

exports.updateCompanyBank = asyncHandler(async (req, res) => {
  const { id, bankQRId } = req.params;
  const companyId = req.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  try {
    const update = {
      ...(req.body.name && { "bankQR.$.name": req.body.name }),
      ...(req.body.accountNumber && {
        "bankQR.$.accountNumber": req.body.accountNumber,
      }),
      ...(req.body.qrCode && {
        "bankQR.$.qrCode": req.body.qrCode,
      }),
    };

    const updatedCompany = await investmentCompanies.findOneAndUpdate(
      {
        _id: id,
        companyId,
        "bankQR._id": bankQRId,
      },
      { $set: update },
      { new: true },
    );

    if (!updatedCompany) {
      return res.status(404).json({
        status: false,
        message: "Bank account not found",
      });
    }

    res.status(200).json({
      status: true,
      message: "Bank account updated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: false,
      message: "Error while updating",
    });
  }
});
