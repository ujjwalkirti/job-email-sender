const readlineSync = require('readline-sync');
const clipboardy = require('clipboardy');

// Get recipient name
console.log('Enter recipient\'s name: ');
const recipientName = readlineSync.question('').trim();

// Get recipient designation
console.log('Enter recipient\'s designation: ');
const designation = readlineSync.question('').trim();

// Get company name
console.log('Enter company name: ');
const companyName = readlineSync.question('').trim();

// Get job id
console.log('Enter job id: ');
const jobId = readlineSync.question('').trim();

// Get your name
console.log('Enter your name: ');
const yourName = readlineSync.question('').trim();

// Get resume link (with default)
console.log('Enter your resume link (press Enter to use default): ');
let resumeLink = readlineSync.question('').trim();
if (resumeLink === '') {
    resumeLink = 'https://drive.google.com/file/d/1LoF14oDU1YKTzCFeobmq8aEEpWR1YwaI/view?usp=sharing';
}

// Produce output text using template
const message = `Subject: Referral Request for Job ID: ${jobId}

Hi ${recipientName},

I hope this message finds you well.

I saw that you are a ${designation} at ${companyName} and wanted to reach out regarding the opening for Job ID: ${jobId}. Based on my two years of experience as a full-stack developer, I am confident my skills align well with the position and that I could be a valuable contributor at **${companyName}**.

Would you be open to reviewing my resume and considering me for a referral?

My resume is available for your convenience here: ${resumeLink}

Thank you for your time and consideration.

Best regards,
${yourName}`;

// Add it to clipboard
let copied = false;
try {
    clipboardy.writeSync(message);
    console.log('\nReferral message generated and copied to clipboard:\n');
    copied = true;
} catch (error) {
    console.log('\nReferral message generated (could not copy to clipboard):\n');
}

console.log(message);
