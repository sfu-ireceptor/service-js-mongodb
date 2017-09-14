'use strict';

var util = require('util');

/*
 Once you 'require' a module you can reference the things that it exports.  These are defined in module.exports.

 For a controller in a127 (which this is) you should export the functions referenced in your Swagger document by name.

 Either:
  - The HTTP Verb of the corresponding operation (get, put, post, delete, etc)
  - Or the operationId associated with the operation in your Swagger document
 */
module.exports = {
  getMetadata: getMetadata,
  postMetadata: postMetadata
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function getMetadata(req, res) {
    console.log('getMetadata');

  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  //var name = req.swagger.params.name.value || 'stranger';
  //var hello = util.format('Hello, %s!', name);

  // this sends back a JSON response which is a single string
    var m = {
	"labs_projects": [
            {
		"name": "iReceptor Account",
		"id": 1,
		"projects": [
                    {
			"id": "9152428524005822951-242ac11c-0001-012",
			"name": "iReceptor Test"
                    },
                    {
			"id": "0001439322308591-e0bd34dffff8de6-0001-012",
			"name": "test_ireceptor"
                    }
		]
            }
	],
	"ethnicity": [
            "Asian",
            "African"
	],
	"casecontrol": [
            "Case"
	],
	"dnainfo": [
            "cDNA"
	],
	"source": [
            "PBMCs"
	],
	"gender": [
            "Male"
	],
	"cellsubsettypes": [
            "Memory B cell"
	]
    };

  res.json(m);
}

function postMetadata(req, res) {
    console.log('postMetadata');
    //console.log(req);

  // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
  //var name = req.swagger.params.name.value || 'stranger';
  //var hello = util.format('Hello, %s!', name);

  // this sends back a JSON response which is a single string
    var m = {
	"labs_projects": [
            {
		"name": "iReceptor Account",
		"id": 1,
		"projects": [
                    {
			"id": "9152428524005822951-242ac11c-0001-012",
			"name": "iReceptor Test"
                    },
                    {
			"id": "0001439322308591-e0bd34dffff8de6-0001-012",
			"name": "test_ireceptor"
                    }
		]
            }
	],
	"ethnicity": [
            "Asian",
            "African"
	],
	"casecontrol": [
            "Case"
	],
	"dnainfo": [
            "cDNA"
	],
	"source": [
            "PBMCs"
	],
	"gender": [
            "Male"
	],
	"cellsubsettypes": [
            "Memory B cell"
	]
    };

  res.json(m);
}
