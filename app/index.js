'use strict';


/////////////////////////////
// Toggles
/////////////////////////////

var DEBUG = false;


/////////////////////////////
// Imports
/////////////////////////////

var fs = require('fs');
var document = require('document');
var peerSocket = require('messaging').peerSocket;


/////////////////////////////
// Constants
/////////////////////////////

var Commands = {
  PLAY: "play",
  PAUSE: "pause",
  PLAYPAUSE: "playpause",
  NEXT: "next",
  PREVIOUS: "previous",
  VOLUME_UP: "volume_up",
  VOLUME_DOWN: "volume_down",
  INFO: "info",
  ENABLE_SHUFFLE: "enable_shuffle",
  DISABLE_SHUFFLE: "disable_shuffle"
};

var Apps = {
  SPOTIFY: "Spotify",
  ITUNES: "iTunes",
  POWERPOINT: "PowerPoint",
  KEYNOTE: "Keynote",
  SYSTEM: "System"
};

var BottomButtonStates = [Commands.PLAYPAUSE,
                          Commands.NEXT,
                          Commands.PREVIOUS];


var PROGRESS_BAR_MAX = 210;
var VOLUME_MAX = 100

/////////////////////////////
// Global State
/////////////////////////////

var sys_volume;
var app_volume;
var position;
var duration;

var is_controlling_volume;
var is_playing;
var is_shuffling;
var shuffle_icon_showing;
var refresh_icon_showing;
var has_stale_information;
var has_sent_info_request;

var volume_timeout_timer;

var bottom_button_timer;
var bottom_button_state;


/////////////////////////////
// UI State Handling
/////////////////////////////

var updateProgressbar = function() {
  var progressBar = document.getElementById('progress-bar');
  if (is_controlling_volume) {
    progressBar.width = ((app_volume / VOLUME_MAX) * PROGRESS_BAR_MAX);
  } else {
    progressBar.width = ((position / duration) * PROGRESS_BAR_MAX);    
  }
}

var finalizeBottomButton = function() {
  if (bottom_button_state == Commands.PLAYPAUSE) {
    is_playing = !is_playing;
  }
  
  sendRequest(bottom_button_state);
  bottom_button_state = "";
  updateButtons();
}

var clickButtomButton = function() {
  var bottomRightIcon = document.getElementById('combo-icon-br');

  if (bottom_button_state == "") {
    bottom_button_state = Commands.PLAYPAUSE;

    clearTimeout(bottom_button_timer);
    bottom_button_timer = setTimeout(finalizeBottomButton, 500);
  } else if (bottom_button_state == Commands.PLAYPAUSE) {
    bottom_button_state = Commands.NEXT;

    clearTimeout(bottom_button_timer);
    bottom_button_timer = setTimeout(finalizeBottomButton, 500);
  } else if (bottom_button_state == Commands.NEXT) {
    bottom_button_state = Commands.PREVIOUS;

    clearTimeout(bottom_button_timer);
    finalizeBottomButton();
  }
  updateButtons();
}

var showVolumeButtons = function() {
  // We clicked the ... to show the volume buttons
  is_controlling_volume = true;
  updateButtons();
  updateProgressbar();

  // Set a timeout to clear the volume buttons
  volume_timeout_timer = setTimeout(clearVolumeButtons, 2000);
}

var clearVolumeButtons = function() {
  is_controlling_volume = false;
  updateButtons();
  updateProgressbar();
}

var updateButtons = function() {
  var topRightIcon = document.getElementById('combo-icon-tr');
  var bottomRightIcon = document.getElementById('combo-icon-br');

  if (is_controlling_volume) {
    topRightIcon.href = "icn_musictray_volumeup_p.png";
    bottomRightIcon.href = "icn_musictray_volumedown_p.png";
  } else {
    topRightIcon.href = "icn_musictray_more_p.png";

    if (bottom_button_state == Commands.PLAYPAUSE) {
      bottomRightIcon.href = "icn_musictray_next_p.png";
    } else if (bottom_button_state == Commands.NEXT) {
      bottomRightIcon.href = "icn_musictray_previous_p.png";
    } else if (bottom_button_state == Commands.PREVIOUS ||bottom_button_state == "") {
      bottomRightIcon.href = (is_playing) ? "icn_musictray_pause_p.png" : "icn_musictray_play_p.png";
    }
  }
}

/////////////////////////////
// Global State Updaters
/////////////////////////////

