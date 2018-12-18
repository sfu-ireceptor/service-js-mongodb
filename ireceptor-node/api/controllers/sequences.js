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

// file export helper arrays
var airrHeadersMapping = []; 
       airrHeadersMapping['sequence']='sequence';
       airrHeadersMapping['sequence_id']='seq_name';
       airrHeadersMapping['rearrangement_id']='NULL';
       airrHeadersMapping['rev_comp']='rev_comp';
       airrHeadersMapping['sequence_alignment']='NULL';
       airrHeadersMapping['germline_alignment']='NULL';
       airrHeadersMapping['v_call']='v_call';
       airrHeadersMapping['j_call']='j_call';
       airrHeadersMapping['d_call']='d_call';
       airrHeadersMapping['c_call']='NULL';
       airrHeadersMapping['v_score']='v_score';
       airrHeadersMapping['d_score']='NULL';
       airrHeadersMapping['j_score']='NULL';
       airrHeadersMapping['c_score']='NULL';
       airrHeadersMapping['junction']='junction';
       airrHeadersMapping['junction_length']='junction_length';
       airrHeadersMapping['v_cigar']='NULL';
       airrHeadersMapping['j_cigar']='NULL';
       airrHeadersMapping['d_cigar']='NULL';
       airrHeadersMapping['c_cigar']='NULL';
       airrHeadersMapping['cdr1_aa']='cdr1region_sequence_aa';
       airrHeadersMapping['cdr2_aa']='cdr2region_sequence_aa';
       airrHeadersMapping['cdr3_aa']='cdr3region_sequence_aa';
       airrHeadersMapping['junction_aa']='junction_aa';
       airrHeadersMapping['junction_aa_length']='junction_aa_length';
       airrHeadersMapping['productive']='functional';
       airrHeadersMapping['functional']='functional';
       airrHeadersMapping['subject_id']='subject_id';
       airrHeadersMapping['sex']='sex';
       airrHeadersMapping['organism']='organism';
       airrHeadersMapping['ethnicity']='ethnicity';
       airrHeadersMapping['study_title']='study_title';
       airrHeadersMapping['study_id']='study_id';
       airrHeadersMapping['study_description']='study_description';
       airrHeadersMapping['lab_name']='lab_name';
       airrHeadersMapping['disease_state_sample']='disease_state_sample';
       airrHeadersMapping['study_group_description']='study_group_description';
       airrHeadersMapping['sample_id']='sample_id';
       airrHeadersMapping['template_class']='template_class';
       airrHeadersMapping['tissue']='tissue';
       airrHeadersMapping['cell_subset']='cell_subset';
       airrHeadersMapping['sequencing_platform']='sequencing_platform';
       airrHeadersMapping['cell_phenotype']='cell_phenotype';
    
var projection = {
            "sequence":1,
            "seq_name":1,
            "rev_comp":1,
            "v_call":1,
            "j_call":1,
            "d_call":1,
            "v_score":1,
            "junction":1,
            "junction_length":1,
            "cdr1region_sequence_aa":1,
            "cdr2region_sequence_aa":1,
            "cdr3region_sequence_aa":1,
            "junction_aa":1,
            "junction_aa_length":1,
            "functional":1,
            "subject_id":1,
            "sex":1,
            "organism":1,
            "ethnicity":1,
            "study_title":1,
            "study_id":1,
            "study_description":1,
            "lab_name":1,
            "disease_state_sample":1,
            "study_group_description":1,
            "sample_id":1,
            "template_class":1,
            "tissue":1,
            "cell_subset":1,
            "sequencing_platform":1,
            "cell_phenotype":1,
            "ir_project_sample_id":1
            }

// VDJServer-specific - deprecated?
//var male_gender = ["M", "m", "male", "Male"];
//var female_gender = ["F", "f", "female", "Female"];
var airrTerms = []; 
airrTerms = Object.keys(airrHeadersMapping);
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

        if (parameter.name === "ir_data_format"){
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

      
    
        if (value != undefined) {
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
    console.log("Query constructed as: "+JSON.stringify(query));
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
    if (format != 'airr') {
    res.status(400).end();
    return;
    }

    var query = constructQuery(req);
    var sampleQuery = constructSampleQuery(req);
    console.log(query);    
 
    res.setHeader('Content-Type', 'text/tsv');
    res.setHeader('Content-Disposition', 'attachment;filename="data.tsv"');
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
    var annCollection = v1db.collection('sequence');
    var sampleCollection = v1db.collection('sample');
    var first = true;

    sampleCollection.find(sampleQuery).toArray()
            .then(function (theSamples){
                async.eachSeries(theSamples, function(sample, callback){
                    var currentQuery = query;
                    currentQuery["ir_project_sample_id"] = sample["_id"];
                    //irSampleIds.push(sample["_id"]);
                    var cursor = annCollection.find(currentQuery, projection);
                    var vals=[];
                    cursor.forEach(function(entry) {
                        if (abortQuery) {
                            console.log('aborting query');
                            cursor.close(function(err, result) {
                                // db will be closed by callback
                            });}
                        else
                        { 
                            if (first){
                                var sampleFields = [];
                                sampleFields = Object.keys(sample);
                                res.write(airrTerms.join('\t'));
                                res.write(sampleFields.join('\t'));
                                res.write('\n');
                                first = false;
                            }    
                            var results=[];                        
                           
                            for (var airrField in airrHeadersMapping) {
                                console.log("processing " + airrField + " which maps to " + airrHeadersMapping[airrField]);
                                    if (airrHeadersMapping[airrField] == 'NULL' || entry[airrHeadersMapping[airrField]] == undefined)
                                    {
                                        results.push('');
                                    }
                                    else
                                    {
                                        if (airrField == 'rev_comp') {
                                            if (entry['rev_comp'] == '+') {
                                               entry['rev_comp'] = 'true';
                                            }
                                            if (entry['rev_comp'] == '-') {
                                                entry['rev_comp'] = 'false';
                                            }
                                        }
                                        if (airrField == 'productive' || airrField == 'functional') {
                                            if (entry[airrField] == 1) {
                                                entry[airrField] = 'true';
                                            } else if (entry[airrField] == 0) {
                                                entry[airrField] = 'false';
                                            }
                                        }
                                        if (entry[airrHeadersMapping[airrField]].type == 'array')
                                        {
                                            entry[airrHeadersMapping[airrField]] = entry[airrHeadersMapping[airrField]].join(', or ');
                                        }

                                        results.push(entry[airrHeadersMapping[airrField]]);
                                    }
                            }
                            results = results.concat(Object.values(sample));
                            //res.write(Object.values(entry).join('\t'));
                            console.log(results);
                            res.write(results.join('\t'));
                            res.write('\n');
                        }
                        callback();
                    });

                }
                ,function(err) {
                    db.close();
                    res.end();
                }
            )
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
