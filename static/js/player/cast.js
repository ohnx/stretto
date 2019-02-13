/* chromecast code adapted from https://gist.github.com/TylerFisher/9415aa0e75040f13028d and is Copyright (c) 2014 NPR */
/*
Licensed under the MIT License:
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/
/* global chrome */
var CHROMECAST_SENDER = (function() {
  var obj = {};

  var _session = null;
  var _readyCallback = null;
  var _startedCallback = null;
  var _stoppedCallback = null;
  var _updateCallback = null;

  /*
   * Initialize chromecast environment.
   */
  obj.setup = function(readyCallback, startedCallback, stoppedCallback, updateCallback) {
    _readyCallback = readyCallback;
    _startedCallback = startedCallback;
    _stoppedCallback = stoppedCallback;
    _updateCallback = updateCallback;

    var sessionRequest = new chrome.cast.SessionRequest(chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID);

    var apiConfig = new chrome.cast.ApiConfig(
      sessionRequest,
      sessionListener,
      receiverListener,
      chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
    );

    console.log('Cast initializing...');
    chrome.cast.initialize(apiConfig, onInitSuccess, onInitError);
  };

  /*
   * Listen for existing sessions with the receiver.
   */
  var sessionListener = function(session) {
    _session = session;
    _session.addUpdateListener(sessionUpdateListener);

    console.log('Previous cast session restored');
    if (_startedCallback) _startedCallback();
  };

  /*
   * Listen for changes to the session status.
   */
  var sessionUpdateListener = function(isAlive) {
    console.log('Session status updated to ' + (isAlive ? 'alive' : 'dead'));
    if (!isAlive && _stoppedCallback) _stoppedCallback();
    else if (isAlive) _updateCallback();
  };

  /*
   * Listen for receivers to become available.
   */
  var receiverListener = function(e) {
    if (e === chrome.cast.ReceiverAvailability.AVAILABLE && _readyCallback) _readyCallback();
  };

  /*
   * Environment successfully initialized.
   */
  var onInitSuccess = function(e) {
  };

  /*
   * Error initializing.
   */
  var onInitError = function(e) {
    console.log('Chromecast failed to initialize: ', e);
  };

  /*
   * Start casting.
   */
  obj.startCasting = function() {
    chrome.cast.requestSession(onRequestSessionSuccess, onRequestSessionError);
  };

  /*
   * Casting session begun successfully.
   */
  var onRequestSessionSuccess = function(session) {
    _session = session;
    _session.addUpdateListener(sessionUpdateListener);
    console.log('Chromecast started casting');

    if (_startedCallback) _startedCallback();
  };

  /*
   * Casting session failed to start.
   */
  var onRequestSessionError = function(e) {
    console.log('Chromecast failed casting: ', e);
  };

  /*
   * Stop casting.
   */
  obj.stopCasting = function() {
    _session.stop(onSessionStopSuccess, onSessionStopError);
  };

  /*
   * Inform client the session has stopped.
   */
  var onSessionStopSuccess = function() {
    console.log('Chromecast successfully stopped casting');
    if (_stoppedCallback) _stoppedCallback();
    // TOOD: should null?
    _session = null;
  };

  var onSessionStopError = function() {
    console.log('Chromecast failed to stop casting');
    // TODO: should null?
    _session = null;
  };

  /*
   * Cast a song
   */
  obj.castAudio = function(audio, metadata, callback_start, callback_update) {
    // Start casting the current song
    var mediaInfo = new chrome.cast.media.MediaInfo(audio, "audio/mpeg");
    mediaInfo.metadata = metadata;
    var request = new chrome.cast.media.LoadRequest(mediaInfo);
    _session.loadMedia(request, function() {
        // Hook media update callback
        if (callback_update) {
          _session.media[_session.media.length-1].addUpdateListener(callback_update);
        }
        if (callback_start) callback_start();
      }, function(errorCode) {
        console.log('Load Error code: ', errorCode);
        if (callback_start) callback_start(errorCode);
      }
    );
  };

  /*
   * Pause a song
   */
  obj.pause = function(callback) {
    if (_session.media.length <= 0) callback(true);
    // Pause the current song
    var request = new chrome.cast.media.PauseRequest();
    _session.media[0].pause(request, function() {
        if (callback) callback();
      }, function(errorCode) {
        console.log('Pause Error code: ', errorCode);
        if (callback) callback(errorCode);
      }
    );
  };

  /*
   * Play a song
   */
  obj.play = function(callback) {
    if (_session.media.length <= 0) callback(true);
    // Play the current song
    var request = new chrome.cast.media.PlayRequest();
    _session.media[0].play(request, function() {
        if (callback) callback();
      }, function(errorCode) {
        console.log('Play Error code: ', errorCode);
        if (callback) callback(errorCode);
      }
    );
  };

  /*
   * Seek to a time in the song
   */
  obj.seek = function(time, callback) {
    if (_session.media.length <= 0) callback(true);
    // Seek the current song
    var request = new chrome.cast.media.SeekRequest();
    request.currentTime = time;
    _session.media[0].seek(request, function() {
        if (callback) callback();
      }, function(errorCode) {
        console.log('Seek Error code: ', errorCode);
        if (callback) callback(errorCode);
      }
    );
  };

  /*
   * Get current playback progress
   */
  obj.pbprog = function() {
    return _session.media.length > 0 ? _session.media[0].getEstimatedTime() : 0;
  };

  /*
   * Get current duration
   */
  obj.pbdur = function() {
    return _session.media.length > 0 ? _session.media[0].media.duration : 0;
  };

  return obj;
}());

/*
 * A cast device is available.
 */
var onCastReady = function() {
  
};

/*
 * A cast session was updated.
 */
var onCastUpdate = function() {
  console.log('Cast session Update received');
};

/*
 * Begin chromecasting.
 */
var onCastStartClick = function(e) {
  if (e) e.preventDefault();

  // fire the Chromecast-specific start function, which will fire the callback defined below
  CHROMECAST_SENDER.startCasting();
};

/*
 * Stop chromecasting.
 */
var onCastStopClick = function(e) {
  if (e) e.preventDefault();

  // fire the Chromecast-specific stop function, which will fire the callback defined below
  CHROMECAST_SENDER.stopCasting();
};
