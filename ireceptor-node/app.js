'use strict';

//var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var path = require('path');
var fs = require('fs');
var Runner = require('swagger-node-runner');

// Server environment config
var config = require('./config/config');

module.exports = app; // for testing

// Swagger middleware config
var swaggerConfig = {
  appRoot: __dirname, // required config
  configDir: 'config'
};

// trap unhandled promise rejection from aborted queries
process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.log('unhandledRejection:', error.message);
});

// Load swagger API
//console.log(config.appRoot);
var swaggerFile = path.resolve(swaggerConfig.appRoot, 'api/swagger/iReceptor_Data_Service_API_V2.json');
console.log('Using swapper API file: ' + swaggerFile);
var swaggerString = fs.readFileSync(swaggerFile, 'utf8');
swaggerConfig.swagger = JSON.parse(swaggerString);

Runner.create(swaggerConfig, function(err, runner) {
    if (err) { throw err; }

    // install middleware
    var swaggerExpress = runner.expressMiddleware();
    swaggerExpress.register(app);

    var port = config.port || 8080;
    app.listen(port);

    console.log('iReceptor API listening on port:' + port);
});

/*
// Create service
SwaggerExpress.create(swaggerConfig, function(err, swaggerExpress) {
    if (err) { throw err; }

    // install middleware
    swaggerExpress.register(app);

    var port = config.port || 8080;
    app.listen(port);

    console.log('iReceptor API listening on port:' + port);
    
  //if (swaggerExpress.runner.swagger.paths['/metadata']) {
  //  console.log('try this:\ncurl http://127.0.0.1:' + port + '/hello?name=Scott');
  //}
});
*/
