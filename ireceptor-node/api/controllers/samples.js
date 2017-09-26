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

    MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	console.log("Connected successfully to server");

	var v1db = db.db('v1public');
	var collection = v1db.collection('sample');

	collection.find().toArray(function(err, docs) {

	    console.log(docs);
	    
	db.close();

  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  //var name = req.swagger.params.name.value || 'stranger';
  //var hello = util.format('Hello, %s!', name);

    // this sends back a JSON response which is a single string
	    var m = [
		{
		    "sequence_count": 0,
		    "study_id": "string",
		    "study_title": "string",
		    "study_type": "string",
		    "inclusion_exclusion_criteria": "string",
		    "grants": "string",
		    "lab_name": "string",
		    "collected_by": "string",
		    "uploaded_by": "string",
		    "lab_address": "string",
		    "pubs_ids": "string",
		    "subject_id": "string",
		    "organism": "string",
		    "sex": "string",
		    "age": "string",
		    "age_event": "string",
		    "ancestry_population": "string",
		    "ethnicity": "string",
		    "race": "string",
		    "species_name": "string",
		    "strain_name": "string",
		    "linked_subjects": "string",
		    "link_type": "string",
		    "sample_id": "string",
		    "sample_type": "string",
		    "tissue": "string",
		    "disease_state_sample": "string",
		    "collection_date": "string",
		    "collection_time_event": "string",
		    "source_commercial": "string",
		    "cell_subset": "string",
		    "cell_phenotype": "string",
		    "study_group_description": "string",
		    "library_source": "string",
		    "subject_age": 0,
		    "marker_1": "string",
		    "marker_2": "string",
		    "marker_3": "string",
		    "marker_4": "string",
		    "marker_5": "string",
		    "marker_6": "string",
		    "subject_db_id": 0,
		    "project_db_id": 0,
		    "project_parent_db_id": 0,
		    "lab_db_id": 0,
		    "case_control_db_id": 0,
		    "sample_db_id": 0,
		    "dna_db_id": 0,
		    "project_sample_db_id": 0,
		    "sample_subject_db_id": 0,
		    "sample_source_db_id": 0
		}
	    ];
	    
	    res.json(m);

        });
        });
}

function getSamples(req, res) {
    console.log('getSamples');

    var m = [];
    
    res.json(m);
}
