const asyncHandler = require("express-async-handler");
const {
  journalEntriesService,
  getOneJournalService,
  auditingJournalService,
  createJournalEntryService,
  getOneJournalByLinkServices,
  getOneAccountAndJournalService,
} = require("../../../services/Accounting/JournalEntries/journalEntries.Service");
const counterModel = require("../../../models/Settings/counterModel");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const ApiError = require("../../../utils/apiError");
const { default: mongoose } = require("mongoose");

const multerOptions = () => {
  const multerStorage = multer.memoryStorage();

  const multerFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|webp/;
    const extname = allowedTypes.test(
      file.originalname.toLowerCase().split(".").pop()
    );
    const mimeType = allowedTypes.test(file.mimetype);
    if (extname && mimeType) {
      cb(null, true);
    } else {
      cb(new ApiError("Only images and documents are allowed", 400), false);
    }
  };

  return multer({ storage: multerStorage, fileFilter: multerFilter });
};
const uploadMixOfFiles = (arrayOfFields) =>
  multerOptions().fields(arrayOfFields);

exports.uploadFileAndImagejournal = uploadMixOfFiles([
  { name: "filesArray", maxCount: 5 },
]);

exports.processFilesAndImagesjournal = asyncHandler(async (req, res, next) => {
  // ✅ Always initialize
  req.body.filesArray = [];

  // ✅ Only process if files exist
  if (req.files && Array.isArray(req.files.filesArray)) {
    req.files.filesArray.forEach((file) => {
      const fileName = `file-${uuidv4()}-${Date.now()}-${file.originalname}`;
      const filePath = `uploads/journal/${fileName}`;

      require("fs").writeFileSync(filePath, file.buffer);
      req.body.filesArray.push(fileName);
    });
  }

  next();
});

exports.getJournals = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { totalItems, totalPages, account } = await journalEntriesService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    totalPages: totalPages,
    results: totalItems,
    data: account,
  });
});
exports.getOneJournal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { account } = await getOneJournalService({
    req,
    companyId,
  });

  res.status(200).json({
    status: "true",
    data: account,
  });
});

// exports.createJournal = asyncHandler(async (req, res, next) => {
//   const companyId = req.query.companyId;

//   if (!companyId) {
//     return res.status(400).json({ message: "companyId is required" });
//   }
//   const session = await mongoose.startSession();

//   try {
//     session.startTransaction();
//     const nextCounterJournal = await counterModel.findOneAndUpdate(
//       { companyId, name: "Journal" },
//       { $inc: { seq: 1 } },
//       { new: true, upsert: true, session }
//     );

//     const newJournal = await createJournalEntryService({
//       req,
//       companyId,
//       nextCounterJournal,
//       session,
//     });

//     createJournalEntryService({
//       journalDate: newJournal.journalDate,
//       journalAccounts: req.body.journalAccounts,
//       companyId,
//       session,
//     });
//     await session.commitTransaction();

//     res.status(201).json({
//       status: "true",
//       data: newJournal,
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     next(error);
//   } finally {
//     session.endSession();
//   }
// });

exports.createJournal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const nextCounterJournal = await counterModel.findOneAndUpdate(
      { companyId, name: "Journal" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    );

    // ── validation happens inside service ──────────────────────
    const newJournal = await createJournalEntryService({
      req, // ← standalone route passes req
      companyId,
      nextCounterJournal,
      session,
    });

    await session.commitTransaction();

    res.status(201).json({
      status: "true",
      data: newJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

exports.getOneAccountAndJournal = asyncHandler(async (req, res, next) => {
  const {
    companyId,
    limit,
    page,
    keyword,
    filters: filtersRaw,
    gotoLastMatched,
  } = req.query;
  const { id } = req.params;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const filters = filtersRaw ? JSON.parse(filtersRaw) : {};

  const result = await getOneAccountAndJournalService({
    companyId,
    id,
    limit,
    page,
    keyword,
    filters,
    gotoLastMatched: gotoLastMatched === "true",
  });

  return res.status(200).json({
    status: "true",
    ...result,
  });
});

exports.auditingJournal = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }
  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const auditin = await auditingJournalService({
      req,
      companyId,
      session,
    });
    await session.commitTransaction();

    res.status(201).json({
      status: "true",
      data: auditin,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// controller — destructure data not account
exports.getOneJournalByLink = asyncHandler(async (req, res, next) => {
  const companyId = req.query.companyId;

  if (!companyId) {
    return res.status(400).json({ message: "companyId is required" });
  }

  const { data } = await getOneJournalByLinkServices({ req, companyId }); // ← data

  res.status(200).json({
    status: "true",
    data,
  });
});
