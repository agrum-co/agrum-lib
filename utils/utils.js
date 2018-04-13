'use strict';

var R = require('ramda');
var request = require('request');

var agrum_utils = Object.create({});

agrum_utils.parse = (number) => {
	return R.add(number,1);
}

//Return sencons to HH:mm format
agrum_utils.getHHMM = (seconds) => {
	/*
	return moment().startOf('day')
	    .seconds(seconds)
	    .format('H:mm')
	*/
	seconds = +seconds || 0
	let nTime = +seconds/3600;
	let nHours = parseInt(nTime);
	let decimal_minutes = (nTime%1)*60
	let nMinutes = decimal_minutes | 0;
	let mm = ''+nMinutes
	if(nMinutes < 10){
	mm = '0'+nMinutes;
	}
	return ''+nHours+':'+mm;
}

module.exports = agrum_utils;