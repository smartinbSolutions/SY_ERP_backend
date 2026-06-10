const { Resend } = require("resend");

const sendEmail = async (options) => {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: "SmartERP <no-reply@smartinb.com>",
      to: options.email,
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.message,
    });

    if (error) {
      console.error("Error sending email:", error);
      return;
    }

    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = sendEmail;
