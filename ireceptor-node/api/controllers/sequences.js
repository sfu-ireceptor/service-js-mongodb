'use strict';

var util = require('util');

// Server environment config
var mongoSettings = require('../../config/mongoSettings');

// Node Libraries
var Q = require('q');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var async = require('async');

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
    getSequenceSummary: getSequenceSummary,
    postSequenceSummary: postSequenceSummary,
    getSequenceData: getSequenceData,
    postSequenceData: postSequenceData
};

var male_gender = ["M", "m", "male", "Male"];
var female_gender = ["F", "f", "female", "Female"];

var escapeString = function(text) {
    return text.replace(/\*/g, '\\\*');
}

var constructQuery = function(req, res) {
    var query = {};

    // construct query
    req.swagger.operation.parameterObjects.forEach(function(parameter) {
	//console.log(parameter);

	var param_name = parameter.name;
	if (parameter.name == 'ir_username') {
	    if (req.swagger.params[parameter.name].value)
		console.log('iReceptor user: ' + req.swagger.params[parameter.name].value);
	    return;
	}
	if (parameter.name == 'ir_project_sample_id_list') param_name = 'filename_uuid';
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

	//console.log(parameter.name);
	//console.log(parameter.type);
	//console.log(req.swagger.params[parameter.name].value);
	if (req.swagger.params[parameter.name].value != undefined) {
	    // arrays perform $in
	    if (parameter.type == 'array') {
		query[param_name] = { "$in": req.swagger.params[parameter.name].value };
	    }

	    // string is $regex
	    if (parameter.type == 'string') {
		if (param_name == 'junction_aa')
		    query[param_name] = { "$regex": req.swagger.params[parameter.name].value };
		else
		    query[param_name] = { "$regex": '^' + escapeString(req.swagger.params[parameter.name].value) };
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

    return query;
}

// perform query, shared by GET and POST
var querySequenceSummary = function(req, res) {
    //console.log(req);
    //console.log(req.swagger.operation.parameterObjects);
    //console.log(req.swagger.params.ir_username.value);
    //console.log(req.swagger.params.ir_subject_age_min.value);

    var results = {summary: [], items: []};
    var counts = {};
    var query = constructQuery(req, res);
    console.log(query);

    MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to mongo");

	var v1db = db.db('v1public');
	var annCollection = v1db.collection('rearrangement');
	var sampleCollection = v1db.collection('sample');

	annCollection.aggregate([{"$match": query}, {"$group":{"count":{"$sum":1},"_id":"$filename_uuid"}}]).toArray()
	    .then(function(theCounts) {
		//console.log(theCounts);
		var uuids = [];
		for (var i = 0; i < theCounts.length; ++i) {
		    counts[theCounts[i]['_id']] = theCounts[i]['count'];
		    uuids.push(theCounts[i]['_id']);
		}
		//console.log(counts);
		//console.log(uuids);

		var sampleQuery = { vdjserver_filename_uuid: { $in: uuids } };
		return sampleCollection.find(sampleQuery).toArray();
	    })
	    .then(function(records) {
		//console.log(records.length);

		// push to results
		for (var i = 0; i < records.length; ++i) results.summary.push(records[i]);

		//console.log('final query');
		return annCollection.find(query).limit(100).toArray();
	    })
	    .then(function(records) {
		for (var i = 0; i < records.length; ++i) results.items.push(records[i]);
	    })
	    .then(function() {
		// data cleanup
		for (var i = 0; i < results.summary.length; ++i) {
		    var entry = results.summary[i];
		    entry['ir_sequence_count'] = counts[entry['vdjserver_filename_uuid']];
		    for (var p in entry) {
			if (!entry[p]) delete entry[p];
			else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
			else if (p == '_id') delete entry[p];
			else if (p == 'vdjserver_filename_uuid') entry['ir_project_sample_id'] = entry[p];
			else if (p == 'platform') entry['sequencing_platform'] = entry[p];
			else if (p == 'sex') {
			    if (male_gender.indexOf(entry[p]) >= 0) entry[p] = 'M';
			    else if (female_gender.indexOf(entry[p]) >= 0) entry[p] = 'F';
			}
		    }
		}
		
		for (var i = 0; i < results.items.length; ++i) {
		    var entry = results.items[i];
		    for (var p in entry) {
			if (!entry[p]) delete entry[p];
			else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
			else if (p == '_id') delete entry[p];
			else if (p == 'vdjserver_filename_uuid') entry['ir_project_sample_id'] = entry[p];
		    }
		}
	    })
	    .then(function() {
		//console.log('All done.');
		//console.log(counts);
		db.close();
		res.json(results);
	    });
    });
}

/*
	// 1. get distinct set of uuids for query
	// 2. get rearrangement count for each uuid
	// 3. get sample metadata
	// 4. get a few annotation records
	annCollection.distinct('filename_uuid', query)
	    .then(function(uuids) {
		//console.log(uuids);

		async.each(uuids, function(item, callback) {
		    //console.log(item);
		    var q = constructQuery(req, res);
		    q['filename_uuid'] = item;
		    //console.log(q);
		    annCollection.count(q, function(err, count) {
			if (err) callback();

			//console.log(count);
			counts[item] = count;
			callback();
		    });
		}, function(err){
		    //console.log('get sample metadata');
		    var sampleQuery = { vdjserver_filename_uuid: { $in: uuids } };
		    //console.log(sampleQuery);
		    sampleCollection.find(sampleQuery).toArray()
			.then(function(records) {
			    //console.log(records.length);

			    // push to results
			    for (var i = 0; i < records.length; ++i) results.summary.push(records[i]);

			    //console.log('final query');
			    return annCollection.find(query).limit(100).toArray();
			})
			.then(function(records) {
			    //console.log(counts);
			    //console.log('Retrieve ' + records.length + ' records.');

			    // push to results
			    for (var i = 0; i < records.length; ++i) results.items.push(records[i]);
			})
			.then(function() {
			    // data cleanup
			    for (var i = 0; i < results.summary.length; ++i) {
				var entry = results.summary[i];
				entry['ir_sequence_count'] = counts[entry['vdjserver_filename_uuid']];
				for (var p in entry) {
				    if (!entry[p]) delete entry[p];
				    else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
				    else if (p == '_id') delete entry[p];
				    else if (p == 'vdjserver_filename_uuid') entry['ir_project_sample_id'] = entry[p];
				    else if (p == 'platform') entry['sequencing_platform'] = entry[p];
				    else if (p == 'sex') {
					if (male_gender.indexOf(entry[p]) >= 0) entry[p] = 'M';
					else if (female_gender.indexOf(entry[p]) >= 0) entry[p] = 'F';
				    }
				}
			    }

			    for (var i = 0; i < results.items.length; ++i) {
				var entry = results.items[i];
				for (var p in entry) {
				    if (!entry[p]) delete entry[p];
				    else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
				    else if (p == '_id') delete entry[p];
				    else if (p == 'vdjserver_filename_uuid') entry['ir_project_sample_id'] = entry[p];
				}
			    }
			})
			.then(function() {
			    //console.log('All done.');
			    //console.log(counts);
			    db.close();
			    res.json(results);
			});
		});
	    });
    });
} */

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function getSequenceSummary(req, res) {
    console.log('getSequenceSummary');

    querySequenceSummary(req, res);
}

function postSequenceSummary(req, res) {
    console.log('postSequenceSummary');

    querySequenceSummary(req, res);
}

function getSequenceData(req, res) {
    console.log('getSequenceData');

    // this sends back a JSON response which is a single string
    var m = [];

  res.json(m);
}

function postSequenceData(req, res) {
    console.log('postSequenceData');

    // this sends back a JSON response which is a single string
    var m = [];

  res.json(m);
}
