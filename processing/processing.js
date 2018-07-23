'use strict';

var R = require('ramda');
var request = require('request');
var ejs = require('ejs');
var fs = require('fs');
var path = require( "path" );
var moment = require('moment');
var geolib = require('geolib');

var agrum_utils = require('../utils/utils')

var agrum_processing = Object.create({});

agrum_processing.get_stats = (data_machine_filtered)=>{
	let group_by_journey = R.groupBy(value => {
		let hour = moment(value['timestamp']).get("hour")
		return (hour >= 6 && hour < 18)? 'day':'nigth'
	}, data_machine_filtered)

	let times_by_journey = R.map(events_jorunay => {
		let group_by_day = R.groupBy(value => moment(value['timestamp']).subtract(6,'hour').format('YYYY-MM-DD'), events_jorunay)
		return R.map(events_day => {
			let grouped_by_state = R.groupBy(event => event['state'],events_day)
			return R.map(events_state => {
				let acum = R.reduce((acc,val) => acc + val['duration'], 0, events_state)
				let hhmm = agrum_utils.getHHMM(acum)
				return {
					hours : acum/3600,
					seconds : acum,
					formated : hhmm
				}
			}, grouped_by_state)
		}, group_by_day)
	}, group_by_journey)


	let group_by_day = R.groupBy(value => moment(value['timestamp']).subtract(6,'hour').format('YYYY-MM-DD'),data_machine_filtered)

	let times_by_day = R.map(events_day => {
		let grouped_by_state = R.groupBy(event => event['state'],events_day)
		return R.map(events_state => {
			let acum = R.reduce((acc,val) => acc + val['duration'],0,events_state)
			let hhmm = agrum_utils.getHHMM(acum)
			return {
				hours : acum/3600,
				seconds : acum,
				formated : hhmm
			}
		},grouped_by_state)
	},group_by_day)

	//console.log('Group by day', group_by_day)


	let grouped_by_state = R.groupBy(event => event['state'],data_machine_filtered)

	let times_by_state = R.map(events_state => {
		let acum = R.reduce((acc, val) => acc + val['duration'],0,events_state)
		let hhmm = agrum_utils.getHHMM(acum)
		return {
			hours : acum/3600,
			seconds : acum,
			formated : hhmm
		}
	},grouped_by_state)

	let stats = {}

	stats['events'] = times_by_state
	stats['events_by_day'] = times_by_day
	stats['events_by_journey'] = times_by_journey

	let total_distance_traslado = 0

	total_distance_traslado = R.reduce((acc,val) => acc + val['distance'], 0, R.concat(grouped_by_state['traslado'] || [], grouped_by_state['trabajando'] || []))

	stats['distance'] = total_distance_traslado
	stats['seconds'] = R.reduce((acc,val)=>{
		return acc+stats['events'][val]['seconds']
	},0,R.keys(stats['events']))
	
	stats['formated'] = agrum_utils.getHHMM(stats['seconds'])

	return stats
}

