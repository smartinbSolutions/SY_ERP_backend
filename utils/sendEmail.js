const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
  const msg = {
    to: options.email,
    from: "SmartERP <no-reply@smartinb.com>",
    subject: options.subject,
    text: options.message,
  };

  await sgMail.send(msg);
  console.log("Email sent 🐘");
};

module.exports = sendEmail;
