const activityModel = require("../../models/CRM/activityModel");
const leadModel = require("../../models/CRM/leadModel");
const contactModel = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const dealModel = require("../../models/CRM/dealModel");
const ApiError = require("../../utils/apiError");
const { generateCrmNumber } = require("../../utils/crmhelpers");
const { createNotification } = require("../Notification/notificationService");

// ============ VALIDATE RELATED ENTITY ============
const validateRelatedEntity = async (relatedTo, companyId) => {
  if (!relatedTo?.type || !relatedTo?.id) {
    throw new ApiError("relatedTo.type and relatedTo.id are required", 400);
  }

  const modelMap = {
    Lead: leadModel,
    Contact: contactModel,
    Company: companyModel,
    Opportunity: opportunityModel,
    Deal: dealModel,
  };

  const Model = modelMap[relatedTo.type];

  if (!Model) {
    throw new ApiError(
      `Unsupported related entity type: ${relatedTo.type}`,
      400,
    );
  }

  const entity = await Model.findOne({
    _id: relatedTo.id,
    companyId,
    deletedAt: null,
  });

  if (!entity) {
    throw new ApiError(
      `${relatedTo.type} not found or does not belong to this company`,
      404,
    );
  }

  return entity;
};

// ============ GET ALL ============
exports.getAllActivities = async (req) => {
  const companyId = req.companyId;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const {
    keyword,
    type,
    status,
    priority,
    ownerId,
    relatedToType,
    relatedToId,
  } = req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  if (keyword) {
    query.$or = [
      { subject: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ];
  }

  if (type) query.type = type;
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (ownerId) query.ownerId = ownerId;
  if (relatedToType) query["relatedTo.type"] = relatedToType;
  if (relatedToId) query["relatedTo.id"] = relatedToId;

  const [total, activities] = await Promise.all([
    activityModel.countDocuments(query),

    activityModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("tags", "name")
      .populate("attendees", "name email")
      .populate({
        path: "relatedTo.id",
      }),
  ]);

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: activities.length,
    total,
    data: activities,
  };
};

// ============ GET ONE ============
exports.getOneActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const activity = await activityModel
    .findOne({
      _id: id,
      companyId,
      deletedAt: null,
    })
    .populate("ownerId", "name email")
    .populate("tags", "name")
    .populate("attendees", "name email")
    .populate({
      path: "relatedTo.id",
    });

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// ============ CREATE ============
exports.createActivity = async (req) => {
  const companyId = req.companyId;

  // Validate the related entity
  const relatedEntity = await validateRelatedEntity(
    req.body.relatedTo,
    companyId,
  );
  const number = await generateCrmNumber(companyId, "activity");

  const payload = {
    ...req.body,
    companyId,
    deletedAt: null,
    number,
  };

  // 1. Create activity
  const activity = await activityModel.create(payload);

  // 2. Lead lifecycle:
  // new + real communication -> contacted
  if (
    req.body.relatedTo.type === "Lead" &&
    relatedEntity.status === "new" &&
    ["call", "email", "meeting"].includes(req.body.type)
  ) {
    relatedEntity.status = "contacted";

    await relatedEntity.save();

    console.log("LEAD STATUS UPDATED TO:", relatedEntity.status);
  }

  // 3. Create a notification for the activity owner
  try {
    await createNotification({
      companyId,
      recipientId: activity.ownerId,
      actorId: req.user?._id || req.user?.id || null,

      type: "crm.activity.created",

      title: "New CRM activity assigned to you",

      message: `A new ${activity.type} activity "${activity.subject}" has been assigned to you.`,

      entityType: "Activity",
      entityId: activity._id,

      metadata: {
        activityType: activity.type,
        subject: activity.subject,
        relatedTo: {
          type: activity.relatedTo.type,
          id: activity.relatedTo.id,
        },
        dueDate: activity.dueDate || null,
        priority: activity.priority,
      },
    });
  } catch (error) {
    // لا نعيد فشل إنشاء النشاط بعد أن تم حفظه بنجاح.
    console.error(
      "Failed to create notification for CRM activity:",
      error.message,
    );
  }

  return activity;
};

// ============ UPDATE ============
exports.updateActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const updateData = { ...req.body };

  // These fields cannot be changed by the client
  delete updateData.companyId;
  delete updateData.deletedAt;

  // If relatedTo is being changed,
  // make sure the new entity exists and belongs to this company
  if (updateData.relatedTo) {
    await validateRelatedEntity(updateData.relatedTo, companyId);
  }

  // Manage completedAt automatically based on status
  if (Object.prototype.hasOwnProperty.call(updateData, "status")) {
    if (updateData.status === "completed") {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
  }

  const activity = await activityModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },
    updateData,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return activity;
};

// ============ DELETE (Soft) ============
exports.deleteActivity = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const activity = await activityModel.findOneAndUpdate(
    {
      _id: id,
      companyId,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
    },
    {
      new: true,
    },
  );

  if (!activity) {
    throw new ApiError(`No activity found with this ID: ${id}`, 404);
  }

  return "Activity deleted successfully";
};
