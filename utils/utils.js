'use strict';

var R = require('ramda');
var request = require('request');

var agrum_utils = Object.create({});

agrum_utils.parse = (number) => {
	return R.add(number,1);
}

module.exports = agrum_utils;