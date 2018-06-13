/*jslint
    node
*/
"use strict";

// Server environment config
var mongoSettings = require("../../config/mongoSettings");

// Node Libraries
//Once you 'require' a module you can reference the things that it exports.  These are defined in module.exports.
var Q = require('q');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var async = require('async');
var yaml = require('js-yaml');
var path = require('path');
var fs = require('fs');

var url = 'mongodb://'
    + mongoSettings.username + ':' + mongoSettings.usersecret + '@'
    + mongoSettings.hostname + ':27017/admin';

// AIRR config
var airrConfig = {
  appRoot: __dirname, // required config
  configDir: 'config'
};

// VDJServer-specific - deprecated?
//var male_gender = ["M", "m", "male", "Male"];
//var female_gender = ["F", "f", "female", "Female"];

var escapeString = function (text) {
    var encoded = text.replace(/\*/g, "\\*");
    encoded = encoded.replace(/\+/g, "\\+");
    return encoded;
};

var constructQuery = function (req) {
    var query = {};

    // construct query
    req.swagger.operation.parameterObjects.forEach(function (parameter) {

        var param_name = parameter.name;
        var value = req.swagger.params[parameter.name].value;

        console.log("0. Sequence Parameter Name: '" + parameter.name + "', Value: '" + value + "'");

        /*
         * We may eventually wish to decide what kind of
         * access control that the turnkey should have...
         */

        if (parameter.name === "ir_username") {
            if (value) {
                console.log("iReceptor user: " + value);
                return;
            }
        }

        if (parameter.name === "ir_project_sample_id_list") {
            if (value) {

                console.log("ir_project_sample_id_list value: " + value);

                //if (!(Number.isInteger(value) || value.includes(","))) {
                //    return; // ignore non-integer strings that don't look like a list
                //}

                var id_list_string = "[" + value + "]";
                var id_array = JSON.parse(id_list_string);
                var sample_ids = [];
                id_array.forEach(function (s) {
                    sample_ids.push(parseInt(s));
                });
                query.ir_project_sample_id = {"$in": sample_ids};
            }
            return;
        }

        /*
         * The following seem to be VDJServer specific
         * transformations or censorship of iReceptor
         * parameters. We disable these for now.
         *
        if (parameter.name === "sequencing_platform") {
            param_name = "platform";
        }
        if (parameter.name === "junction_length") {
            param_name = "junction_nt_length";
        }
        if (parameter.name === "ir_data_format") {
            return;
        }

        // This may also be VDJserver specific??
        if (parameter.name === "sex") {
            if (value !== undefined) {
                if (value === "M") {
                    query[parameter.name] = {"$in": male_gender};
                } else if (value === "F") {
                    query[parameter.name] = {"$in": female_gender};
                }
            }
            return;
        }
         */

        /*
         * The Swagger boolean filter for "functional" sequences
         * needs to be translated into a useful iReceptor query
         */
        if (parameter.name === "functional") {
            if (value && parameter.type === "boolean") {
                query[parameter.name] = "productive";
            } // else, ignore?
            return;
        }

        //console.log(parameter.name);
        //console.log(parameter.type);
        //console.log(req.swagger.params[parameter.name].value);
        if (value !== undefined) {
            // arrays perform $in
            if (parameter.type === "array") {
                query[param_name] = {"$in": value};
            }

            // string is $regex
            if (parameter.type === "string") {
                if (param_name === "junction_aa") {
                    query[param_name] = {"$regex": value};
                } else {
                    query[param_name] = {"$regex": "^" + escapeString(value)};
                }
            }

            // integer is exact match
            if (parameter.type === "integer") {
                query[param_name] = value;
            }

            // number is exact match
            if (parameter.type === "number") {
                query[param_name] = value;
            }

            // boolean is exact match
            if (parameter.type === "boolean") {
                query[param_name] = value;
            }
        }
    });

    return query;
};

