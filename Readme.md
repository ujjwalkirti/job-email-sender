# Job Email Sender

Automate personalized job outreach emails with Node.js!  
This project helps you send customized emails to recruiters, companies, blog owners, and YC-backed startups using pre-defined templates and Gmail via Nodemailer.

## Features

- **Pre-built Email Templates:** Choose from multiple professional templates for different recipients.
- **Interactive CLI:** Enter recipient details and select the template interactively.
- **Gmail Integration:** Uses Nodemailer to send emails securely via Gmail.
- **Environment Variables:** Keep your credentials safe with `.env` support.

## Usage

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/job-email-sender.git
   cd job-email-sender
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure your environment:**
   - Copy `.env.example` to `.env` and fill in your Gmail credentials.

4. **Run the sender:**
   ```sh
   node send_mail.js
   ```
   - Follow the prompts to select a template and enter recipient details.

## Templates

See [`templates.js`](templates.js) for all available email templates.

## License

ISC

---

> ⭐ Star this repo if you find it useful!  
> [View the code](https://github.com/yourusername/job-email-sender)