agrum_processing.filter_data_machine = (data) =>{
	let filtered_data_machine = []

	data.forEach((value,index) => {
		if(index > 0) {
			let last = data[index - 1]
			let next = data[index + 1];

			let duration = 0
			if(value['time_end']) {
				duration = moment(value['time_end']).diff(moment(value['timestamp']),'seconds')
			} else if(next) {
				value['time_end'] = moment(next['timestamp']).toISOString()
				duration = moment(next['timestamp']).diff(moment(value['timestamp']),'seconds')
			} else {
				value['time_end'] = moment(value['timestamp']).toISOString()
				duration = moment(value['timestamp']).diff(moment(last['timestamp']),'seconds')
			}

			let distance = 0;
			if(value['lat'] != 0 && value['lng'] != 0 && last['lat'] != 0 && last['lng'] != 0 && value['hdop'] < 4 && last['hdop'] < 4) {
				distance = agrum_utils.get_distance(value,last);
			}

			if (duration > 600) { //Cuando un evento dura mas de 10 minutos, lo baja a 5 y sin distancia
				duration = 300
				distance = 0
			}

			duration = (duration < 1200) ? duration: 600;
			value['duration'] = duration;
			value['distance'] = distance;
		} else{
			value['duration'] = 0;
			value['distance'] = 0;
		}
	})

	filtered_data_machine = [];
	let group_filtered = [];
	let last_event = R.clone(data[0])

	data.forEach((value,index) => {
		if(index > 0){
			if(value['state'] == last_event['state']){
				last_event['duration'] += value['duration']
				last_event['distance'] += value['distance']
				last_event['time_end'] = value['time_end'];
			} else {
				/*console.log("---------------------------------");
				console.log("Estado", last_event['state'])
				console.log("Fecha Inicio", last_event['time_start']);
				console.log("Fecha Fin", last_event['time_end']);
				console.log("---------------------------------");*/
				group_filtered.push(last_event)
				last_event = R.clone(value)
			}
		}
	})

	/*
	filtered_data_machine.forEach((value,index) => {
		if(value.state == 'motor_encendido' && value['duration'] < 60*5 || value.state == 'apagado' && value['duration'] < 60*5){
			value.state = 'traslado'
	*/
	group_filtered.forEach((value,index) => {
		let last = group_filtered[index -1];
		if(index > 0) {
			if(last['state'] == 'traslado' && (value.state == 'motor_encendido' && value['duration'] < 60*5 || value.state == 'apagado' && value['duration'] < 60*5)){
				value.state = 'traslado'
			}
			if(last['state'] == 'trabajando' && (value.state == 'motor_encendido' && value['duration'] < 60*5 || value.state == 'apagado' && value['duration'] < 60*5)){
				value.state = 'trabajando'
			}
			if(last['state'] == 'trabajando' && (value.state == 'traslado' && value['duration'] < 60*5 )) {
				value.state = 'trabajando'
			}
		}
	})

	if(last_event) {
		group_filtered.push(last_event)
	}

	let last_filtered = R.clone(group_filtered[0]);
	group_filtered.forEach((value,index) => {
		if(index > 0){
			if(value['state'] == last_filtered['state']){
				last_filtered['duration'] += value['duration']
				last_filtered['distance'] += value['distance']
				last_filtered['time_end'] = value['time_end'];
			} else {
				/*
				console.log("---------------------------------");
				console.log("Estado", last_filtered['state'])
				console.log("Fecha Inicio", last_filtered['time_start']);
				console.log("Fecha Fin", last_filtered['time_end']);
				console.log("---------------------------------");
				*/
				filtered_data_machine.push(last_filtered)
				last_filtered = R.clone(value)
			}
		}
	})

	if(last_filtered) {
		filtered_data_machine.push(last_filtered);
	}

	return filtered_data_machine
}

agrum_processing.process_data_wagons = (events) =>{
	events.forEach((event,index)=>{
	    if(index < events.length - 1){
	        if(!event.time_end){
	            let next = events[index + 1]
	            let time_end = next['timestamp']
	            event['time_end'] = time_end
	        }
	    }
	})

    let events_trabajando = R.filter(event=>{
        let duration = moment(event['time_end']).diff(event['timestamp'],'minutes')
        return event.state=='Trabajando' && duration > 4
    },events)
    events_trabajando.forEach(event=>{
        let duration = moment(event['time_end']).diff(event['timestamp'],'minutes')
        //console.log(event.state,moment(event['timestamp']).format('HH:mm'),duration)
    })

    let events_espera_vagon = R.filter(event=>{
        let duration = moment(event['time_end']).diff(event['timestamp'],'minutes')
        return event.state=='Falta Vagon' && duration >= 5
    },events)
    events_espera_vagon.forEach(event=>{
        let duration = moment(event['time_end']).diff(event['timestamp'],'minutes')
        //console.log(event.state,moment(event['timestamp']).format('HH:mm'),duration)
    })

    let stats_cosecha = {
        events_trabajando,
        events_espera_vagon,
        wagons : events_trabajando.length,
        tons: events_trabajando.length*8,
        duration_working : R.reduce((acc,val)=>acc+agrum_utils.duration_event(val,'minutes'),0,events_trabajando),

        total_waiting_wagon: events_espera_vagon.length,
        duration_waiting_wagon: R.reduce((acc,val)=>acc+agrum_utils.duration_event(val,'minutes'),0,events_espera_vagon),
    }

    stats_cosecha.avg_working = stats_cosecha.duration_working / stats_cosecha.wagons
    stats_cosecha.avg_waiting_wagon = stats_cosecha.duration_waiting_wagon / stats_cosecha.total_waiting_wagon

    stats_cosecha.wagon_missed = stats_cosecha.duration_waiting_wagon / stats_cosecha.avg_waiting_wagon
    stats_cosecha.tons_missed = stats_cosecha.wagon_missed*8
    stats_cosecha.percent_missed = stats_cosecha.tons_missed/stats_cosecha.tons*100

    //console.log(generate_report_wagons(stats_cosecha))

    return stats_cosecha
}

