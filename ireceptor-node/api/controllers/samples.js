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

var male_gender = ["M", "m", "male", "Male"];
var female_gender = ["F", "f", "female", "Female"];

// perform query, shared by GET and POST
var querySamples = function(req, res) {
    //console.log(url);
    //console.log(req.swagger.operation.parameterObjects);
    //console.log(req.swagger.params.ir_username.value);
    //console.log(req.swagger.params.ir_subject_age_min.value);
    //console.log(req);

    var results = [];
    var query = {};

    // construct query
    req.swagger.operation.parameterObjects.forEach(function(parameter) {
	//console.log(parameter.name);
	//console.log(parameter.type);
	//console.log(req.swagger.params[parameter.name].value);

	var param_name = parameter.name;
	if (parameter.name == 'ir_username') {
	    if (req.swagger.params[parameter.name].value)
		console.log('iReceptor user: ' + req.swagger.params[parameter.name].value);
	    return;
	}
	// exception: age interval
	if (parameter.name == 'ir_subject_age_min') {
	    if (req.swagger.params[parameter.name].value != undefined) {
		query[param_name] = { "$gte" : req.swagger.params[parameter.name].value };
	    }
	    return;
	}
	if (parameter.name == 'ir_subject_age_max') {
	    if (req.swagger.params[parameter.name].value != undefined) {
		query[param_name] = { "$lte" : req.swagger.params[parameter.name].value };
	    }
	    return;
	}
	if (parameter.name == 'sequencing_platform') param_name = 'platform';

	if (parameter.name == 'sex') {
	    var value = req.swagger.params[parameter.name].value;
	    if (value != undefined) {
		if (value == 'M') {
		    query[parameter.name] = { "$in": male_gender };
		} else if (value == 'F') {
		    query[parameter.name] = { "$in": female_gender };
		}
	    }
	    return;
	}

	if (req.swagger.params[parameter.name].value != undefined) {
	    // arrays perform $in
	    if (parameter.type == 'array') {
		query[param_name] = { "$in": req.swagger.params[parameter.name].value };
	    }

	    // string is $regex
	    if (parameter.type == 'string') {
		query[param_name] = { "$regex": req.swagger.params[parameter.name].value };
	    }

	    // integer is exact match
	    if (parameter.type == 'integer') {
		query[param_name] = req.swagger.params[parameter.name].value;
	    }

	    // number is exact match
	    if (parameter.type == 'number') {
		query[param_name] = req.swagger.params[parameter.name].value;
	    }

	    // boolean is exact match
	    if (parameter.type == 'boolean') {
		query[param_name] = req.swagger.params[parameter.name].value;
	    }
	}
    });
    console.log(query);
    
    MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to mongo");

	var v1db = db.db(mongoSettings.dbname);
	var sampleCollection = v1db.collection('sample');

	sampleCollection.find(query).toArray()
	    .then(function(records) {
		//console.log(records);
		console.log('Retrieve ' + records.length + ' records.');

		// push to results
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
			
			// VDJServer specific... don't need?
			else if (p == 'vdjserver_filename_uuid') results[i]['ir_project_sample_id'] = results[i][p];
			
			else if (p == 'sequence_count') results[i]['ir_sequence_count'] = results[i][p];
			else if (p == 'platform') results[i]['sequencing_platform'] = results[i][p];
			else if (p == 'sex') {
			    if (male_gender.indexOf(results[i][p]) >= 0) results[i][p] = 'M';
			    else if (female_gender.indexOf(results[i][p]) >= 0) results[i][p] = 'F';
			}
		    }
		}
	    })
	    .then(function() {
		db.close();
		res.json(results);
	    });
		
    });
}

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function postSamples(req, res) {
    console.log('postSamples');

    querySamples(req, res);
}

function getSamples(req, res) {
    console.log('getSamples');

    querySamples(req, res);
}
