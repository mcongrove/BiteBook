/**
 * The main app singleton used throughout the app.  This singleton
 * can manage your navigation flow, special events that happen throughout
 * the app lifecycle, etc.
 *
 * It's important to understand that this should mainly be a simple app singleton
 * for managing global things throughout your app.  i.e. If you want to sanitize
 * some html, you shouldn't put a function to handle that here.
 *
 * @class core
 * @singleton
 */
var Alloy = require("alloy");

var App = {
	/**
	 * Device information, some come from the Ti API calls and can be referenced
	 * from here so multiple bridge calls aren't necessary, others generated here
	 * for ease of calculations and such.
	 *
	 * @type {Object}
	 * @param {String} version The version of the OS
	 * @param {Number} versionMajor The major version of the OS
	 * @param {Number} versionMinor The minor version of the OS
	 * @param {Number} width The width of the device screen
	 * @param {Number} height The height of the device screen
	 * @param {Number} dpi The DPI of the device screen
	 * @param {String} orientation The device orientation, either "landscape" or "portrait"
	 * @param {String} statusBarOrientation A Ti.UI orientation value
	 */
	Device: {
		version: Ti.Platform.version,
		versionMajor: parseInt(Ti.Platform.version.split(".")[0], 10),
		versionMinor: parseInt(Ti.Platform.version.split(".")[1], 10),
		width: null,
		height: null,
		dpi: Ti.Platform.displayCaps.dpi,
		orientation: Ti.Gesture.orientation == Ti.UI.LANDSCAPE_LEFT || Ti.Gesture.orientation == Ti.UI.LANDSCAPE_RIGHT ? "landscape" : "portrait"
	},
	/**
	 * The global tab group used in the app.
	 * @type {Object}
	 */
	TabGroup: null,
	/**
	 * Database model file
	 */
	Database: require("database"),
	/**
	 * Pebble module
	 */
	Pebble: require("pebble"),
	/**
	 * Background service flags
	 */
	BackgroundServiceStarted: false,
	BackgroundServiceActive: OS_IOS ? false : true, // Background intent is ALWAYS running for Android
	/**
	 * Geo coordinates
	 */
	Geo: {
		latitude: null,
		longitude: null
	},
	/**
	 * Sets up the app singleton and all it's child dependencies.
	 * **NOTE: This should only be fired in index controller file and only once.**
	 */
	init: function() {
		// Global system Events
		Ti.Network.addEventListener("change", App.networkChange);
		Ti.App.addEventListener("pause", App.exit);
		Ti.App.addEventListener("close", App.exit);
		Ti.App.addEventListener("resumed", App.resume);
		Ti.Gesture.addEventListener("orientationchange", App.orientationChange);
		Ti.App.addEventListener("BB_UPDATE", App.updateCatchCounts);
		App.Pebble.Kit.addEventListener("update", App.receiveFromPebble);
		
		// Register geolocation service for iOS (Android is registered in background intent)
		if(OS_IOS) {
			if(Ti.Geolocation.locationServicesEnabled) {
				Ti.Geolocation.purpose = "Catch Geolocation Logging";
				Ti.Geolocation.accuracy = Ti.Geolocation.ACCURACY_BEST;
				Ti.Geolocation.distanceFilter = 95;
				Ti.Geolocation.preferredProvider = Ti.Geolocation.PROVIDER_GPS;
			}
			
			Ti.Geolocation.addEventListener("location", function(_event) {
				if(_event.error) {
					Ti.API.error(_event.error);
				} else {
					App.Geo = _event.coords;
					
					App.updateCatchCounts();
				}
			});
			
			Ti.Geolocation.getCurrentPosition(function(_event) {
				if(_event.error) {
					Ti.API.error(_event.error);
				} else {
					App.Geo = _event.coords;
				}
			});
		}

		// Get device dimensions
		App.getDeviceDimensions();
		
		// Open the first tab
		App.TabGroup.open();
	},
	/**
	 * Opens the settings screen
	 */
	openSettings: function() {
		var SettingsNavigationWindow = Alloy.createController("settings").getView();
		
		SettingsNavigationWindow.open();
	},
	/**
	 * Handles when a catch has been logged
	 */
	updateCatchCounts: function(_event) {
		if(!App.BackgroundServiceActive && Ti.App.Properties.getBool("BB_PEBBLE_ENABLED", false)) {
			App.Pebble.sendMessage({
				message: {
					0: App.Database.catchGetCountByTrip(),
					1: App.Database.catchGetCountByLocation(App.Geo)
				}
			});
		}
	},
	/**
	 * Fired when a catch is received from the Pebble
	 */
	receiveFromPebble: function(_data) {
		if(!App.BackgroundServiceActive && Ti.App.Properties.getBool("BB_PEBBLE_ENABLED", false)) {
			if(_data.message.charAt(0) == "{") {
				var _catch = JSON.parse(_data.message);
				
				var VALUES = {
					species: _catch.S,
					weight: {
						pound: _catch.WP,
						ounce: _catch.WO
					},
					length: {
						feet: _catch.LF,
						inch: _catch.LI
					}
				};
				
				App.Database.catchAdd(VALUES);
			}
			
			setTimeout(App.updateCatchCounts, 1000);
		}
	},
	/**
	 * Global network event handler
	 * @param {Object} _event Standard Ti callback
	 */
	networkChange: function(_event) {
		
	},
	/**
	 * Exit event observer
	 * @param {Object} _event Standard Ti callback
	 */
	exit: function(_event) {
		App.BackgroundServiceActive = true;
	},
	/**
	 * Resume event observer
	 * @param {Object} _event Standard Ti callback
	 */
	resume: function(_event) {
		App.BackgroundServiceActive = false;
	},
	/**
	 * Handle the orientation change event callback
	 * @param {Object} _event Standard Ti Callback
	 */
	orientationChange: function(_event) {
		// Ignore face-up, face-down and unknown orientation
		if(_event.orientation === Titanium.UI.FACE_UP || _event.orientation === Titanium.UI.FACE_DOWN || _event.orientation === Titanium.UI.UNKNOWN) {
			return;
		}

		App.Device.orientation = _event.source.isLandscape() ? "landscape" : "portrait";

		/**
		 * Fires an event for orientation change handling throughout the app
		 * @event orientationChange
		 */
		Ti.App.fireEvent("orientationChange", {
			orientation: App.Device.orientation
		});
	},
	/**
	 * Determines the device dimensions
	 * @return {Object} Returns the new values of the new {@link core.Device.width} & {@link core.Device.height} settings
	 */
	getDeviceDimensions: function() {
		// Set device height and width based on orientation
		switch(App.Device.orientation) {
			case "portrait":
				App.Device.width = Ti.Platform.displayCaps.platformWidth > Ti.Platform.displayCaps.platformHeight ? Ti.Platform.displayCaps.platformHeight : Ti.Platform.displayCaps.platformWidth;
				App.Device.height = Ti.Platform.displayCaps.platformWidth > Ti.Platform.displayCaps.platformHeight ? Ti.Platform.displayCaps.platformWidth : Ti.Platform.displayCaps.platformHeight;
				break;
			case "landscape":
				App.Device.width = Ti.Platform.displayCaps.platformWidth > Ti.Platform.displayCaps.platformHeight ? Ti.Platform.displayCaps.platformWidth : Ti.Platform.displayCaps.platformHeight;
				App.Device.height = Ti.Platform.displayCaps.platformWidth > Ti.Platform.displayCaps.platformHeight ? Ti.Platform.displayCaps.platformHeight : Ti.Platform.displayCaps.platformWidth;
				break;
		}
		
		// Convert dimensions from DP to PX for Android
		if(OS_ANDROID) {
			App.Device.width = (App.Device.width / (App.Device.dpi / 160));
			App.Device.height = (App.Device.height / (App.Device.dpi / 160));
		}

		return {
			width: App.Device.width,
			height: App.Device.height
		};
	}
};

module.exports = App;