'use strict';

var util = require('util');

// Server environment config
var mongoSettings = require('../../config/mongoSettings');

var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

var url = 'mongodb://'
    + mongoSettings.username + ':' + mongoSettings.userSecret + '@'
    + mongoSettings.hostname + ':27017/admin';

/*
 Once you 'require' a module you can reference the things that it exports.  These are defined in module.exports.

 For a controller in a127 (which this is) you should export the functions referenced in your Swagger document by name.

 Either:
  - The HTTP Verb of the corresponding operation (get, put, post, delete, etc)
  - Or the operationId associated with the operation in your Swagger document
 */
module.exports = {
    getSamples: getSamples,
    postSamples: postSamples
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function postSamples(req, res) {
    console.log('postSamples');
    console.log(url);

    // TODO: implement query
    var results = [];

    MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to mongo");

	var v1db = db.db('v1public');
	var sampleCollection = v1db.collection('sample');

	sampleCollection.find().toArray()
	    .then(function(records) {
		//console.log(records);
		//console.log(records.length);

		// start with nucleicAcidProcessing records
		for (var i = 0; i < records.length; ++i) results.push(records[i]);
	    })
	    .then(function() {
		//console.log(results);
		// any data cleanup
		for (var i = 0; i < results.length; ++i) {
		    for (var p in results[i]) {
			if (!results[i][p]) delete results[i][p];
			else if ((typeof results[i][p] == 'string') && (results[i][p].length == 0)) delete results[i][p];
			else if (p == '_id') delete results[i][p];
		    }
		}
	    })
	    .then(function() {
		db.close();
		res.json(results);
	    });
		
    });
}

function getSamples(req, res) {
    console.log('getSamples');

    var m = [];
    
    res.json(m);
}
