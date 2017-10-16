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

var extractRecords = function(records, uuid_name) {
    var objIDs = [];
    var objDict = {};
    for (var i = 0; i < records.length; ++i) {
	if (objIDs.indexOf(records[i][uuid_name]) < 0)
	    objIDs.push(records[i][uuid_name]);

	objDict[records[i]['vdjserver_uuid']] = records[i];
    }

    return [ objIDs, objDict ];
}

var flattenRecords = function(records, objDict, uuid_name) {
    for (var i = 0; i < records.length; ++i) {
	delete records[i]['_id'];
	var cp = objDict[records[i][uuid_name]];
	for (var p in cp) {
	    if (p == '_id') continue;
	    if (p == 'vdjserver_uuid') continue;
	    if (p == 'filename_uuid') {
		// do not overwrite an existing file uuid
		if (!records[i][p] || records[i][p].length == 0) records[i][p] = cp[p];
		continue;
	    }
	    records[i][p] = cp[p];
	}
    }
}

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
	console.log("Connected successfully to server");

	var v1db = db.db('v1public');
	var napCollection = v1db.collection('nucleicAcidProcessing');
	var cpCollection = v1db.collection('cellProcessing');
	var sampleCollection = v1db.collection('sample');
	var subjectCollection = v1db.collection('subject');
	var studyCollection = v1db.collection('study');

	napCollection.find().toArray()
	    .then(function(records) {
		//console.log(napRecords);
		//console.log(napRecords.length);

		// start with nucleicAcidProcessing records
		for (var i = 0; i < records.length; ++i) results.push(records[i]);
		var objs = extractRecords(records, 'cell_processing_uuid');

		// query associated cellProcessing records
		var query = { vdjserver_uuid: { $in: objs[0] } };
		return cpCollection.find(query).toArray();
	    })
	    .then(function(records) {
		//console.log(records);

		// extract and flatten
		var objs = extractRecords(records, 'sample_uuid');
		flattenRecords(results, objs[1], 'cell_processing_uuid');

		// query associated sample records
		var query = { vdjserver_uuid: { $in: objs[0] } };
		return sampleCollection.find(query).toArray();
	    })
	    .then(function(records) {
		//console.log(records);

		// extract and flatten
		var objs = extractRecords(records, 'subject_uuid');
		flattenRecords(results, objs[1], 'sample_uuid');	

		// query associated subject records
		var query = { vdjserver_uuid: { $in: objs[0] } };
		return subjectCollection.find(query).toArray();
	    })
	    .then(function(records) {
		//console.log(records);

	    	// extract and flatten
		var objs = extractRecords(records, 'study_uuid');
		flattenRecords(results, objs[1], 'subject_uuid');	

		// query associated study records
		var query = { vdjserver_uuid: { $in: objs[0] } };
		return studyCollection.find(query).toArray();
	    })
	    .then(function(records) {
		//console.log(records);

	    	// extract and flatten
		var objs = extractRecords(records, 'vdjserver_uuid');
		flattenRecords(results, objs[1], 'study_uuid');	
	    })
	    .then(function() {
		// clean up data types
		for (var i = 0; i < results.length; ++i) {
		    for (var p in results[i]) {
			if (!results[i][p]) delete results[i][p];
			else if ((typeof results[i][p] == 'string') && (results[i][p].length == 0)) delete results[i][p];
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
