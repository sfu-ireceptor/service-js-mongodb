'use strict';

var config = {};

module.exports = config;

// General
config.port = process.env.API_PORT;

// Error/debug reporting
config.debug = process.env.DEBUG_CONSOLE;
config.slackURL = process.env.SLACK_WEBHOOK_URL
