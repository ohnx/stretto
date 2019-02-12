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

    chrome.cast.initialize(apiConfig, onInitSuccess, onInitError);
  }

  /*
   * Listen for existing sessions with the receiver.
   */
  var sessionListener = function(session) {
    _session = session;
    _session.addUpdateListener(sessionUpdateListener);

    if (_startedCallback) _startedCallback();
  }

  /*
   * Listen for changes to the session status.
   */
  var sessionUpdateListener = function(isAlive) {
    if (!isAlive && _stoppedCallback) _stoppedCallback();
    else if (isAlive) _updateCallback();
  }

  /*
   * Listen for receivers to become available.
   */
  var receiverListener = function(e) {
    if (e === chrome.cast.ReceiverAvailability.AVAILABLE && _readyCallback) _readyCallback();
  }

  /*
   * Environment successfully initialized.
   */
  var onInitSuccess = function(e) {}

  /*
   * Error initializing.
   */
  var onInitError = function(e) {}

  /*
   * Start casting.
   */
  obj.startCasting = function() {
    chrome.cast.requestSession(onRequestSessionSuccess, onRequestSessionError);
  }

  /*
   * Casting session begun successfully.
   */
  var onRequestSessionSuccess = function(session) {
    _session = session;
    _session.addUpdateListener(sessionUpdateListener);

    if (_startedCallback) _startedCallback();
  }

  /*
   * Casting session failed to start.
   */
  var onRequestSessionError = function(e) {}

  /*
   * Stop casting.
   */
  obj.stopCasting = function() {
    _player = null;
    _playerController = null;
    _session.stop(onSessionStopSuccess, onSessionStopError);
  }

  /*
   * Inform client the session has stopped.
   */
  var onSessionStopSuccess = function() {
    if (_stoppedCallback) _stoppedCallback();
  }

  var onSessionStopError = function() {}

  /*
   * Successfully sent message to receiver.
   */
  var onSendSuccess = function(message) {}

  /*
   * Error sending message to receiver.
   */
  var onSendError = function(message) {}

  return obj;
}());

/*
 * A cast device is available.
 */
var onCastReady = function() {
  $castStart.show();
};

/*
 * A cast session started.
 */
var onCastStarted = function() {
  // set a global variable to make special casing code on the sender easier
  is_casting = true;

  // Start casting the current song
  var mediaInfo = new chrome.cast.media.MediaInfo(/* current audio */"audio.mp3", "audio/mpeg");
  var request = new chrome.cast.media.LoadRequest(mediaInfo);
  CHROMECAST_SENDER._session.loadMedia(request).then(
    function() { console.log('Load succeed'); },
    function(errorCode) { console.log('Error code: ' + errorCode);
  });
};

/*
 * A cast session stopped.
 */
var onCastStopped = function() {
  is_casting = false;
};

/*
 * A cast session was updated.
 */
var onCastUpdate = function() {
  CHROMECAST_SENDER._session
};

/*
 * Begin chromecasting.
 */
var onCastStartClick = function(e) {
  e.preventDefault();

  // fire the Chromecast-specific start function, which will fire the callback defined below
  CHROMECAST_SENDER.startCasting();
}

/*
 * Stop chromecasting.
 */
var onCastStopClick = function(e) {
  e.preventDefault();

  // fire the Chromecast-specific stop function, which will fire the callback defined below
  CHROMECAST_SENDER.stopCasting();
}

/* event for if user has chromecast support */
window['__onGCastApiAvailable'] = function(isAvailable) {
  if (isAvailable) CHROMECAST_SENDER.setup(onCastReady, onCastStarted, onCastStopped, onCastUpdate);
};
