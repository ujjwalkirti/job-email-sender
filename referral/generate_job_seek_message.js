import readlineSync from 'readline-sync';
import clipboardy from 'clipboardy';

// Get recipient name
console.log('Enter recipient\'s name: ');
const recipientName = readlineSync.question('').trim();

// Get recipient designation
console.log('Enter recipient\'s designation: ');
const designation = readlineSync.question('').trim();

// Get company name
console.log('Enter company name: ');
const companyName = readlineSync.question('').trim();

// Get your name
console.log('Enter your name: ');
const yourName = readlineSync.question('').trim();

// Get resume link (with default)
console.log('Enter your resume link (press Enter to use default): ');
let resumeLink = readlineSync.question('').trim();
if (resumeLink === '') {
    resumeLink = 'https://drive.google.com/file/d/1sH8CF-n6ThG4PnGYQsDmzFXa7kP9D4Si/view?usp=drive_link';
}

// Produce output text using template
const message = `Hi ${recipientName},

I hope you are doing well.

I wanted to check if there are any open positions in your team where someone with my experience could be a good fit. I have around three years of experience as a full stack developer and I am keen to contribute and grow.

If you have some time, I would really appreciate it if you could take a quick look at my resume. Also, if possible, we could connect for a short call at your convenience so I can understand more about the work your team is doing.

Here is my resume:
${resumeLink}

Thank you for your time.

Best regards,
${yourName}`;

// Add it to clipboard
let copied = false;
try {
    clipboardy.writeSync(message);
    console.log('\nMessage generated and copied to clipboard:\n');
    copied = true;
} catch (error) {
    console.log('\nMessage generated (could not copy to clipboard):\n');
}

console.log(message);
