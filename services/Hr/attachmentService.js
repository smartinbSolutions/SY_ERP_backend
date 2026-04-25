const Attachment = require("../../models/Hr/attachmentModel");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// ================= UPLOAD ATTACHMENT =================
exports.uploadAttachment = async (file, body, userId) => {
  if (!file) throw new Error("No file provided");

  if (!body.task && !body.subTask) {
    throw new Error("Attachment must belong to a task or subtask");
  }

  const folder = "uploads/taskAttachments";
  await fs.promises.mkdir(folder, { recursive: true });

  // 📄 generate file name
  const ext = path.extname(file.originalname);
  const fileName = `${uuidv4()}-${Date.now()}${ext}`;

  const filePath = `${folder}/${fileName}`;

  // 💾 save file to disk
  await fs.promises.writeFile(filePath, file.buffer);

  // 🧠 save in DB
  const attachment = await Attachment.create({
    fileName,
    fileType: file.mimetype,
    fileSize: file.size,
    task: body.task || null,
    subTask: body.subTask || null,
    uploadedBy: userId,
  });

  return attachment;
};

// ================= GET ATTACHMENTS =================
exports.getAttachments = async (filter) => {
  const query = {};

  if (filter.taskId) query.task = filter.taskId;
  if (filter.subTaskId) query.subTask = filter.subTaskId;

  const attachments = await Attachment.find(query)
    .populate("uploadedBy", "name email")
    .sort({ createdAt: -1 });

  return attachments;
};

// ================= GET SINGLE =================
exports.getAttachmentById = async (id) => {
  const attachment = await Attachment.findById(id).populate(
    "uploadedBy",
    "name email",
  );

  if (!attachment) throw new Error("Attachment not found");

  return attachment;
};

// ================= DELETE ATTACHMENT =================
exports.deleteAttachment = async (attachmentId, userId) => {
  const attachment = await Attachment.findById(attachmentId);

  if (!attachment) throw new Error("Attachment not found");

  // 🔐 only uploader can delete
  if (attachment.uploadedBy.toString() !== userId.toString()) {
    throw new Error("Unauthorized");
  }

  // 🗑 delete file from disk
  const filePath = `uploads/taskAttachments/${attachment.fileName}`;

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // 🗑 delete from DB
  await attachment.deleteOne();

  return true;
};