agrum_processing.processDataCycles = (events_data,geofences) =>{
    let events = R.clone(events_data)
	//console.log('GEOFENCES',geofences)
    let count = 0
    events.forEach((event,index)=>{
        event.geofence = agrum_utils.get_geofence(event,geofences) //TODO
        //console.log(event.geofence)
        if(index > 0 && index < events.length - 1){

            let last = events[index - 1]
            let next = events[index + 1];

            let duration = 0
            if(event['time_end']) {
                duration = moment(event['time_end']).diff(moment(event['timestamp']),'seconds')
            } else if(next) {
                event['time_end'] = moment(next['timestamp']).toISOString()
                duration = moment(next['timestamp']).diff(moment(event['timestamp']),'seconds')
                //console.log('*****',index,event.id,count,format_HHmm(event.timestamp),format_HHmm(next.timestamp),duration)
                count++
            } else {
                //value['time_end'] = moment(value['timestamp']).toISOString()
                duration = moment(event['timestamp']).diff(moment(last['timestamp']),'seconds')
            }

            let distance = 0;

            if(event['lat'] != 0 && event['lng'] != 0 && last['lat'] != 0 && last['lng'] != 0 && event['hdop'] < 4 && event['hdop'] < 4 && event['speed'] > 2) {
                distance = agrum_utils.get_distance(event,last);
            }

            if (duration > 600) { //Cuando un evento dura mas de 10 minutos, lo baja a 5 y sin distancia
                duration = 300
                distance = 0
            }

            duration = (duration < 1200) ? duration: 600;
            event['duration'] = duration;
            event['distance'] = distance;
        }
    })

    let events_grouped_geofence = R.groupWith((a,b)=>a.geofence==b.geofence,events)

    events_grouped_geofence.forEach(event=>{
    	console.log(event[0].geofence)
    })

    events_grouped_geofence = R.map(events_geofence=>{
        let event_reduced = {
            distance : 0,
            duration : 0,
            max_speed : 0,
            geofence : events_geofence[0].geofence,
            timestamp: moment(events_geofence[0].timestamp).format('HH:mm'),//events_geofence[0].timestamp,
            //timestamp_utc: events_geofence[0]//events_geofence[0].timestamp,
        }
        return R.reduce((acc,val)=>{
            acc.distance += val.distance || 0
            acc.duration += val.duration/3600 || 0
            acc.max_speed = R.max(acc.max_speed,val.speed)
            if(val.time_end)
                acc.time_end = moment(val.time_end).format('HH:mm')
            return acc
        },event_reduced,events_geofence)
    },events_grouped_geofence)
    
    events_grouped_geofence.forEach(events_grouped=>{
        
    })
    
    /**
     * Code for group events in cycle starting for Ingenio
    **/
    let events_grouped_cicle = []
    let stack_events = []
    
    events_grouped_geofence.forEach(event_grouped_geofence=>{
        if(event_grouped_geofence.geofence && event_grouped_geofence.geofence.startsWith('INGENIO')){
            if(stack_events.length > 0){
                events_grouped_cicle.push(stack_events)
                stack_events = []
            }
        }
        stack_events.push(event_grouped_geofence)
    })
    events_grouped_cicle.push(stack_events)
    
    events_grouped_cicle = R.map(events_cicle=>{
        let distance = R.reduce((acc,val)=>acc+val.distance,0,events_cicle)
        let duration = R.reduce((acc,val)=>acc+val.duration,0,events_cicle)

        return {
            distance,duration,events:events_cicle
        }
    },events_grouped_cicle)
    //console.log(JSON.stringify(events_grouped_geofence,null,'  '))
    //console.log(JSON.stringify(events_grouped_cicle,null,'  '))

    let distance = R.reduce((acc,val)=>acc+val.distance,0,events_grouped_cicle)
    let duration = R.reduce((acc,val)=>acc+val.duration,0,events_grouped_cicle)
    let report = {
        distance,
        duration,
        cycles:events_grouped_cicle
    }
    return report
}

module.exports = agrum_processing;