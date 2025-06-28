const nodemailer = require("nodemailer");

require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.PASSWORD,
    },
});

const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: "usuallyhighandup@gmail.com",
    subject: "OAuth2 Test",
    html: "<p>This is a test email sent using OAuth2.</p>",
};

transporter.sendMail(mailOptions, (err, info) => {
    if (err) return console.error("Error:", err);
    console.log("Email sent:", info.response);
});
