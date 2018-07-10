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

var queryNumber = 0;

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

    // HACK: when a client HTTP request is aborted, any running
    // mongo query is not automatically aborted, so we need to
    // trap that condition and manually abort the query.
    // Unfortunately, there seems to be no way to match a client query
    // with the operations running in mongo. The hack is to give each
    // client query a unique identifier, then pass it to mongo as the
    // client appname, which can then be accessed when getting the
    // list of running mongo operations.
    queryNumber += 1;
    var queryIdentifier = "sequence" + queryNumber;
    console.log(queryIdentifier);

    // if there no additional filters then can use the precalculated counts
    var quickCount = false;
    if ((Object.keys(query).length == 1) && query['filename_uuid']) {
	quickCount = true;
    }

    MongoClient.connect(url, {appname: queryIdentifier}, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to mongo");
	//console.log(db.s.topology);

	var v1db = db.db(mongoSettings.dbname);
	var annCollection = v1db.collection('rearrangement');
	var sampleCollection = v1db.collection('sample');
	var queryCollection = v1db.collection('query');
	//console.log(v1db.s.topology);

	// Handle client HTTP request abort
	req.on("close", function() {
	    // request closed unexpectedly
	    console.log('Client request closed unexpectedly', queryIdentifier);
	    db.command({"currentOp" : 1, "$ownOps": true}, function(err, data) {
		//console.log(JSON.stringify(db.s));
		//console.log(JSON.stringify(v1db));
		console.log('currentOp',err,data);
		for (var i = 0; i < data.inprog.length; ++i) {
		    if (data.inprog[i].ns == 'admin.$cmd') continue;
		    var clientMetadata = data.inprog[i].clientMetadata;
		    if (clientMetadata) {
			console.log(clientMetadata.application.name);
			if (clientMetadata.application.name == queryIdentifier) {
			    console.log("found it", queryIdentifier);
			    db.command({"killOp" : 1, "op": data.inprog[i].opid}, function(err, data) {
				console.log('killOp',err,data);
				db.close();
				res.end();
			    });
			}
		    }
		}
	    });

	    return;
	});

	// 1. get distinct set of uuids for query
	// 2. get rearrangement count for each uuid
	// 3. get sample metadata
	// 4. get a few annotation records
	queryCollection.insertOne({'endpoint':'sequences_summary', 'query': query})
	    .then(function(result) {
		console.log('query saved:', result);
		return annCollection.distinct('filename_uuid', query);
	    })
	    .then(function(uuids) {
		//console.log(uuids);

		async.eachSeries(uuids, function(item, callback) {
		    //console.log(item);
		    var q = constructQuery(req, res);
		    q['filename_uuid'] = item;
		    //console.log(q);
		    if (quickCount) {
			callback();
		    } else {
			annCollection.count(q, function(err, count) {
			    if (err) return callback(err);

			    //console.log(count);
			    counts[item] = count;
			    callback();
			});
		    }
		}, function(err) {
		    //console.log('get sample metadata');
		    var sampleQuery = { vdjserver_filename_uuid: { $in: uuids } };
		    //console.log(sampleQuery);
		    sampleCollection.find(sampleQuery).toArray()
			.then(function(records) {
			    //console.log(records.length);

			    // push to results
			    for (var i = 0; i < records.length; ++i) {
				results.summary.push(records[i]);
				if (quickCount) {
				    counts[records[i]['vdjserver_filename_uuid']] = records[i]['sequence_count'];
				}
			    }

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

    // Handle client HTTP request abort
    var abortQuery = false;
    req.on("close", function() {
	console.log('Client request closed unexpectedly');
	abortQuery = true;
    });

    MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to mongo");

	var v1db = db.db(mongoSettings.dbname);
	var annCollection = v1db.collection('rearrangement');

	var first = true;
	if (format == 'json') res.write('[');
	var cursor = annCollection.find(query);
	cursor.forEach(function(entry) {
	    if (abortQuery) {
		console.log('aborting query');
		cursor.close(function(err, result) {
		    // db will be closed by callback
		});
	    } else {
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
