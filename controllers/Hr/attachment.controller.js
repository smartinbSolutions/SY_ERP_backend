const asyncHandler = require("express-async-handler");
const ApiError = require("../../utils/apiError");
const service = require("../../services/Hr/attachmentService");

// ================= UPLOAD ATTACHMENT =================
exports.uploadAttachment = asyncHandler(async (req, res, next) => {
  try {
    if (!req.user) return next(new ApiError("Not logged in", 401));
console.log(req.file);

    const attachment = await service.uploadAttachment(
      req.file,
      req.body,
      req.user._id,
    );

    res.status(201).json({
      status: true,
      message: "Attachment uploaded successfully",
      data: attachment,
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});

// ================= GET ATTACHMENTS ======wq===========
exports.getAttachments = asyncHandler(async (req, res) => {
  const { taskId, subTaskId } = req.query;

  const attachments = await service.getAttachments({
    taskId,
    subTaskId,
  });

  res.status(200).json({
    status: true,
    results: attachments.length,
    data: attachments,
  });
});

// ================= GET ONE ATTACHMENT =================
exports.getAttachmentById = asyncHandler(async (req, res, next) => {
  try {
    const attachment = await service.getAttachmentById(req.params.id);

    res.status(200).json({
      status: true,
      data: attachment,
    });
  } catch (err) {
    return next(new ApiError(err.message, 404));
  }
});

// ================= DELETE ATTACHMENT =================
exports.deleteAttachment = asyncHandler(async (req, res, next) => {
  try {
    await service.deleteAttachment(req.params.id, req.user._id);

    res.status(200).json({
      status: true,
      message: "Attachment deleted successfully",
    });
  } catch (err) {
    return next(new ApiError(err.message, 400));
  }
});
