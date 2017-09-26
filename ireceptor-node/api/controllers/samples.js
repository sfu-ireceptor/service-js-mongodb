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
    var m = {
        "subject_code": "Subject One",
	"subject_id": 1,
	"subject_gender": "Male",
	"subject_ethnicity": "Eth1",
	"project_id": 0,
	"project_name": "First Project",
	"project_parent_id": null,
	"lab_id": 0,
	"lab_name": "First Lab",
	"case_control_id": 0,
	"case_control_name": "Control",
	"sample_id": 1,
	"project_sample_id": 1,
	"sequence_count": 0,
	"sample_name": "Blood Sample 01",
	"subject_age": 22,
	"sample_subject_id": 1,
	"dna_id": 1,
	"dna_type": "cDNA",
	"sample_source_id": 2,
	"sample_source_name": "Blood (PBMC)",
	"lab_cell_subset_name": "Naive B Alpha",
	"ireceptor_cell_subset_name": "Naive B",
	"marker_1": "CR19",
	"marker_2": "CR20",
	"marker_3": "CR21",
	"marker_4": null,
	"marker_5": null,
	"marker_6": null
    };

  res.json(m);

        });
        });
}
