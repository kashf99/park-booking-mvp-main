const { Queue } = require('../config/bull');

const emailQueue = new Queue('emailQueue', {
  connection: require('../config/bull').redisConnection,
});

module.exports = emailQueue;
