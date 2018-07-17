'use strict';

var R = require('ramda');
var request = require('request');
var rp = require('request-promise');

var agrum_utils = require('./utils/utils')
var agrum_processing = require('./processing/processing')

var agrum_lib = Object.create({});


//get Data from server
/**
url: url to request
skip: skip to query request
res_data: data requested
cb: funcion to execute
*/
agrum_lib.get_data = (url,configs,res_data,cb)=>{
	if(!configs.skip)
		configs.skip = 0
	if(!configs.limit)
		configs.limit = 100
	let url_request = url+'&skip='+configs.skip;
	console.log(url_request)
	request.get(url_request,(err,res,data)=>{
		data = JSON.parse(data)
		res_data = res_data.concat(data);
		if(data.length == configs.limit){
			configs.skip += configs.limit
			agrum_lib.get_data(url,configs,res_data,cb);
		}
		else{
			cb(res_data);
		}
	});
}

/**
url: url to request
skip: skip to query request
res_data: data requested
cb: funcion to execute
*/
agrum_lib.get_data_promise = (url,configs,res_data)=>{
	if(!configs.skip)
		configs.skip = 0
	if(!configs.limit)
		configs.limit = 500
	let url_request = url+'&skip='+configs.skip
	return rp(url_request)
	.then((data) => {
		data = JSON.parse(data)
		res_data = res_data.concat(data)
		if(data.length == configs.limit){
			configs.skip += configs.limit
			return agrum_lib.get_data_promise(url,configs,res_data)
		}else{
			return res_data
		}
	})
	.catch((err) => {
	    // Crawling failed...
	});

}

/**
url: url to request
skip: skip to query request
res_data: data requested
cb: funcion to execute
*/
agrum_lib.get_data_promise = (url,configs,res_data,device,types)=>{
	if(!configs.skip)
		configs.skip = 0
	if(!configs.limit)
		configs.limit = 500
	let url_request = url+'&skip='+configs.skip
	return rp(url_request)
	.then((data) => {
		data = JSON.parse(data)
		res_data = res_data.concat(data)
		if(data.length == configs.limit){
			configs.skip += configs.limit
			return agrum_lib.get_data_promise(url,configs,res_data,device,types)
		}else{
			if(!device['events']){
				device['events']={}
			}
			let type = types.shift()
			device['events'][type] = res_data
			if(types >= 0){
				type = types[0]
				configs.skip = 0
				return agrum_lib.get_data_promise(url+query,configs,[],device,types)
			}
			else{
				return device
			}
		}
	})
	.catch((err) => {
	    // Crawling failed...
	});
}

agrum_lib.get_data_promise_device = (configs,res_data,device,types)=>{
    if(!configs.skip)
        configs.skip = 0
    if(!configs.limit)
        configs.limit = 500
    
    let query = '/api/v1.0/events/?Authorization='+configs.Authorization+'&limit='+configs.limit+'&populate=&where={"type":"'+types[0]+'","id_device":"'+device['id_device']+'","timestamp":{">=":"'+configs['date_init']+'","<=":"'+configs['date_finish']+'"}}&sort=timestamp%20ASC'
                
    let url_request = configs.HOST+query+'&skip='+configs.skip
    return rp(url_request)
    .then((data) => {
        data = JSON.parse(data)
        res_data = res_data.concat(data)
        if(data.length == configs.limit){
            configs.skip += configs.limit
            return agrum_lib.get_data_promise_device(configs,res_data,device,types)
        }else{
            if(!device['events']){
                device['events']={}
            }
            let type = types.shift()
            device['events'][type] = res_data
            console.log(types,types.length)
            if(types.length > 0){
                configs.skip = 0
                return agrum_lib.get_data_promise_device(configs,[],device,types)
            }
            else{
                return device
            }
        }
    })
    .catch((err) => {
        // Crawling failed...
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
agrum_lib.processing = agrum_processing

module.exports = agrum_lib;