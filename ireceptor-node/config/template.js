'use strict';

var template = {};

module.exports = template;

//
// Customizations for /samples entrypoint.
//

// Customize parameter name/values when constructing query
template.parameterNameForQuerySamples = function(parameter, req, res) {
    //console.log('parameterNameForQuerySamples');
    return undefined;
}

// return a value, or return null skip parameter, or return undefined
// for default parameter handling
template.parameterValueForQuerySamples = function(parameter, req, res) {
    //console.log('parameterValueForQuerySamples');
    return undefined;
}

// Customize return data
template.dataCleanForQuerySamples = function(p, result, req, res) {
    //console.log('dataCleanForQuerySamples');
    return undefined;
}

//
// Customizations for /sequences* entrypoints.
//

// Customize parameter name/values when constructing query
template.parameterNameForQuerySequences = function(parameter, req, res) {
    //console.log('parameterNameForQuerySequences');
    return undefined;
}

// return a value, or return null skip parameter, or return undefined
// for default parameter handling
template.parameterValueForQuerySequences = function(parameter, req, res) {
    //console.log('parameterValueForQuerySequences');
    return undefined;
}

// Customize count return data for /sequences_summary
template.countsForQuerySequencesSummary = function(counts, result, req, res) {
    //console.log('countsForQuerySequencesSummary');
    return undefined;
}

// Customize summary return data for /sequences_summary
template.dataCleanForQuerySequencesSummary = function(name, result, req, res) {
    //console.log('dataCleanForQuerySequencesSummary');
    return undefined;
}

// Customize items return data for /sequences_summary
template.dataCleanForQuerySequences = function(name, result, req, res) {
    //console.log('dataCleanForQuerySequences');
    return undefined;
}

// Customize header fields for /sequences_data
template.headersForQuerySequencesData = function(req, res) {
    console.log('headersForQuerySequencesData');
    return undefined;
}

// Customize return data for /sequences_data
template.dataCleanForQuerySequencesData = function(name, result, req, res) {
    //console.log('dataCleanForQuerySequencesData');
    return undefined;
}
