//
// VDJServer customizations
//

'use strict';

var template = {};

module.exports = template;

var male_gender = ["M", "m", "male", "Male"];
var female_gender = ["F", "f", "female", "Female"];

//
// Customizations for /samples entrypoint.
//

// Customize parameter name/values when constructing query
template.parameterNameForQuerySamples = function(parameter, req, res) {
    //console.log('parameterNameForQuerySamples');

    if (parameter.name == 'sequencing_platform') return 'platform';

    return undefined;
}

template.parameterValueForQuerySamples = function(parameter, req, res) {
    //console.log('parameterValueForQuerySamples');

    if (parameter.name == 'ir_username') {
	if (req.swagger.params[parameter.name].value)
	    console.log('iReceptor user: ' + req.swagger.params[parameter.name].value);
	// skip parameter
	return null;
    }

    // exception: age interval
    if (parameter.name == 'ir_subject_age_min') {
	if (req.swagger.params[parameter.name].value != undefined) {
	    return { "$gte" : req.swagger.params[parameter.name].value };
	}
    }
    if (parameter.name == 'ir_subject_age_max') {
	if (req.swagger.params[parameter.name].value != undefined) {
	    return { "$lte" : req.swagger.params[parameter.name].value };
	}
    }

    if (parameter.name == 'sex') {
	var value = req.swagger.params[parameter.name].value;
	if (value != undefined) {
	    if (value == 'M') {
		return { "$in": male_gender };
	    } else if (value == 'F') {
		return { "$in": female_gender };
	    }
	}
    }

    return undefined;
}

// Customize return data
template.dataCleanForQuerySamples = function(p, result, req, res) {
    //console.log('dataCleanForQuerySamples');

    if (p == 'vdjserver_filename_uuid') result['ir_project_sample_id'] = result[p];
    else if (p == 'sequence_count') result['ir_sequence_count'] = result[p];
    else if (p == 'platform') result['sequencing_platform'] = result[p];
    else if (p == 'sex') {
	if (male_gender.indexOf(result[p]) >= 0) result[p] = 'M';
	else if (female_gender.indexOf(result[p]) >= 0) result[p] = 'F';
    }

    return undefined;
}

//
// Customizations for /sequences* entrypoints.
//

// Customize parameter name/values when constructing query
template.parameterNameForQuerySequences = function(parameter, req, res) {
    //console.log('parameterNameForQuerySequences');

    if (parameter.name == 'ir_project_sample_id_list') return 'filename_uuid';
    if (parameter.name == 'sequencing_platform') return 'platform';
    if (parameter.name == 'junction_length') return 'junction_nt_length';

    return undefined;
}

template.parameterValueForQuerySequences = function(parameter, req, res) {
    //console.log('parameterValueForQuerySequences');

    if (parameter.name == 'ir_username') {
	if (req.swagger.params[parameter.name].value)
	    console.log('iReceptor user: ' + req.swagger.params[parameter.name].value);
	// skip parameter
	return null;
    }

    // skip parameter
    if (parameter.name == 'ir_data_format') return null;

    if (parameter.name == 'junction_aa') {
	var value = req.swagger.params[parameter.name].value;
	if (value != undefined) {
	    return { "$regex": req.swagger.params[parameter.name].value };
	}
    }

    if (parameter.name == 'sex') {
	var value = req.swagger.params[parameter.name].value;
	if (value != undefined) {
	    if (value == 'M') {
		return { "$in": male_gender };
	    } else if (value == 'F') {
		return { "$in": female_gender };
	    }
	}
    }

    return undefined;
}

// Customize count return data for /sequences_summary
template.countsForQuerySequencesSummary = function(counts, entry, req, res) {
    //console.log('countsForQuerySequencesSummary');

    entry['ir_filtered_sequence_count'] = counts[entry['vdjserver_filename_uuid']];

    return undefined;
}

// Customize summary return data for /sequences_summary
template.dataCleanForQuerySequencesSummary = function(p, entry, req, res) {
    //console.log('dataCleanForQuerySequencesSummary');

    if (p == 'vdjserver_filename_uuid') entry['ir_project_sample_id'] = entry[p];
    else if (p == 'platform') entry['sequencing_platform'] = entry[p];
    else if (p == 'sequence_count') entry['ir_sequence_count'] = entry[p];
    else if (p == 'sex') {
	if (male_gender.indexOf(entry[p]) >= 0) entry[p] = 'M';
	else if (female_gender.indexOf(entry[p]) >= 0) entry[p] = 'F';
    }

    return undefined;
}

// Customize items return data for /sequences_summary
template.dataCleanForQuerySequences = function(p, entry, req, res) {
    //console.log('dataCleanForQuerySequences');

    if (p == 'vdjserver_filename_uuid') entry['ir_project_sample_id'] = entry[p];
    else if (p == 'junction_nt_length') entry['junction_length'] = entry[p];

    return undefined;
}

// Customize header fields for /sequences_data
template.headersForQuerySequencesData = function(req, res) {
    console.log('headersForQuerySequencesData');

    return ['ir_project_sample_id', 'vdjserver_filename_uuid'];
}

// Customize return data for /sequences_data
template.dataCleanForQuerySequencesData = function(p, entry, req, res) {
    //console.log('dataCleanForQuerySequencesData');

    if (p == 'filename_uuid') {
	entry['ir_project_sample_id'] = entry[p];
	entry['vdjserver_filename_uuid'] = entry[p];
	entry['rearrangement_set_id'] = entry[p];
    } else if (p == 'junction_nt_length') entry['junction_length'] = entry[p];

    return undefined;
}
