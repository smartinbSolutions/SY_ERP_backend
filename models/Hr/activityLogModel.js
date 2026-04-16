const activityLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        "create_task",
        "update_task",
        "delete_task",
        "create_subtask",
        "update_subtask",
        "status_change",
        "assign_user",
        "add_comment",
      ],
    },

    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },

    subTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubTask",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    changes: {
      type: Object, // before / after
    },

    message: {
      type: String, // optional readable text
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ActivityLog", activityLogSchema);
