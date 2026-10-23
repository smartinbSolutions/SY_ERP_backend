const mongoose = require("mongoose");

const leadModel = require("../../models/CRM/leadModel");
const contactModel = require("../../models/CRM/contactModel");
const companyModel = require("../../models/CRM/companyModel");
const opportunityModel = require("../../models/CRM/opportunityModel");
const pipelineModel = require("../../models/CRM/piplineModel");

const {
  createExitCriteriaStatus,
  createRequiredActionsStatus,
} = require("./opportunity.service");

const ApiError = require("../../utils/apiError");
const countryModel = require("../../models/Shared/country.model");
const productModel = require("../../models/Stocks/products/productModel");
const {
  generateCrmNumber,
  resolveIsPrimary,
} = require("../../utils/crmhelpers");
const referenceModel = require("../../models/CRM/referenceModel");
const activityModel = require("../../models/CRM/activityModel");
const currencyModel = require("../../models/Settings/currency.model");

const validateInterestedIn = async (req) => {
  if (!("interestedIn" in req.body)) return;

  const ids = Array.isArray(req.body.interestedIn)
    ? [...new Set(req.body.interestedIn.map(String))]
    : [];

  if (ids.length) {
    const count = await productModel.countDocuments({
      _id: { $in: ids },
      companyId: req.companyId,
    });

    if (count !== ids.length) {
      throw new ApiError("Invalid product selected", 400);
    }
  }

  req.body.interestedIn = ids; // [] clears it
};

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const resolveReferenceId = async (
  companyId,
  source,
  body,
  currentId = null,
) => {
  if (source !== "referral") return null;

  if (body.referenceId) return body.referenceId;

  // Nothing new was sent: keep the reference the lead already has.
  if (!body.reference && currentId) return currentId;

  const ref = body.reference || {};
  const name = ref.name?.trim();
  if (!name) throw new ApiError("Reference name is required", 400);

  const phone = ref.phone?.trim();
  const email = ref.email?.trim().toLowerCase();

  // Reuse an existing reference so the same person isn't duplicated.
  const matchers = [];
  if (phone) matchers.push({ phone });
  if (email) matchers.push({ email });
  if (!matchers.length) {
    matchers.push({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
  }

  const existing = await referenceModel
    .findOne({ companyId, deletedAt: null, $or: matchers })
    .select("_id")
    .lean();

  if (existing) return existing._id;

  const created = await referenceModel.create({
    companyId,
    name,
    type: ["person", "company", "partner"].includes(ref.type)
      ? ref.type
      : "person",
    ...(phone ? { phone } : {}),
    ...(ref.whatsApp?.trim() ? { whatsApp: ref.whatsApp.trim() } : {}),
    ...(email ? { email } : {}),
    ...(ref.notes?.trim() ? { notes: ref.notes.trim() } : {}),
    number: await generateCrmNumber(companyId, "reference"),
  });

  return created._id;
};

// ======================================================
// CALCULATE BANT SCORE
// ======================================================

// Timeline is scored from the timeframe only. Dates are informational.
const TIMELINE_SCORES = { someday: 1, year: 2, quarter: 2, urgent: 3 };

/**
 * BANT score (0 - 12). Notes never count.
 *
 * Budget    : amount = 2, confirmed + amount = 3
 * Authority : linked contact = 2, + decision maker = 3
 * Need      : base 1, +1 pain point, +1 impact
 * Timeline  : someday 1, year 2, quarter 2, urgent 3
 *
 * Keep in sync with calculateBantBreakdown in the frontend
 * (Leadqualification.jsx).
 */
exports.calculateBantScore = (bant = {}) => {
  // Budget: 0 - 3
  const hasAmount = Number(bant.budget?.amount) > 0;
  const budget = hasAmount ? (bant.budget.confirmed ? 3 : 2) : 0;

  // Authority: 0 - 3
  const hasContact = Boolean(bant.authority?.decisionMakerId);
  const authority = hasContact ? (bant.authority.isDecisionMaker ? 3 : 2) : 0;

  // Need: 1 - 3
  const hasPainPoint = Boolean(bant.need?.painPoint?.trim());
  const hasImpact = Boolean(bant.need?.impact?.trim());
  const need = 1 + Number(hasPainPoint) + Number(hasImpact);

  // Timeline: 1 - 3
  const timeline =
    TIMELINE_SCORES[bant.timeline?.urgency || "someday"] ??
    TIMELINE_SCORES.someday;

  return Math.min(budget + authority + need + timeline, 12);
};
// ======================================================
// GET ALL
// ======================================================

exports.getAllLeads = async (req) => {
  const companyId = req.companyId;

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  const { keyword, status, source, ownerId, country, referenceId } = req.query;

  const query = {
    companyId,
    deletedAt: null,
  };

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword.trim()), "i");

    query.$or = [
      { LeadName: regex },
      { number: regex },
      { email: regex },
      { phone: regex },
      { companyName: regex },
    ];
  }

  if (status) query.status = status;
  if (source) query.source = source;
  if (ownerId) query.ownerId = ownerId;
  if (country) query.country = country;

  if (referenceId) {
    if (!mongoose.Types.ObjectId.isValid(referenceId)) {
      throw new ApiError("Invalid reference ID", 400);
    }
    query.referenceId = referenceId;
  }

  const [total, leads] = await Promise.all([
    leadModel.countDocuments(query),

    leadModel
      .find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("ownerId", "name email")
      .populate("country", "name nameAr nameTr iso2 phoneCode")
      .populate("referenceId", "name number phone whatsApp")
      .lean(),
  ]);

  /* ---------- last / next activity (2 queries for the whole page) ---------- */

  const leadIds = leads.map((l) => l._id);

  const pickPerLead = (match, sort) =>
    activityModel.aggregate([
      {
        $match: {
          companyId,
          deletedAt: null,
          "relatedTo.type": "Lead",
          "relatedTo.id": { $in: leadIds },
          ...match,
        },
      },
      { $sort: sort },
      { $group: { _id: "$relatedTo.id", activity: { $first: "$$ROOT" } } },
      {
        $project: {
          "activity._id": 1,
          "activity.number": 1,
          "activity.type": 1,
          "activity.subject": 1,
          "activity.status": 1,
          "activity.priority": 1,
          "activity.outcome": 1,
          "activity.dueDate": 1,
          "activity.completedAt": 1,
        },
      },
    ]);

  const [lastRows, nextRows] = await Promise.all([
    // last: most recently completed
    pickPerLead(
      { status: "completed", completedAt: { $ne: null } },
      { completedAt: -1 },
    ),
    // next: earliest planned activity that has a due date (overdue included)
    pickPerLead({ status: "planned", dueDate: { $ne: null } }, { dueDate: 1 }),
  ]);

  const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.activity]));

  const lastMap = toMap(lastRows);
  const nextMap = toMap(nextRows);

  const data = leads.map((l) => ({
    ...l,
    lastActivity: lastMap.get(String(l._id)) || null,
    nextActivity: nextMap.get(String(l._id)) || null,
  }));

  return {
    status: "success",
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    results: data.length,
    total,
    data,
  };
};
// ======================================================
// GET ONE
// ======================================================

