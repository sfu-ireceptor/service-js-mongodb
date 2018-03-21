'use strict';

var util = require('util');

// Server environment config
var config = require('../../config/config');

/*
 Once you 'require' a module you can reference the things that it exports.  These are defined in module.exports.

 For a controller in a127 (which this is) you should export the functions referenced in your Swagger document by name.

 Either:
  - The HTTP Verb of the corresponding operation (get, put, post, delete, etc)
  - Or the operationId associated with the operation in your Swagger document
 */
module.exports = {
    getStatus: getStatus,
    getInfo: getInfo
};

function getStatus(req, res) {
    //console.log('getStatus');
    res.json({"result":"success"});
}

function getInfo(req, res) {
    //console.log('getStatus');
    res.json({ name: config.info.name, description: config.info.description, version: config.info.version, customization: config.custom_file});
}
