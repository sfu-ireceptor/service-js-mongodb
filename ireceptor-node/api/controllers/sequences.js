'use strict';

var util = require('util');

// Server environment config
var config = require('../../config/config');
var mongoSettings = require('../../config/mongoSettings');

// Node Libraries
var Q = require('q');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var async = require('async');
var yaml = require('js-yaml');
var path = require('path');
var fs = require('fs');

var url = 'mongodb://'
    + mongoSettings.username + ':' + mongoSettings.userSecret + '@'
    + mongoSettings.hostname + ':27017/admin';

// API customization
var custom_file = undefined;
if (config.custom_file) {
    custom_file = require('../../config/' + config.custom_file);
}

// AIRR config
var airrConfig = {
  appRoot: __dirname, // required config
  configDir: 'config'
};

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

var escapeString = function(text) {
    var encoded = text.replace(/\*/g, '\\\*');
    encoded = encoded.replace(/\+/g, '\\\+');
    return encoded;
}

var constructQuery = function(req, res) {
    var query = {};

    // construct query
    req.swagger.operation.parameterObjects.forEach(function(parameter) {
	//console.log(parameter);

	var param_name = parameter.name;

	if (custom_file) {
	    var custom_param_name = custom_file.parameterNameForQuerySequences(parameter, req, res);
	    if (custom_param_name) {
		param_name = custom_param_name;
	    }
	}

	// custom handling of parameter value, default handling will be skipped
	if (custom_file) {
	    var custom_param_value = custom_file.parameterValueForQuerySequences(parameter, req, res);
	    if (custom_param_value) {
		query[param_name] = custom_param_value;
		return;
	    }
	    // no value but skip default processing
	    if (custom_param_value === null) return;
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

	var v1db = db.db(mongoSettings.dbname);
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

		    if (custom_file) custom_file.countsForQuerySequencesSummary(counts, entry, req, res);

		    for (var p in entry) {
			if (!entry[p]) delete entry[p];
			else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
			else if (p == '_id') delete entry[p];
			else if (custom_file) custom_file.dataCleanForQuerySequencesSummary(p, entry, req, res);
		    }
		}
		
		for (var i = 0; i < results.items.length; ++i) {
		    var entry = results.items[i];
		    for (var p in entry) {
			if (!entry[p]) delete entry[p];
			else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
			else if (p == '_id') delete entry[p];
			else if (custom_file) custom_file.dataCleanForQuerySequences(p, entry, req, res);
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

// perform query, shared by GET and POST
var querySequenceData = function(req, res) {
    //console.log(req);
    //console.log(req.swagger.operation.parameterObjects);
    //console.log(req.swagger.params.ir_username.value);
    //console.log(req.swagger.params.ir_subject_age_min.value);

    // currently only support JSON and AIRR format
    var format = req.swagger.params['ir_data_format'].value;
    if ((format != 'json') && (format != 'airr')) {
	res.status(400).end();
	return;
    }

    var query = constructQuery(req, res);
    console.log(query);
    
    var headers = [];
    if (format == 'json') {
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Content-Disposition', 'attachment;filename="data.json"');
    } else if (format == 'airr') {
	res.setHeader('Content-Type', 'text/tsv');
	res.setHeader('Content-Disposition', 'attachment;filename="data.tsv"');

	// Load AIRR spec for field names
	var airrFile = path.resolve(airrConfig.appRoot, '../../config/airr-definitions.yaml');
	//console.log(airrFile);
	var doc = yaml.safeLoad(fs.readFileSync(airrFile));
	if (!doc) {
	    console.error('Could not load AIRR definitions yaml file.');
	    res.status(500).end();
	    return;
	}

	var schema = doc['Rearrangement'];
	if (!schema) {
	    console.error('Rearrangement schema missing.');
	    res.status(500).end();
	    return;
	}
	for (var p in schema['properties']) headers.push(p);

	if (custom_file) {
	    var custom_headers = custom_file.headersForQuerySequencesData(req, res);
	    if (custom_headers) {
		headers = headers.concat(custom_headers);
	    }
	}

	res.write(headers.join('\t'));
	res.write('\n');
	//console.log(headers);
    }
    
    MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to mongo");

	var v1db = db.db(mongoSettings.dbname);
	var annCollection = v1db.collection('rearrangement');

	var first = true;
	if (format == 'json') res.write('[');
	annCollection.find(query).forEach(function(entry) {
	    // data cleanup
	    var record = '';
	    for (var p in entry) {
		if (!entry[p]) delete entry[p];
		else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
		else if (p == '_id') delete entry[p];
	    	else if (custom_file) custom_file.dataCleanForQuerySequencesData(p, entry, req, res);
	    }

	    if (!first) {
		if (format == 'json') res.write(',\n');
		if (format == 'airr') res.write('\n');
	    }  else {
		first = false;
	    }

	    if (format == 'json') res.write(JSON.stringify(entry));
	    if (format == 'airr') {
		var vals = [];
		for (var i = 0; i < headers.length; ++i) {
		    var p = headers[i];
		    if (!entry[p]) vals.push('');
		    else vals.push(entry[p]);
		}
		res.write(vals.join('\t'));
	    }
	}, function(err) {
	    db.close();
	    if (format == 'json') res.write(']\n');
	    if (format == 'airr') res.write('\n');
	    res.end();
	});
    });
}

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

    querySequenceData(req, res);
}

function postSequenceData(req, res) {
    console.log('postSequenceData');

    querySequenceData(req, res);
}