exports.getOneLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel
    .findOne({ _id: id, companyId, deletedAt: null })
    .populate("country", "name nameAr nameTr iso2 phoneCode")
    .populate("interestedIn", "name type unit qr")

    // Lead owner
    .populate("ownerId", "name email firstName lastName username")

    // Converted contact
    .populate(
      "convertedTo.contactId",
      "firstName lastName email phone jobTitle companyId",
    )

    // Converted CRM company
    .populate("convertedTo.crmCompanyId", "name industry website phone email")

    // Converted opportunity
    .populate(
      "convertedTo.opportunityId",
      "title value currency status pipelineId expectedCloseDate ownerId",
    )

    .populate(
      "bant.authority.decisionMakerId",
      "firstName lastName email phone",
    )

    // User who converted the lead
    .populate(
      "convertedTo.convertedBy",
      "name email firstName lastName username",
    )
    .populate("tags", "name")
    .populate("referenceId", "name type phone whatsApp email notes number");

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  return lead;
};

// ======================================================
// CREATE
// ======================================================

exports.createLead = async (req) => {
  const companyId = req.companyId;

  // ----------------------------------------------------
  // Check duplicate email
  // ----------------------------------------------------

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  // ----------------------------------------------------
  // Validate country
  // ----------------------------------------------------

  if (req.body.country) {
    const country = await countryModel
      .findOne({ _id: req.body.country, isActive: true })
      .select("_id")
      .lean();

    if (!country) {
      throw new ApiError("Invalid country", 400);
    }
  } else {
    delete req.body.country; // avoid saving "" (cast error)
  }

  await validateInterestedIn(req);
  const referenceId = await resolveReferenceId(
    companyId,
    req.body.source,
    req.body,
  );
  // ----------------------------------------------------
  // Generate lead number
  // ----------------------------------------------------

  const number = await generateCrmNumber(companyId, "lead");

  // ----------------------------------------------------
  // Build payload
  // ----------------------------------------------------

  const payload = {
    ...req.body,

    companyId,
    ownerId: req.user._id,
    deletedAt: null,
    number,
    referenceId,

    // Every newly created lead starts as NEW.
    // Frontend cannot control this.
    status: "new",
  };

  // ----------------------------------------------------
  // Calculate BANT score
  // ----------------------------------------------------

  // Never trust BANT score from frontend
  payload.bant = payload.bant || {};

  const bantScore = exports.calculateBantScore(payload.bant);

  payload.bant.score = bantScore;

  // IMPORTANT:
  // BANT does NOT qualify a brand-new lead.
  // The lead must first become "contacted".
  //
  // Therefore:
  // new lead -> always "new"

  const lead = await leadModel.create(payload);

  return lead;
};