var onMessage = function(msg) {
  if (typeof msg._app === 'undefined') {
    return;
  }
  
  if (DEBUG) {
    console.log(msg._app);
    console.log(msg._appVolume);
    console.log(msg._duration);
    console.log(msg._footerText);
    console.log(msg._headerText);
    console.log(msg._mainText);
    console.log(msg._playing);
    console.log(msg._position);
    console.log(msg._shuffle);
    console.log(msg._sysVolume);
  }

  if (typeof msg._appVolume !== 'undefined') {
    app_volume = msg._appVolume;
  }

  if (typeof msg._duration !== 'undefined') {
    duration = (msg._duration / 1000);
  }

  if (typeof msg._footerText !== 'undefined') {
    var footer = document.getElementById('footer-text');
    footer.innerText = msg._footerText;
  }

  if (typeof msg._headerText !== 'undefined') {
    var header = document.getElementById('header-text');
    header.innerText = msg._headerText;
  }

  if (typeof msg._mainText !== 'undefined') {
    var main = document.getElementById('main-text');
    main.innerText = msg._mainText;
  }

  if (typeof msg._playing !== 'undefined') {
    is_playing = msg._playing;
  }

  if (typeof msg._position !== 'undefined') {
    position = msg._position;
  }

  if (typeof msg._shuffle !== 'undefined') {
    is_shuffling = msg._shuffle;
  }

  if (typeof msg._sysVolume !== 'undefined') {
    sys_volume = msg.sysVolume;
  }

  has_stale_information = false;
  has_sent_info_request = false;

  updateProgressbar();
  updateButtons();
}

/////////////////////////////
// PeerSocket
/////////////////////////////

// Import the messaging module

peerSocket.onopen = function() {
  // Ready to send or receive
  console.log("Messaging open!");

  // We have connected, let's fetch new info ASAP
  sendRequest(Commands.INFO);
}

peerSocket.onerror = function(err) {
  // Handle any errors
  console.log("Connection error: " + err.code + " - " + err.message);
}

peerSocket.onmessage = function(evt) {
  // Got a message!
  if (DEBUG) {
    console.log("Received a message");
  }
  onMessage(evt.data);
}

// Send a message to the peer
function sendRequest(command) {
  // Sample data
  var data = {
    _app: Apps.SPOTIFY,
    _command: command
  };

  if (peerSocket.readyState === peerSocket.OPEN) {
    // Send the data to peer as a message
    console.log("Sending request: " + command);
    peerSocket.send(data);
  } else {
    console.log("Not sending request: " + command);
  }

  if (command == Commands.INFO) {
    has_sent_info_request = true;
  }
}


/////////////////////////////
// TouchScreen Button Handlers
/////////////////////////////

var topRightButton = document.getElementById('btn-tr');
topRightButton.onactivate = function (e) {
  if (is_controlling_volume) {
    // We are viewing the volume buttons

    // Reset our timeout timer. They'll get another X seconds to click more volume buttons
    clearTimeout(volume_timeout_timer);
    volume_timeout_timer = setTimeout(clearVolumeButtons, 2000);

    // Actually send the request
    sendRequest(Commands.VOLUME_UP);
  } else {
    showVolumeButtons();
  }
};

var bottomRightButton = document.getElementById('btn-br');
bottomRightButton.onactivate = function (e) {
  if (is_controlling_volume) {
    // Reset our timeout timer. They'll get another X seconds to click more volume buttons
    clearTimeout(volume_timeout_timer);
    volume_timeout_timer = setTimeout(clearVolumeButtons, 2000);

    // Actually send the request
    sendRequest(Commands.VOLUME_DOWN);
  } else {
    clickButtomButton();
  }
};

/////////////////////////////
// Timers
/////////////////////////////

var secondTick = function() {
  if (is_playing) {
    position++;
  }

  // increment progress_bar every 5 seconds
  if (position < duration) {
    if (position % 5 == 0) {
      updateProgressbar();
    }
  } else if (position > duration) {
    has_stale_information = true;

    if (!has_sent_info_request) {
      sendRequest(Commands.INFO);
    }
  }
};

setInterval(secondTick, 1000);


/////////////////////////////
// Initialization
/////////////////////////////

sys_volume = 0;
app_volume = 0;
position = 0;
duration = 0;

is_controlling_volume = false;
is_playing = false;
is_shuffling = false;
shuffle_icon_showing = false;
refresh_icon_showing = false;
has_stale_information = true;
has_sent_info_request = false;

bottom_button_state = "";
