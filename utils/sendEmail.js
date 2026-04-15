const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (options) => {
  try {
    const msg = {
      to: options.email,
      from: "Jadwa Invest <abd.alrhman@smartinb.com>",
      subject: options.subject,
      text: options.message,
    };

    await sgMail.send(msg);
    console.log("Email sent 🐘");
  } catch (err) {
    console.error("Email fail 💀", err);
  }
};

module.exports = sendEmail;