// perform query, shared by GET and POST
var querySequenceSummary = function (req, res) {

    //console.log(req);
    //console.log(req.swagger.operation.parameterObjects);
    //console.log(req.swagger.params.ir_username.value);
    //console.log(req.swagger.params.ir_subject_age_min.value);

    var results = {summary: [], items: []};
    var counts = {};
    var query = constructQuery(req);

    console.log("1. Query: " + JSON.stringify(query));

    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        //console.log("2. Connected successfully to mongo");

        var irdb = db.db(mongoSettings.dbname);
        var annCollection = irdb.collection("sequence"); // Scott calls this the "rearrangement" collection
        var sampleCollection = irdb.collection("sample");

        annCollection.aggregate([{"$match": query}, {"$group": {"_id": "$ir_project_sample_id", "count": {"$sum": 1}}}]).toArray()
            .then(function (theCounts) {

                //console.log("3." + JSON.stringify(theCounts));

                var sample_ids = [];
                theCounts.forEach(function (c) {
                    counts[c._id] = c.count;
                    sample_ids.push(c._id);
                });

                //console.log("4." + JSON.stringify(counts));
                //console.log("5." + sample_ids);

                var sampleQuery = {_id: {$in: sample_ids}};

                return sampleCollection.find(sampleQuery).toArray();
            })
            .then(function (records) {

                //console.log("6." + records.length);

                // push to results
                records.forEach(function (r) {
                    results.summary.push(r);
                });

                //console.log("7. final query");
                return annCollection.find(query).limit(100).toArray();
            })
            .then(function (records) {
                records.forEach(function (r) {
                    results.items.push(r);
                });
            })
            .then(function () {
                // data cleanup
                results.summary.forEach(function (entry) {

                    entry.ir_filtered_sequence_count = counts[entry._id];

                    Object.keys(entry).forEach(function (p) {
                        if (!entry[p]) {
                            delete entry[p];
                        } else if ((typeof entry[p] === "string") && (entry[p].length === 0)) {
                            delete entry[p];
                        /*
                         * VDJServer Specific Tags - deprecated in the iReceptor Turnkey?
                         *
                        } else if (p === "platform") {
                            entry.sequencing_platform = entry[p];
                        } else if (p === "sequence_count") {
                            entry.ir_sequence_count = entry[p];
                        } else if (p === "sex") {
                            if (male_gender.indexOf(entry[p]) >= 0) {
                                entry[p] = "M";
                            } else if (female_gender.indexOf(entry[p]) >= 0) {
                                entry[p] = "F";
                            }
                        */
                        }
                    });
                });

                results.items.forEach(function (entry) {

                    // data cleanup - some of this may be legacy
                    // VDJServer-specific hence, not applicable for the turnkey?
                    Object.keys(entry).forEach(function (p) {
                        if (!entry[p]) {
                            delete entry[p];
                        } else if ((typeof entry[p] === "string") && (entry[p].length === 0)) {
                            delete entry[p];
                        } else if (p === "v_call" || p === "d_call" || p === "j_call") {
                            if (Array.isArray(entry[p])) {
                                entry[p] = entry[p].toString();
                            }
                        }
                        /*
                         * VDJServer Specific Tag - deprecated in the iReceptor Turnkey?
                         *
                         *
                        else if (p === "junction_nt_length") {
                            entry.junction_length = entry[p];
                        }
                        */
                    });
                });
            })
            .then(function () {
                //console.log("All done.");
                //console.log(counts);
                db.close();
                res.json(results);
            })
            .catch(function (e) {
                console.log("querySequenceSummary() error: " + e);
            });
    });
};

// perform query, shared by GET and POST
var querySequenceData = function (req, res) {
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
    //console.log(query);

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

            // iReceptor specific
            headers.push('ir_project_sample_id');

            // VDJServer specific
            //headers.push('vdjserver_filename_uuid');

            res.write(headers.join('\t'));
            res.write('\n');
           //console.log(headers);
        }

        MongoClient.connect(url, function(err, db) {
            assert.equal(null, err);
            //console.log("Connected successfully to mongo");

            var irdb = db.db(mongoSettings.dbname);
            var annCollection = irdb.collection("sequence"); // Scott calls these the "rearrangement" collection

            var first = true;
            if (format == 'json') res.write('[');
            annCollection.find(query).forEach(function(entry) {
                // data cleanup
                var record = '';
                Object.keys(entry).forEach(function (p) {
                    if (!entry[p]) delete entry[p];
                    else if ((typeof entry[p] == 'string') && (entry[p].length == 0)) delete entry[p];
                    else if (p == '_id') delete entry[p];
                    else if (p == 'filename_uuid') {
                        entry['ir_project_sample_id'] = entry[p];
                        //entry['vdjserver_filename_uuid'] = entry[p];
                        entry['rearrangement_set_id'] = entry[p];
                    } else if (p == 'junction_nt_length') entry['junction_length'] = entry[p]; // is this VDJServer specific?
                });

                if (!first) {
                    if (format == 'json') res.write(',\n');
                    if (format == 'airr') res.write('\n');
                } else {
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
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function getSequenceSummary(req, res) {
    //console.log("getSequenceSummary");

    querySequenceSummary(req, res);
}

function postSequenceSummary(req, res) {
    //console.log("postSequenceSummary");

    querySequenceSummary(req, res);
}

function getSequenceData(req, res) {
    //console.log("getSequenceData");

    querySequenceData(req, res);
}

function postSequenceData(req, res) {
    //console.log("postSequenceData");

    querySequenceData(req, res);
}

/*
Once you "require" a module you can reference the things that it exports.  These are defined in module.exports.

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
