const { Worker, redisConnection } = require('../config/bull');
const nodemailer = require('nodemailer');

const worker = new Worker(
  'emailQueue',
  async (job) => {
    console.log('Processing email job:', job.id, job.name, job.data);

    // Create transporter for Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.ALERT_EMAIL,
        pass: process.env.ALERT_EMAIL_PASSWORD,
      },
    });

    // Send email
    const info = await transporter.sendMail({
      from: `"Park Booking" <${process.env.ALERT_EMAIL}>`,
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
    });

    console.log(`Email sent to ${job.data.to}: ${info.messageId}`);
    return { success: true };
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => console.log(`Job ${job.id} completed`));
worker.on('failed', (job, err) => console.error(`Job ${job.id} failed:`, err));

console.log('📨 Email worker started');

module.exports = worker;
