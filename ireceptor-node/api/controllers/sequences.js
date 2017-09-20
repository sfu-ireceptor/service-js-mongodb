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
    getSequences: getSequences
};

/*
  Functions in a127 controllers used for operations should take two parameters:

  Param 1: a handle to the request object
  Param 2: a handle to the response object
 */
function getSequences(req, res) {
    console.log('getSequences');

    // variables defined in the Swagger document can be referenced using req.swagger.params.{parameter_name}
    //var name = req.swagger.params.name.value || 'stranger';
    //var hello = util.format('Hello, %s!', name);

    // this sends back a JSON response which is a single string
    var m = [ ];

  res.json(m);
}
