'use strict';

var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var path = require('path');
var fs = require('fs');

// Server environment config
var config = require('./config/config');

module.exports = app; // for testing

// Swagger middleware config
var swaggerConfig = {
  appRoot: __dirname, // required config
  configDir: 'config'
};

// Load swagger API
//console.log(config.appRoot);
var swaggerFile = path.resolve(swaggerConfig.appRoot, 'api/swagger/iReceptor_Data_Service_API_V2.json');
console.log('Using swapper API file: ' + swaggerFile);
var swaggerString = fs.readFileSync(swaggerFile, 'utf8');
swaggerConfig.swagger = JSON.parse(swaggerString);

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
