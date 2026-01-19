  const mongoose = require("mongoose");

  const staffFilesSchema = new mongoose.Schema(
    {
      staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "staff",
        required: true,
        index: true,
      },

      fileTypeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Files",
        required: true,
      },

      fileUrl: {
        type: String,
        required: true,
      },

      originalName: {
        type: String,
        required: true,
        index: true,
      },

      mimeType: {
        type: String,
        required: true,
      },

      size: {
        type: Number,
        required: true,
      },

      expiryDate: {
        type: Date,
        default: null,
      },

      companyId: {
        type: String,
        required: true,
        index: true,
      },
    },
    {
      timestamps: true,
    }
  );
  const setFileURL = (doc) => {
    if (doc.fileUrl && !doc.fileUrl.startsWith("http")) {
      doc.fileUrl = `${process.env.BASE_URL}/${doc.fileUrl}`;
    }
  };


  staffFilesSchema.pre("insertMany", function (next, docs) {
    docs.forEach((doc) => {
      if (doc.fileUrl && !doc.fileUrl.startsWith("http")) {
        doc.fileUrl = `${process.env.BASE_URL}/${doc.fileUrl}`;
      }
    });
    next();
  });

  module.exports = mongoose.model("StaffFiles", staffFilesSchema);