// ======================================================
// UPDATE
// ======================================================

exports.updateLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  // ----------------------------------------------------
  // Check duplicate email
  // ----------------------------------------------------

  if (req.body.email) {
    const exists = await leadModel.findOne({
      companyId,
      email: req.body.email,
      _id: { $ne: id },
      deletedAt: null,
    });

    if (exists) {
      throw new ApiError("A lead with this email already exists", 400);
    }
  }

  if (req.body.country) {
    const country = await countryModel
      .findOne({ _id: req.body.country, isActive: true })
      .select("_id")
      .lean();
    if (!country) throw new ApiError("Invalid country", 400);
  } else if ("country" in req.body) {
    req.body.country = null; // user cleared it
  }

  await validateInterestedIn(req);

  // ----------------------------------------------------
  // Get existing lead
  // ----------------------------------------------------

  const existingLead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!existingLead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // ----------------------------------------------------
  // Converted leads cannot be updated
  // ----------------------------------------------------

  if (existingLead.status === "converted") {
    throw new ApiError("A converted lead cannot be updated", 400);
  }

  const updateData = { ...req.body };
  console.log("UPDATE LEAD BODY:", req.body);
  console.log("UPDATE LEAD DATA:", updateData);
  // ----------------------------------------------------
  // Protected fields
  // ----------------------------------------------------

  delete updateData.companyId;
  delete updateData.deletedAt;
  delete updateData.ownerId;

  if ("source" in updateData || "reference" in updateData) {
    const effectiveSource = updateData.source ?? existingLead.source;

    updateData.referenceId = await resolveReferenceId(
      companyId,
      effectiveSource,
      updateData,
      existingLead.referenceId,
    );
  }

  delete updateData.reference;

  // ----------------------------------------------------
  // Status is controlled by the Lead lifecycle
  // ----------------------------------------------------

  if (updateData.status) {
    throw new ApiError(
      "Lead status is managed by the CRM lifecycle and cannot be changed directly",
      400,
    );
  }

  // ----------------------------------------------------
  // Recalculate BANT when BANT is updated
  // ----------------------------------------------------

  if (updateData.bant) {
    const updatedBant = {
      ...existingLead.bant?.toObject?.(),
      ...updateData.bant,

      budget: {
        ...existingLead.bant?.budget?.toObject?.(),
        ...updateData.bant.budget,
      },

      authority: {
        ...existingLead.bant?.authority?.toObject?.(),
        ...updateData.bant.authority,
      },

      need: {
        ...existingLead.bant?.need?.toObject?.(),
        ...updateData.bant.need,
      },

      timeline: {
        ...existingLead.bant?.timeline?.toObject?.(),
        ...updateData.bant.timeline,
      },
    };

    const bantScore = exports.calculateBantScore(updatedBant);

    updatedBant.score = bantScore;

    updateData.bant = updatedBant;
    if (existingLead.status === "qualified") {
      if (bantScore <= 6) {
        updateData.status = "contacted";
      }
    }
  }

  // ----------------------------------------------------
  // Update lead
  // ----------------------------------------------------

  const lead = await leadModel.findOneAndUpdate(
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

  return lead;
};

