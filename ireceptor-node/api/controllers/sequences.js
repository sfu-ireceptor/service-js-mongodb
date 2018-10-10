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

var constructSampleQuery = function(req){
    //function to grab the sample metadata for samples with 
    //  sequences

    var query={};
    //see if the list of samples is provided to narrow the query
    req.swagger.operation.parameterObjects.forEach(function (parameter) {

        var param_name = parameter.name;
        var value = req.swagger.params[parameter.name].value;
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
                query["_id"] = {"$in": sample_ids};
            }
            //skip the processing of ir_project_sample_list in the sequences query. each id 
            //  will be processed separately 
            return;
        }
    })
    query["ir_sequence_count"] = {"$gt":0};
    return(query);

}
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
            /*if (value) {

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
            }*/
            //skip the processing of ir_project_sample_list in the sequences query. each id 
            //  will be processed separately 
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

        if (param_name === "functional" && value!=undefined ) {
            var func_value;
            if (parameter.type === "boolean") {
                if (value == true)
                {
                    func_value = 1;
                }
                else if(value == false)
                {
                    func_value = 0;
                }

            }
            else
            {
                func_value = parseInt(value);
            }            
            query[param_name] = func_value;
            return;
        }
        if (param_name==="annotation_tool")
        {
            if (value!=undefined)
            {
                query["ir_annotation_tool"] = value;
            }
            return;
        }
        if (param_name==="ir_annotation_tool")
        {
            if ( value!=undefined)
            {
                query["ir_annotation_tool"]= value;
            }
            return;
        }
        if (param_name == "junction_aa")
        {
            if (value != undefined)
            {
                query["substring"] == value;
            }
            return;
        }
        /*V, D and J gene is a semi-substring search, essentially it will look for 
           family, gene or name based on presence or absence of * and - characters in
           v_,d_,j_call - compromise between functionality and performance. Had we not used
           V-Quest, a prefix search would be fast but when we have an array of values, we
           found MongoDB performace suffers*/
        if (param_name == "v_call" || param_name == "j_call" || param_name == "d_call")
        {
            if (value!=undefined)
            {
                var prefix_regex = /(.)_/;
                var allele_regex = /\*/;
                var gene_regex = /-/;
                var query_param = "";
                var gene_prefix = prefix_regex.exec(param_name)[1];
                console.log("Prefix: "+ gene_prefix);
                if (allele_regex.exec(value))
                {
                    query_param = gene_prefix + "_call";
                }
                else if (gene_regex.exec(value))
                {
                    query_param = gene_prefix + "gene_gene";
                }
                else
                {
                    query_param = gene_prefix + "gene_family";
                }
                query[query_param] = value;
                return;
            }
        }

        //console.log(parameter.name);
        //console.log(parameter.type);
        //console.log(req.swagger.params[parameter.name].value);
        if (value !== undefined) {
            // arrays perform $in
            if (parameter.type === "array") {
                query[param_name] = {"$in": value};
                return;
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
                console.log("Doing int conversion");
                var func_val = parseInt(value);
                query[param_name] = func_val;
                return;
            }

            // number is exact match
            if (parameter.type === "number") {
                query[param_name] = value;
                return;
            }

            // boolean is exact match
            if (parameter.type === "boolean") {
                query[param_name] = value;
                return;
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
    var sampleQuery = constructSampleQuery(req);
    var query = constructQuery(req);
    var samples=[];
    var returnSamples=[];
    var returnSequences=[];
    var irSampleIds = [];
    console.log("1. Query: " + JSON.stringify(query));

    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        //console.log("2. Connected successfully to mongo");

        var irdb = db.db(mongoSettings.dbname);
        var annCollection = irdb.collection("sequence"); // Scott calls this the "rearrangement" collection
        var sampleCollection = irdb.collection("sample");
        console.log("Sample query "+JSON.stringify(sampleQuery));

        sampleCollection.find(sampleQuery).toArray()
            .then(function (theSamples){
                async.eachSeries(theSamples, function(sample, callback){
                    var currentQuery = query;
                    currentQuery["ir_project_sample_id"] = sample["_id"];
                    irSampleIds.push(sample["_id"]);
                    annCollection.count(currentQuery, function (err, theCount){
                        sample["ir_filtered_sequence_count"] = theCount;
                        returnSamples.push(sample);
                        callback();
                    })
                }
        ,function(err) {
            //grab first 25 results and send them back
            var currentQuery = query;
            currentQuery["ir_project_sample_id"] = {"$in": irSampleIds};
            console.log("sequences 25 query " + JSON.stringify(currentQuery));
            annCollection.find(currentQuery).limit(25).toArray()
                .then(function (sequences){
                    returnSequences = sequences; 
                
                })
                .then(function () {
                    console.log("All done.");
                    var result=[];
                    db.close();
                    returnSequences.forEach(function (result) {
                        if (Array.isArray(result["v_call"]))
                        {
                            result["v_call"] = result["v_call"].join(", or ");
                        }
                        if (Array.isArray(result["vgene_gene"]))
                        {
                            result["vgene_gene"] = result["vgene_gene"].join(", or ");
                        }
                        if (Array.isArray(result["vgene_family"]))
                        {
                            result["vgene_family"] = result["vgene_family"].join(", or ");
                        }
                        if (Array.isArray(result["j_call"]))
                        {
                            result["j_call"] = result["j_call"].join(", or ");
                        }
                        if (Array.isArray(result["jgene_gene"]))
                        {
                            result["jgene_gene"] = result["jgene_gene"].join(", or ");
                        }
                        if (Array.isArray(result["jgene_family"]))
                        {
                            result["jgene_family"] = result["jgene_family"].join(", or ");
                        }
                        if (Array.isArray(result["d_call"]))
                        {
                            result["d_call"] = result["d_call"].join(", or ");
                        }
                        if (Array.isArray(result["dgene_gene"]))
                        {
                            result["dgene_gene"] = result["dgene_gene"].join(", or ");
                        }
                        if (Array.isArray(result["dgene_family"]))
                        {
                            result["dgene_family"] = result["dgene_family"].join(", or ");
                        }
                    });
                    results["summary"] = returnSamples;
                    results["items"] = returnSequences;
                    res.json(results);
                
             })})
            })
        })
        
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
