// App bootstrap
var App = require("core");
	Alloy.Globals.Map = require("ti.map"),
	Moment = require("alloy/moment");

var args = arguments[0] || {};

var TRIP, CATCHES;

function init() {
	TRIP = App.Database.getTrip(args.id);
	Ti.API.warn(JSON.stringify(TRIP));
	CATCHES = App.Database.getCatchesByTrip(TRIP.id);
	
	var date = Moment.unix(TRIP.start);
	var rows = [];
	
	$.LogbookCatchWindow.title = date.format("MMMM Do, YYYY");
	
	$.Map.setMapType(Alloy.Globals.Map.SATELLITE_TYPE);
	
	for(var i = 0, x = CATCHES.length; i < x; i++) {
		var _catch = CATCHES[i];
		
		_catch.species = App.Database.getSpeciesById(_catch.species);
		
		if(i == 0) {
			$.Map.setRegion({
				latitude: _catch.geo.latitude,
				longitude: _catch.geo.longitude,
				latitudeDelta: 0.01,
				longitudeDelta: 0.01
			});
		}
		
		var item = Alloy.Globals.Map.createAnnotation({
			latitude: _catch.geo.latitude,
			longitude: _catch.geo.longitude,
			title: _catch.species,
			subtitle: _catch.weight.pound + " lb " + _catch.weight.ounce + " oz",
			image: "images/icon_annotation.png"
		});
		
		$.Map.addAnnotation(item);
		
		var row = Alloy.createController("logbook_catch_row", _catch).getView();
		
		rows.push(row);
	}
	
	$.Table.setData(rows);
}

init();