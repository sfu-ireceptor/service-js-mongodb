/*jslint
    node
*/
"use strict";

// Server environment config
var mongoSettings = require("../../config/mongoSettings");

var MongoClient = require("mongodb").MongoClient;
var assert = require("assert");

var url = "mongodb://"
        + mongoSettings.username + ":" + mongoSettings.userSecret + "@"
        + mongoSettings.hostname + ":27017/admin";

var male_gender = ["M", "m", "male", "Male"];
var female_gender = ["F", "f", "female", "Female"];

var escapeString = function (text) {
    var encoded = text.replace(/\*/g, "\\*");
    encoded = encoded.replace(/\+/g, "\\+");
    return encoded;
};

// perform query, shared by GET and POST
var querySamples = function (req, res) {
    //console.log(url);
    //console.log(req.swagger.operation.parameterObjects);
    //console.log(req.swagger.params.ir_username.value);
    //console.log(req.swagger.params.ir_subject_age_min.value);
    //console.log(req);

    var results = [];
    var query = {};

    // construct query
    req.swagger.operation.parameterObjects.forEach(function (parameter) {
        //console.log(parameter.name);
        //console.log(parameter.type);
        //console.log(req.swagger.params[parameter.name].value);

        var param_name = parameter.name;
        var value = req.swagger.params[parameter.name].value;

        console.log("0. Sample Parameter Name: '" + parameter.name + "', Value: '" + value + "'");

        /*
         * We may eventually wish to decide what kind of
         * access control that the turnkey should have...
         */
        if (parameter.name === "ir_username") {
            if (req.swagger.params[parameter.name].value) {
                console.log("iReceptor user: " + value);
                return;
            }
        }

        // exception: age interval
        if (parameter.name === "ir_subject_age_min") {
            if (req.swagger.params[parameter.name].value !== undefined) {
                    param_name = "ir_subject_age"
                    query[param_name] = {"$gte": value};
            }
            return;
        }
        if (parameter.name === "ir_subject_age_max") {
            if (req.swagger.params[parameter.name].value !== undefined) {
                param_name = "ir_subject_age"
                query[param_name] = {"$lte": value};
            }
            return;
        }

        /*
         * VDJServer specific tag transformations - deprecated in iReceptor turnkey?
         *
        if (parameter.name === "sequencing_platform") {
            param_name = "platform";
        }

        if (parameter.name === "sex") {
            var value = req.swagger.params[parameter.name].value;
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

        if (req.swagger.params[parameter.name].value !== undefined) {
            // arrays perform $in
            if (parameter.type === "array") {
                query[param_name] = {"$in": value};
            }

            // string is $regex
            if (parameter.type === "string") {
                query[param_name] = {"$regex": escapeString(value)};
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

    console.log("Mongo query: "+query);

    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        //console.log("Connected successfully to mongo");

        var v1db = db.db(mongoSettings.dbname);
        var sampleCollection = v1db.collection("sample");

        sampleCollection.find(query).toArray()
            .then(function (records) {
                //console.log(records);
                //console.log("Retrieve " + records.length + " records.");

                // push to results
                records.forEach(function (r) {
                    results.push(r);
                });
            })
            .then(function () {
                //console.log("querySamples() results: " + JSON.stringify(results));
                // data cleanup - some of this may be legacy
                // VDJServer-specific hence, not applicable for the turnkey?
                results.forEach(function (result) {
                    //console.log("querySamples() result: " + JSON.stringify(result));
                    Object.keys(result).forEach(function (p) {
                        //console.log("querySamples() result key: " + JSON.stringify(p));
                        if (!result[p]) {
                            delete result[p];
                        } else if ((typeof result[p] === "string") && (result[p].length === 0)) {
                            delete result[p];
                        } else if (p === "_id") {
                            result.ir_project_sample_id = result[p];
                        } else if (p === "sequence_count") {
                            result.ir_sequence_count = result[p];
                        } else if (p === "platform") {
                            result.sequencing_platform = result[p];
                        } else if (p === "sex") {
                            if (male_gender.indexOf(result[p]) >= 0) {
                                result[p] = "M";
                            } else if (female_gender.indexOf(result[p]) >= 0) {
                                result[p] = "F";
                            }
                        }
                    });
                });
            })
            .then(function () {
                db.close();
                res.json(results);
            })
            .catch(function (e) {
                console.log("querySamples() error: " + e);
            });

    });
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function postSamples(req, res) {
    //console.log("postSamples");

    querySamples(req, res);
}

function getSamples(req, res) {
    //console.log("getSamples");

    querySamples(req, res);
}

/*
Once you "require" a module you can reference the things that it exports.  These are defined in module.exports.

For a controller in a127 (which this is) you should export the functions referenced in your Swagger document by name.

Either:
 - The HTTP Verb of the corresponding operation (get, put, post, delete, etc)
 - Or the operationId associated with the operation in your Swagger document
*/
module.exports = {
    getSamples: getSamples,
    postSamples: postSamples
};
