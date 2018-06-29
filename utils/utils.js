'use strict';

var R = require('ramda');
var request = require('request');
var ejs = require('ejs');
var fs = require('fs');
var path = require( "path" );

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

agrum_utils.get_path = () => {
	return path.join(__dirname,'../assets/templates/email_template.ejs')
}

agrum_utils.send_email = (data,options,type) => {
	data = R.map(value => {
		value.events = agrum_utils.resume_events(value.events,options)
		return value
	},data)

	if(!type){
		type = 'email_template'
	}
	let msg = ejs.render(fs.readFileSync(path.join(__dirname,'../assets/templates/'+type+'.ejs'), 'utf8'),{data:data,options,R})
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