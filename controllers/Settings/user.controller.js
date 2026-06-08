const asyncHandler = require("express-async-handler");
const userService = require("../../services/Settings/user.service");
const ApiError = require("../../utils/apiError");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");
const multer = require("multer");

const multerStorage = multer.memoryStorage();

exports.getUsers = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;

  if (!companyId) return next(new ApiError("companyId is required", 400));

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 10);
  const keyword = (req.query.keyword || "").trim();

  const result = await userService.getUsers({
    companyId,
    page,
    limit,
    keyword,
  });

  return res.status(200).json({
    status: "success",
    pages: result.pages,
    results: result.results,
    data: result.data,
  });
});

exports.createUser = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  await userService.checkUserLimit(companyId);

  const user = await userService.createUser({
    companyId,
    body: req.body,
    fileName: req.body.image,
  });

  return res.status(201).json({
    status: "success",
    message: "User created successfully",
    data: user,
  });
});

exports.getUser = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await userService.getUser({
    companyId,
    id: req.params.id,
  });

  return res.status(200).json({
    status: "success",
    data: result.data,
    dashBoardRoles: result.dashBoardRoles,
  });
});

exports.updateUser = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const user = await userService.updateUser({
    companyId,
    body: req.body,
    fileName: req.body.image,
    id: req.params.id,
  });

  return res.status(200).json({
    status: "success",
    message: "User updated successfully",
    data: user,
  });
});

exports.deleteUser = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const result = await userService.deleteUser({
    companyId,
    id: req.params.id,
  });

  return res.status(200).json({
    status: "success",
    data: result,
  });
});

exports.updateUserPassword = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const user = await userService.updateUserPassword({
    companyId,
    id: req.params.id,
    body: req.body,
  });

  return res.status(200).json({
    status: "success",
    message: "User updated Password successfully",
    data: user,
  });
});

exports.reSendPassword = asyncHandler(async (req, res, next) => {
  const companyId = req.companyId;
  if (!companyId) return next(new ApiError("companyId is required", 400));

  const user = await userService.reSendPassword({
    body: req.body,
  });

  return res.status(201).json({
    status: "success",
    message: "User re-sent Password successfully",
    data: user,
  });
});

const multerFilter = function (req, file, cb) {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new ApiError("Only images Allowed", 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });

exports.uploadUserImage = upload.single("image");

exports.resizerUserImage = async (req, res, next) => {
  const filename = `image-${uuidv4()}-${Date.now()}.webp`;

  if (req.file) {
    await sharp(req.file.buffer)
      .webp({ quality: 50 })
      .toFile(`uploads/Image/${filename}`);

    req.body.image = filename;
  }

  next();
};
