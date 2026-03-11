const sendEmail = require('./utils/sendEmail');

sendEmail({
    email: 'test@example.com',
    subject: 'Test Email',
    message: 'Testing email functionality'
})
    .then(() => {
        console.log('Email sent successfully');
        process.exit(0);
    })
    .catch(err => {
        console.error('Email sending failed with error:', err);
        process.exit(1);
    });
