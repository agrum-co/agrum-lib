'use strict';

var R = require('ramda');
var request = require('request');

var agrum_utils = require('./utils/utils')

var agrum_lib = Object.create({});


//Return sencons to HH:mm format
agrum_lib.getHHMM = (seconds) => {
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

//get Data from server
agrum_lib.get_data = (url,skip,res_data,cb)=>{
	let url_request = url+'&skip='+skip;
	console.log(url_request)
	request.get(url_request,(err,res,data)=>{
		data = JSON.parse(data)
		res_data = res_data.concat(data);
		if(data.length == 100){
			agrum_lib.get_data(url,skip + 100,res_data,cb);
		}
		else{
			cb(res_data);
		}
	});
}

//Function that return the data sort and grouped by geofence
agrum_lib.group_data_geofence = (data)=>{
	//Add geofence when exists
	let data_events_geofence = R.map(event=>{
	    let is_in_geofence = event => {
			let is_in_geogence = false
			if(event['geofence'])
				is_in_geogence = event['geofence']
			if(event['parameters']){
				event['parameters'].forEach(parameter=>{
					if(parameter['geometry']){
						is_in_geogence = parameter['name']
					}
				})
			}
			return is_in_geogence
		}
	    event['geofence'] = is_in_geofence(event)
	    return event
	},data)

	let events_grouped = R.map(event_grouped =>{
	    event_grouped[0].time_end = event_grouped[event_grouped.length-1].time_end
	    return event_grouped[0]
	},R.groupWith((a,b)=>a.geofence == b.geofence,data_events_geofence))

	return events_grouped;
}

agrum_lib.utils = agrum_utils

module.exports = agrum_lib;