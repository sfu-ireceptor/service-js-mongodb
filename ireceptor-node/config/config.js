'use strict';

var path = require('path');
var fs = require('fs');

var config = {};

module.exports = config;

// General
config.port = process.env.API_PORT;

// API customization
config.custom_file = process.env.CUSTOM_FILE;

// Error/debug reporting
config.debug = process.env.DEBUG_CONSOLE;
config.slackURL = process.env.SLACK_WEBHOOK_URL;

// get info
var infoFile = path.resolve(__dirname, '../package.json');
var infoString = fs.readFileSync(infoFile, 'utf8');
config.info = JSON.parse(infoString);
