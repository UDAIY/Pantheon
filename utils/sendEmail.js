const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    try {
        let transporter;

        // If no real email credentials are provided in .env, use Ethereal test account
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('No valid email credentials found. Creating Ethereal test account...');
            const testAccount = await nodemailer.createTestAccount();

            transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
        } else {
            // Setup real email transporter (e.g., Gmail, SendGrid, etc.)
            transporter = nodemailer.createTransport({
                service: process.env.EMAIL_SERVICE || 'Gmail', // e.g. Gmail
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });
        }

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Noreply" <noreply@example.com>',
            to: options.email,
            subject: options.subject,
            text: options.message,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Message sent: %s', info.messageId);

        if (!process.env.EMAIL_USER) {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = sendEmail;
