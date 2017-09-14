'use strict';

var SwaggerExpress = require('swagger-express-mw');
var app = require('express')();
var path = require('path');
var fs = require('fs');

module.exports = app; // for testing

var config = {
  appRoot: __dirname, // required config
  configDir: 'config'
};

console.log(config.appRoot);
//var swaggerFile = path.resolve(config.appRoot, 'api/swagger/swagger.json');
var swaggerFile = path.resolve(config.appRoot, 'api/swagger/ireceptor-api.json');
console.log(swaggerFile);
var swaggerString = fs.readFileSync(swaggerFile, 'utf8');
config.swagger = JSON.parse(swaggerString);


SwaggerExpress.create(config, function(err, swaggerExpress) {
  if (err) { throw err; }

  // install middleware
  swaggerExpress.register(app);

  var port = process.env.PORT || 8083;
  app.listen(port);

  //if (swaggerExpress.runner.swagger.paths['/metadata']) {
  //  console.log('try this:\ncurl http://127.0.0.1:' + port + '/hello?name=Scott');
  //}
});
