'use strict';

var R = require('ramda');
var request = require('request');
var ejs = require('ejs');
var fs = require('fs');
var path = require( "path" );
var moment = require('moment');
var geolib = require('geolib');

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

agrum_utils.get_geofence = (event,geofences)=>{
    let name_geofence = false
    let point = {
        latitude : event.lat,
        longitude : event.lng
    }
    geofences.forEach(geofence=>{
        let polygon = R.map(point=>{return {longitude:point[0],latitude:point[1]}},geofence.geometry.coordinates[0])
        if(geolib.isPointInside(point,polygon))
            name_geofence = geofence.name
    })
    return name_geofence
}

agrum_utils.get_distance = (event_1,event_2)=>{
    let point_1 = {latitude:event_1.lat,longitude:event_1.lng}
    let point_2 = {latitude:event_2.lat,longitude:event_2.lng}
    return geolib.getDistance(point_1,point_2)/1000
}

agrum_utils.duration_event = (event,type) => {
    if(!type)
        type = 'hours'
    return moment(event['time_end']).diff(event['timestamp'],type)
}

agrum_utils.get_path = () => {
	return path.join(__dirname,'../assets/templates/email_template.ejs')
}

agrum_utils.send_email = (data,options,type) => {
	let data_machines = R.clone(data)
	data_machines = R.map(value => {
		value.events = agrum_utils.resume_events(value.events,options)
		return value
	},data_machines)

	if(!type){
		type = 'email_template'
	}
	let msg = ejs.render(fs.readFileSync(path.join(__dirname,'../assets/templates/'+type+'.ejs'), 'utf8'),{data:data_machines,options,R})
	return msg
}

agrum_utils.generate_email = (data,options,type) => {
	let data_machines = R.clone(data)
	data_machines = R.map(value => {
		value.stats.events = agrum_utils.resume_events(value.stats.events,options)
		return value
	},data_machines)

	if(!type){
		type = 'email_template'
	}
	let msg = ejs.render(fs.readFileSync(path.join(__dirname,'../assets/templates/'+type+'.ejs'), 'utf8'),{data:data_machines,options,R})
	return msg
}

agrum_utils.resume_events = (data,options) => {
	let data_keys = [
		{
			name:'Apagado',
			values:['apagado','ignicion']
		},
		{
			name:'Ralenty',
			values:['motor_encendido']
		},
		{
			name:'Trabajando',
			values:['traslado','trabajando']
		}
	]
	let events = []
	data_keys.forEach(data_key=>{
		let seconds = 0
		let hours = 0
		data_key.values.forEach(value_data=>{
			if(data[value_data]){
				seconds += data[value_data].seconds
				hours += data[value_data].hours
			}
		})
		events.push({
			name:data_key.name,
			value: agrum_utils.getHHMM(seconds),
			percent: seconds/options['seconds']*100,
			seconds,
			hours
		})
	})
	return events
}

module.exports = agrum_utils;