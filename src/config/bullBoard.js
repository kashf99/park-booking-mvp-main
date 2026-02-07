// src/config/bullBoard.js
const { ExpressAdapter } = require('@bull-board/express');
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const emailQueue = require('../queues/emailQueue');

// Create server adapter
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

// Create Bull Board instance
createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

module.exports = serverAdapter;
