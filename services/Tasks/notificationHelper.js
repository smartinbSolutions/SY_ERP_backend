const mongoose = require("mongoose");
const subTaskModel = require("../../models/Tasks/SubTaskModel");
const Task = require("../../models/Tasks/TaskModel");
const ListModel = require("../../models/Tasks/ListModel");
const staffModel = require("../../models/Hr/staffModel");
const NotificationModel = require("../../models/Hr/NotificationModel");

exports.getRecipients = (entity, actorId, level) => {
  const actor = String(actorId);

  const getMembers = (members = []) =>
    members
      .filter(
        (m) => m?.user && m.notificationsEnabled && String(m.user) !== actor,
      )
      .map((m) => String(m.user));

  const uniq = (arr) => [...new Set(arr)];

  let recipients = [];

  switch (level) {
    case "task":
      recipients = [
        ...getMembers(entity?.list?.members),
        ...getMembers(entity?.list?.folder?.members),
        ...getMembers(entity?.list?.workspace?.members),
      ];
      break;

    case "list":
      recipients = [
        ...getMembers(entity?.folder?.members),
        ...getMembers(entity?.workspace?.members),
      ];
      break;

    case "folder":
      recipients = [...getMembers(entity?.workspace?.members)];
      break;

    case "workspace":
      recipients = [...getMembers(entity?.members)];
      break;
  }

  return uniq(recipients);
};