// ======================================================
// CONVERT LEAD
// ======================================================

const OPPORTUNITY_RISK_LEVELS = ["low", "medium", "high"];

exports.convertLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const body = req.body || {};

  // 1. Find Lead
  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // ----------------------------------------------------
  // 2. Validate conversion
  // ----------------------------------------------------

  if (lead.convertedTo?.contactId || lead.convertedTo?.opportunityId) {
    throw new ApiError("This lead has already been converted", 400);
  }

  // Only qualified leads can be converted
  if (lead.status !== "qualified") {
    throw new ApiError("Only qualified leads can be converted", 400);
  }

  // ----------------------------------------------------
  // 3. Qualification check
  //
  // BANT score > 6  → Qualified → continue conversion
  // BANT score <= 6 → Unqualified → block conversion
  // ----------------------------------------------------

  const bantScore = exports.calculateBantScore(lead.bant || {});

  if (bantScore <= 6) {
    throw new ApiError(
      `This lead is unqualified and cannot be converted. BANT score: ${bantScore}`,
      400,
    );
  }

  // ====================================================
  // 4. VALIDATE EVERYTHING FIRST
  //    Nothing is saved in this section, so a failed
  //    check never leaves a company or contact behind.
  // ====================================================

  // ---------- Contact (REQUIRED) ----------

  const { contactOption, contactId, contactData } = body;

  if (!["existing", "create"].includes(contactOption)) {
    throw new ApiError("Invalid contact option", 400);
  }

  let existingContact = null; // contactOption === "existing"
  let newContactFields = null; // contactOption === "create"

  if (contactOption === "existing") {
    if (!contactId) {
      throw new ApiError("Contact ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      throw new ApiError("Invalid contact ID", 400);
    }

    existingContact = await contactModel.findOne({
      _id: contactId,
      companyId,
      deletedAt: null,
    });

    if (!existingContact) {
      throw new ApiError("Contact not found", 404);
    }
  } else {
    const data = contactData || {};
    const fullName = data.fullName?.trim();
    const email = data.email?.trim().toLowerCase() || undefined;

    if (!fullName) {
      throw new ApiError("Full name is required", 400);
    }

    if (email) {
      const duplicateContact = await contactModel.findOne({
        companyId,
        email,
        deletedAt: null,
      });

      if (duplicateContact) {
        throw new ApiError(
          "A contact with this email already exists",
          400,
          "CONTACT_EMAIL_EXISTS",
        );
      }
    }

    newContactFields = {
      fullName,
      email,
      phone: data.phone?.trim() || undefined,
      jobTitle: data.jobTitle?.trim() || undefined,
      assignedTo: data.assignedTo || lead.ownerId,
      source: data.source || lead.source || "other",
    };
  }

  // ---------- Company (OPTIONAL) ----------
  //
  // An existing contact that already has a company is LOCKED to it:
  // the opportunity's company is that company, and the company choice
  // in the request is ignored. Otherwise the user picks none / existing / create.

  let crmCompany = null; // the company the contact ends up with
  let newCompanyFields = null; // set only when a company must be created

  if (existingContact?.crmCompanyId) {
    // A deleted / missing company counts as "no company".
    crmCompany = await companyModel.findOne({
      _id: existingContact.crmCompanyId,
      companyId,
      deletedAt: null,
    });
  }

  const companyLocked = Boolean(crmCompany);

  if (!companyLocked) {
    const { companyOption, selectedCrmCompanyId, companyData } = body;

    if (!["existing", "create", "none"].includes(companyOption)) {
      throw new ApiError("Invalid company option", 400);
    }

    if (companyOption === "existing") {
      if (!selectedCrmCompanyId) {
        throw new ApiError("Company ID is required", 400);
      }

      if (!mongoose.Types.ObjectId.isValid(selectedCrmCompanyId)) {
        throw new ApiError("Invalid company ID", 400);
      }

      crmCompany = await companyModel.findOne({
        _id: selectedCrmCompanyId,
        companyId,
        deletedAt: null,
      });

      if (!crmCompany) {
        throw new ApiError("Company not found", 404);
      }
    }

    if (companyOption === "create") {
      const data = companyData || {};
      const name = data.name?.trim();

      if (!name) {
        throw new ApiError("Company name is required", 400);
      }

      const duplicateCompany = await companyModel.findOne({
        companyId,
        name: new RegExp(`^${escapeRegex(name)}$`, "i"),
        deletedAt: null,
      });

      if (duplicateCompany) {
        throw new ApiError(
          "A company with this name already exists",
          400,
          "COMPANY_NAME_EXISTS",
        );
      }

      // Only whitelisted fields; the lead's owner and country are the defaults.
      newCompanyFields = {
        name,
        website: data.website?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        email: data.email?.trim() || undefined,
        country: data.country || lead.country || undefined,
        ownerId: data.ownerId || lead.ownerId,
      };
    }
  }

  // ---------- Pipeline ----------

  const requestedPipelineId = body.pipelineId;

  let pipeline;

  if (requestedPipelineId) {
    if (!mongoose.Types.ObjectId.isValid(requestedPipelineId)) {
      throw new ApiError("Invalid pipeline ID", 400);
    }

    pipeline = await pipelineModel.findOne({
      _id: requestedPipelineId,
      companyId,
      isActive: true,
      deletedAt: null,
    });
  } else {
    pipeline = await pipelineModel.findOne({
      companyId,
      isDefault: true,
      isActive: true,
      deletedAt: null,
    });
  }

  if (!pipeline) {
    throw new ApiError("No active pipeline was found", 400);
  }

  const firstStage = [...pipeline.stages].sort((a, b) => a.order - b.order)[0];

  if (!firstStage) {
    throw new ApiError("Pipeline has no stages", 400);
  }

  // ---------- Currency ----------

  if (!mongoose.Types.ObjectId.isValid(body.currency)) {
    throw new ApiError("A valid currency is required", 400);
  }

  // Adjust if your currencies are scoped per tenant (e.g. add companyId).
  const currency = await currencyModel.findById(body.currency);

  if (!currency) {
    throw new ApiError("Currency not found", 400);
  }

  // ---------- Opportunity fields ----------
  //
  // A default is used only when the field is missing from the request.
  // A value the user cleared is kept as cleared.

  let value = lead.bant?.budget?.amount ?? 0;

  if (body.value !== undefined && body.value !== null) {
    value = Number(body.value === "" ? 0 : body.value);

    if (!Number.isFinite(value) || value < 0) {
      throw new ApiError("Value must be 0 or more", 400);
    }
  }

  let expectedCloseDate = lead.bant?.timeline?.deadline || undefined;

  if (body.expectedCloseDate !== undefined) {
    expectedCloseDate = body.expectedCloseDate
      ? new Date(body.expectedCloseDate)
      : undefined;

    if (expectedCloseDate && Number.isNaN(expectedCloseDate.getTime())) {
      throw new ApiError("Invalid expected close date", 400);
    }
  }

  const riskLevel = body.riskLevel || undefined;

  if (riskLevel && !OPPORTUNITY_RISK_LEVELS.includes(riskLevel)) {
    throw new ApiError("Invalid risk level", 400);
  }

  const contactName = existingContact?.fullName || newContactFields.fullName;
  const accountName = crmCompany?.name || newCompanyFields?.name || contactName;

  // ====================================================
  // 5. SAVE
  //    One transaction: everything is saved, or nothing is.
  //    (Needs MongoDB running as a replica set.)
  // ====================================================

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ---------- Company ----------

    if (newCompanyFields) {
      const com_number = await generateCrmNumber(companyId, "company");

      const [newCompany] = await companyModel.create(
        [
          {
            name: newCompanyFields.name,
            ...(newCompanyFields.website
              ? { website: newCompanyFields.website }
              : {}),
            ...(newCompanyFields.phone
              ? { phone: newCompanyFields.phone }
              : {}),
            ...(newCompanyFields.email
              ? { email: newCompanyFields.email }
              : {}),
            ...(newCompanyFields.country
              ? { country: newCompanyFields.country }
              : {}),
            ownerId: newCompanyFields.ownerId,
            status: "prospect",
            companyId,
            deletedAt: null,
            number: com_number,
          },
        ],
        { session },
      );

      crmCompany = newCompany;
    }

    // ---------- Contact ----------

    let contact;

    if (existingContact) {
      contact = existingContact;

      // Contact without a company + a company was chosen / created → link them.
      if (crmCompany && !companyLocked) {
        contact.crmCompanyId = crmCompany._id;
        await contact.save({ session });
      }
    } else {
      const crmCompanyId = crmCompany?._id || null;

      const isPrimary = await resolveIsPrimary(companyId, crmCompanyId, false);

      const contact_number = await generateCrmNumber(companyId, "contact");

      const [newContact] = await contactModel.create(
        [
          {
            fullName: newContactFields.fullName,
            number: contact_number,
            ...(newContactFields.email
              ? { email: newContactFields.email }
              : {}),
            ...(newContactFields.phone
              ? { phone: newContactFields.phone }
              : {}),
            ...(newContactFields.jobTitle
              ? { jobTitle: newContactFields.jobTitle }
              : {}),
            companyId,
            isPrimary,
            crmCompanyId,
            assignedTo: newContactFields.assignedTo,
            source: newContactFields.source,
            status: "active",
          },
        ],
        { session },
      );

      contact = newContact;
    }

    // ---------- Opportunity ----------

    const opt_number = await generateCrmNumber(companyId, "opportunity");

    const [opportunity] = await opportunityModel.create(
      [
        {
          title: body.title?.trim() || `${accountName} Opportunity`,
          description: body.description ?? lead.notes,
          number: opt_number,
          value,
          currency: currency._id,
          pipelineId: pipeline._id,
          currentStageKey: firstStage.key,
          currentStageOrder: firstStage.order,
          probability: firstStage.probability,
          stageHistory: [
            {
              stageKey: firstStage.key,
              stageName: firstStage.name,
              enteredAt: new Date(),
            },
            {
              stageKey: firstStage.key,
              stageName: firstStage.name,
              enteredAt: new Date(),
              movedBy: req.user?._id || req.user?.userId || req.user?.id,
            },
          ],

          exitCriteriaStatus: createExitCriteriaStatus(firstStage),
          requiredActionsStatus: createRequiredActionsStatus(firstStage),

          // The company is not stored here: it is read from the contact.
          contactId: contact._id,
          ownerId: lead.ownerId,
          leadId: lead._id,
          interestedIn: lead.interestedIn || [],
          source: lead.source,
          riskLevel,
          expectedCloseDate,
          status: "open",
          tags: lead.tags || [],

          companyId,
        },
      ],
      { session },
    );

    // ---------- Lead ----------

    lead.status = "converted";

    lead.convertedTo = {
      contactId: contact._id,
      crmCompanyId: crmCompany?._id || null,
      opportunityId: opportunity._id,
      convertedAt: new Date(),
      convertedBy: req.user?._id || req.user?.userId || req.user?.id,
    };

    await lead.save({ session });

    await session.commitTransaction();

    // ====================================================
    // 6. Return result
    // ====================================================

    return {
      lead,
      contact,
      company: crmCompany,
      opportunity,
    };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
};
// QUALIFY LEAD
exports.qualifyLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  if (lead.status !== "contacted") {
    throw new ApiError("Only contacted leads can be qualified", 400);
  }

  const bantScore = exports.calculateBantScore(lead.bant || {});

  if (bantScore <= 6) {
    throw new ApiError(
      `Lead must have a BANT score greater than 6. Current score: ${bantScore}`,
      400,
    );
  }

  lead.bant.score = bantScore;
  lead.status = "qualified";

  await lead.save();
  return lead;
};
exports.markLeadAsLost = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;
  const { lostReason } = req.body;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  if (!["contacted", "qualified"].includes(lead.status)) {
    throw new ApiError(
      "Only contacted or qualified leads can be marked as lost",
      400,
    );
  }

  if (!lostReason?.trim()) {
    throw new ApiError("Lost reason is required", 400);
  }

  lead.status = "lost";
  lead.lostReason = lostReason.trim();

  await lead.save();

  return lead;
};

// ======================================================
// DELETE (SOFT)
// ======================================================

exports.deleteLead = async (req) => {
  const companyId = req.companyId;
  const { id } = req.params;

  const lead = await leadModel.findOne({
    _id: id,
    companyId,
    deletedAt: null,
  });

  if (!lead) {
    throw new ApiError(`No lead found with this ID: ${id}`, 404);
  }

  // Cannot delete a converted lead
  if (
    lead.convertedTo?.contactId ||
    lead.convertedTo?.crmCompanyId ||
    lead.convertedTo?.opportunityId
  ) {
    throw new ApiError(
      "Cannot delete lead because it is related to other entities",
      400,
    );
  }

  lead.deletedAt = new Date();

  await lead.save();

  return "Lead deleted successfully";
};
