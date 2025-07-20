const nodemailer = require("nodemailer");
const { template_collections } = require("./templates");
require("dotenv").config();
const prompt = require("prompt-sync")({ sigint: true });

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.PASSWORD,
  },
});

const availableChoices = ["soloFullStackDeveloper", "blogOwner", "companies", "ycStartups"];

const choice =
  availableChoices[
  parseInt(
    prompt(
      "Select your choice:\n 1. full stack developer\n 2. Blog owner\n 3. Small-medium Sized companies \n 4. YC backed startups"
    )
  ) - 1
  ];

const receiver_email = prompt("Enter the receiver's email: ");
const receiver_name = prompt("Enter the receiver's name: ");
const subject = prompt("Enter the subject for the email:");

function sendMail() {
  const template = template_collections[choice];
  const mailConfigurations = {
    // It should be a string of sender email
    from: process.env.EMAIL_USERNAME,

    // Comma Separated list of mails
    to: receiver_email,

    // Subject of Email
    subject: subject.length === 0 ? template.subject : subject,

    html: template.generateHTML(receiver_name),
  };
  console.log('Sending Email!!!')
  transporter.sendMail(mailConfigurations, function (error, info) {
    if (error) throw Error(error);
    console.log("Email Sent Successfully");
    console.log(info);
  });
}

sendMail();
