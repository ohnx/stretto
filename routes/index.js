var util = require(__dirname + '/../util.js');
var lib_func = require(__dirname + '/../library_functions.js');
var async = require('async');
var archiver = require('archiver');
var os = require('os');
var opener = require('opener');
var md5 = require('md5');
var mkdirp = require('mkdirp');
var request = require('request').defaults({ encoding: null });
var fs = require('fs');
var path = require('path');
var MobileDetect = require('mobile-detect');
var similarSongs = require('similar-songs');
var songSearch = require('song-search');

/*
 * GET home page.
 */

let app = null;

exports.createRoutes = function(app_ref) {
  app = app_ref;

  // pass the app onto the library_functions module
  lib_func.setApp(app);

  app.get('/', musicRoute);
  app.get('/remote/:name', musicRoute);
  app.get('/songs/:id.mid', sendSong);
  app.get('/songs', function(req, res){get_songs(function(songs){res.json(songs);res.end();});});
  app.get('/playlists', function(req, res){app.db.playlists.find({}).sort({title:1}).exec(function(err,docs){if(err){res.json([]);}else{res.json(docs);}res.end();})});
  app.get('/cover/:id', sendCover);
  app.get('/downloadplaylist/:id', downloadPlaylist);
  app.post('/upload', uploadSong);

  // remote control commands
  app.get('/command', remoteCommandInterface);
  app.get('/command/:name/:command', remoteCommand);
  app.io.route('player_page_connected', function(req) { req.socket.join('players'); });

  // remote functions
  app.io.route('set_comp_name', setCompName);

  // routes protected in demo
  if (!app.get('config').demo) {
    // scanning signals
    app.io.route('start_scan', function(req) { lib_func.scanLibrary(false); });

    app.io.route('start_scan_hard', function(req) { lib_func.scanLibrary(true); });

    app.io.route('hard_rescan', rescanItem);

    // delete song
    app.io.route('delete', deleteItems);

    // rewrite tags of a track to the file
    app.io.route('rewrite_tags', rewriteTags);

    // sync routes
    app.io.route('sync_page_connected', syncPageConnected);
    app.io.route('sync_playlists', syncPlaylists);

    // soundcloud/youtube downloading
    app.io.route('youtube_download', youtubeDownload);

    // youtube downloading for bunch of songs with pre-filled info
    // (i.e. they were viewing from a mix)
    app.io.route('youtube_import', youtubeImport);

    // settings updating
    app.io.route('update_settings', updateSettings);
  }

  // send the songs to the client
  app.io.route('fetch_songs', returnSongs);

  // playlist modifications
  app.io.route('fetch_playlists', returnPlaylists);
  app.io.route('create_playlist', createPlaylist);
  app.io.route('rename_playlist', renamePlaylist);
  app.io.route('delete_playlist', deletePlaylist);
  app.io.route('add_to_playlist', addToPlaylist);
  app.io.route('remove_from_playlist', removeFromPlaylist);
  app.io.route('song_moved_in_playlist', songMovedInPlaylist);

  // play count
  app.io.route('update_play_count', updatePlayCount);

  // remote control routes
  app.io.route('get_receivers', getReceiversMinusThis);

  // open file manager to location
  app.io.route('open_dir', function(req) { opener(req.data.substring(0, req.data.lastIndexOf(path.sep))); });

  // update the info of a song
  app.io.route('update_song_info', updateSongInfo);

  // get similar songs
  app.io.route('similar_songs', getSimilarSongs);
  app.io.route('youtube_search', getYoutubeSongs);
};

function musicRoute(req, res) {
  // test if client is mobile
  let md = new MobileDetect(req.headers['user-agent']);

  // get ip (for syncing functions)
  util.getip(function(ip) {
    // the function to send the homepage only when the config is finished initalizing
    var sendHome = function() {
      var config = app.get('config');
      // render the view
      res.render((md.mobile() ? 'mobile' : 'index'), {
        menu: !md.mobile(),
        app_name: config.app_name,
        music_dir: config.music_dir,
        music_dir_set: config.music_dir_set,
        country_code: config.country_code,
        auth: ('auth' in config) ? config.auth : {},
        player_themes: config.player_themes,
        default_theme: config.player_themes[0],
        random_array: [1,2,3,4],
        ip: ip + ':' + app.get('port'),
        remote_name: req.params.name,
        demo: config.demo,
        is_electron: config.is_electron,
      });
    };

    // logic to wait for config to initialise
    var config = app.get('config');
    if (config.initialized) {
      sendHome();
    } else {
      config.initializedFn = sendHome;
    }
  });
}

function sendSong(req, res) {
  app.db.songs.findOne({_id: req.params.id}, function(err, song) {
    if (err || !song) {
      res.status(404).send();
    } else {
      res.sendFile(path.join(app.get('config').music_dir, song.location));
    }
  });
}

function sendCover(req, res) {
  // if they passed the location of the cover, fetch it
  if (req.params.id.length > 0) {
    res.sendFile(app.get('configDir') + '/dbs/covers/' + req.params.id);
  } else {
    res.sendFile(app.get('root') + '/static/images/unknown.png');
  }
}

function downloadPlaylist(req, res) {
  app.db.playlists.findOne({_id: req.params.id}, function(err, playlist) {
    if (err) throw err;

    // create zip
    var archive = archiver('zip');
    async.forEach(playlist.songs, function(item, callback) {
      app.db.songs.findOne({_id: item._id}, function(err, song) {
        if (err) throw err;
        var zip_location = song.location;

        var song_location = path.join(app.get('config').music_dir, song.location);

        archive.append(fs.createReadStream(song_location), {name: zip_location});
        callback();
      });
    }, function(err) {
      if (err) {
        console.error(err);
        return;
      }
      // set the response headers and set the archiver to pipe on finish
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-disposition', 'attachment; filename=download.zip');
      archive.pipe(res);

      // trigger the piping of the archive
      archive.finalize();
    });
  });
}

function uploadSong(req, res) {
  if (app.get('config').demo) return;
  var fstream;
  var uploadedFiles = [];
  req.pipe(req.busboy);
  console.log('uploading files');
  req.busboy.on('file', function (fieldname, file, filename) {
    if (!lib_func.isValidSong(filename)) { console.log('invalid file ' + filename); return;}
    console.log("Uploading: " + filename);
    var odir = path.join(app.get('config').music_dir, 'upload');
    mkdirp(odir).then(function (err) {
      if (err) {
        console.error(err);
        return;
      }

      uploadedFiles.push(path.join('/upload', filename));
      fstream = fs.createWriteStream(path.join(odir, filename));
      file.pipe(fstream);
      fstream.on('close', function () {
        // done!
      });
    });
  });
  req.busboy.on('finish', function() {
    console.log('Done uploading!');
    res.send('ok');
    res.end();
    lib_func.scanItems(uploadedFiles);
  });
}

function returnSongs(req) {
  get_songs(function(songs) {
    req.socket.emit('songs', {songs: songs});
  });
}

function get_songs(callback) {
  app.db.songs.find({}, function(err, songs) {
    if (!err) {
      callback(songs);
    } else {
      callback([]);
    }
  });
}

function returnPlaylists(req) {
  // send the playlists back to the user
  get_playlists(function(playlists) {
    req.socket.emit('playlists', {playlists: playlists});
  });
}

function get_playlists(callback) {
  app.db.playlists.find({}).sort({ title: 1 }).exec(function(err, docs) {
    if (err) {
      console.error(err);
      return;
    }
    let playlists = docs;

    // create a new playlist for the library
    getLibraryIds(function(result) {
      // add library
      playlists.unshift({
        _id: 'LIBRARY',
        title: 'Library',
        songs: result,
        editable: false,
      });

      // add queue
      playlists.unshift({
        _id: 'QUEUE',
        title: 'Queue',
        songs: [], // populated by client
        editable: false,
      });

      // send the playlists back to the user
      callback(playlists);
    });
  });
}

// get the _id's of every song in the library
function getLibraryIds(callback) {
  app.db.songs.find({}).sort({ title: 1 }).exec(function(err, docs) {
    if (err) {
      console.error(err);
      return;
    }

    for (var i = 0; i < docs.length; i++) {
      docs[i] = {_id: docs[i]._id};
    }

    callback(docs);
  });
}

function createPlaylist(req) {
  let plist = {
    title: req.data.title,
    songs: req.data.songs,
    editable: true,
  };
  app.db.playlists.insert(plist, function(err, doc) {
    if (err) {
      console.error(err);
      return;
    }
    req.io.route('fetch_playlists');
  });
}

function renamePlaylist(req) {
  var id = req.data.id;
  var title = req.data.title;
  app.db.playlists.update({_id: id}, { $set: {title: title} }, function() {
    req.io.route('fetch_playlists');
  });
}

function deletePlaylist(req) {
  let del = req.data.del;
  app.db.playlists.remove({_id: del}, {}, function(err, numRemoved) {
    if (err) {
      console.error(err);
      return;
    }

    req.io.route('fetch_playlists');
  });
}

function addToPlaylist(req) {
  let addItems = req.data.add;
  let to = req.data.playlist;

  // pull the playlists database
  app.db.playlists.findOne({ _id: to}, function(err, doc) {
    if (err) {
      console.error(err);
      return;
    } else if (!doc) {
      console.error('doc was null', doc);
      return;
    }

    // used as a counter to count how many still need to be added
    let waitingOn = 0;

    // prep function for use in loop
    var checkFinish = function() {
      if (--waitingOn === 0) {
        req.io.route('fetch_playlists');
      }
    };

    // run loop
    for (var i = 0; i < addItems.length; i++) {
      var found = false;
      for (var j = 0; j < doc.songs.length; j++) {
        if (doc.songs[j]._id == addItems[i]) {
          found = true;
          break;
        }
      }

      if (!found) {
        waitingOn++;
        app.db.playlists.update({_id: to}, { $push:{songs: {_id: addItems[i]}}}, checkFinish);
      }
    }
  });
}

function removeFromPlaylist(req) {
  let removeItems = req.data.remove;
  let to = req.data.playlist;
  app.db.playlists.findOne({ _id: to}, function(err, doc) {
    if (err) {
      console.error(err);
      return;
    }

    var tmpSongs = [];
    for (var i = 0; i < doc.songs.length; i++) {
      if (removeItems.indexOf(doc.songs[i]._id) == -1) {
        tmpSongs.push(doc.songs[i]);
      }
    }

    app.db.playlists.update({_id: to}, { $set:{songs: tmpSongs}}, function() {
      req.io.route('fetch_playlists');
    });
  });
}

function songMovedInPlaylist(req) {
  var playlist_id = req.data.playlist_id;
  var oldIndex = req.data.oldIndex;
  var newIndex = req.data.newIndex;
  app.db.playlists.findOne({ _id: playlist_id}, function(err, playlist) {
    if (err) {
      console.error(err);
      return;
    }

    // remove the item from it's old place
    var item = playlist.songs.splice(oldIndex, 1)[0];

    // add the item into it's new place
    playlist.songs.splice(newIndex, 0, item);

    // update the playlist with the new order
    app.db.playlists.update({_id: playlist_id}, { $set:{songs: playlist.songs}});
  });
}

// update song play count
function updatePlayCount(req) {
  var _id = req.data.track_id;
  var plays = req.data.plays;

  // apply the new play_count to the database
  app.db.songs.update({_id: _id}, { $set: { play_count: plays } });
}

// force rescan of a set of items
function rescanItem(req) {
  var items = req.data.items;
  var songLocArr = [];
  app.db.songs.find({ _id: { $in: items }}, function(err, songs) {
    if (!err && songs)

        // add the location to the list of songs to scan
      for (var i = 0; i < songs.length; i++) {
        songLocArr.push(songs[i].location);
      }

    lib_func.scanItems(songLocArr);
  });
}

// delete song items
function deleteItems(req) {
  var items = req.data.items;
  app.db.songs.find({ _id: { $in: items }}, function(err, songs) {
    if (err) {
      console.error(err);
      return;
    }

    for (var i = 0; i < songs.length; i++) {
      let song = songs[i].location;
      fs.unlink(path.join(app.get('config').music_dir, song), function (err) {
        if (err) {
          console.error(err);
          return;
        }
        // this will remove the song from the library
        lib_func.scanItems([song]);
      });
    }
  });
}


// update the details for a song
function updateSongInfo(req) {
  // update the details about the song in the database (minus the cover)
  app.db.songs.update({_id: req.data._id}, {
    $set: {
      title: req.data.title,
      display_artist: req.data.artist,
      album: req.data.album,
      start_play_at: req.data.start_play_at,
      end_play_at: req.data.end_play_at,

      // it has been modified, update it
      date_modified: Date.now(),
    },
  });

  // update the cover photo
  var cover = req.data.cover;
  if (cover !== null) {
    // function to be called by both download file and file upload methods
    var process_cover = function(type, content_buffer) {
      var cover_filename = md5(content_buffer) + '.' + type;
      var location = app.get('configDir') + '/dbs/covers/' + cover_filename;
      fs.exists(location, function(exists) {
        if (!exists) {
          fs.writeFile(location, content_buffer, function(err) {
            if (err) {
              console.log(err);
            } else {
              console.log('Wrote cover here: ' + location);
            }
          });
        }

        // update the songs cover even if the image already exists
        app.db.songs.update({display_artist: req.data.artist, album: req.data.album}, {
          $set: {
            cover_location: cover_filename,
          },
        }, { multi: true }, function(err, numReplaced) {
          if (err) {
            console.error(err);
            return;
          }

          app.db.songs.find({display_artist: req.data.artist, album: req.data.album}, function(err, tracks) {
            if (err) {
              console.error(err);
              return;
            }

            app.io.sockets.emit('song_update', tracks);
          });
        });
      });
    };

    // different methods of setting cover
    if (req.data.cover_is_url && req.data.cover_is_lastfm) {
      // they fetched the cover from lastfm
      request(cover, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          var type = response.headers['content-type'].split('/').pop();
          process_cover(type, body);
        }
      });
    } else {
      // they dropped a file to upload
      var image = util.decodeBase64Image(cover);
      process_cover(image.type, image.data);
    }
  }
  
  // save the ID3 tags
  app.db.songs.findOne({_id: req.data._id}, function(err, song) {
    if (err || !song) {
    } else {
        lib_func.saveID3(song);
    }
  });
}

// write the tags (metadata) from the database to the files for the given items
function rewriteTags(req) {
  var items = req.data.items;
  app.db.songs.find({ _id: { $in: items }}, function(err, songs) {
    if (!err && songs) {
      // write the tags for all the given files
      for (var i in songs) {
        lib_func.saveID3(songs[i]);
      }
    }
  });
}

// controller routes
function remoteCommandInterface(req, res) {
  var config = app.get('config');

  var allReceivers = getReceiverList();
  var validReceivers = [];
  for (var index in allReceivers) {
    var client = allReceivers[index];
    if (client.name &&
      client.name.length > 0) {
      validReceivers.push(client.name);
    }
  }

  // render the view
  res.render('remote', {
    app_name: config.app_name,
    current_remotes: validReceivers,
    possible_commands: ['prev', 'next', 'playpause', 'volup', 'voldown', 'repeat', 'shuffle', 'sleeptimer']
  });
}

function remoteCommand(req, res) {
  // get params
  var command = req.params.command;
  var name = req.params.name;

  // bool to see if server was found
  var command_sent = false;

  // find destination machine and send the command
  var receivers = getReceiverList();
  for (var index in receivers) {
    var client = receivers[index];
    if (client.name &&
      client.name.length > 0 &&
      client.name == name) {
      client.emit('command', {command: command});

      // mark it as sent
      command_sent = true;
    }
  }

  if (command_sent) {
    res.send('OK');
  } else {
    res.send('NAME_NOT_FOUND');
  }
}

function setCompName(req) {
  req.socket.join('receivers');
  req.socket.name = req.data.name;
}

function getReceiverList(req) {
  var namespace = '/';
  var receiversRoom = 'receivers';
  var users = [];

  if (!(app.io.of(namespace).adapter.rooms.hasOwnProperty(receiversRoom))) return [];

  for (var id in app.io.of(namespace).adapter.rooms[receiversRoom].sockets) {
    users.push(app.io.of(namespace).adapter.nsp.connected[id]);
  }

  return users;
}

function getReceiversMinusThis(req) {
  var receivers = getReceiverList();
  var validReceivers = [];
  for (var index in receivers) {
    var client = receivers[index];
    if (client.name && client.name.length > 0) {
      validReceivers.push({
        id: client.id,
        name: client.name,
      });
    }
  }

  req.socket.emit('recievers', {recievers: validReceivers});
}

// sync routes
function syncPageConnected(req) {
  // get the playlist data
  get_playlists(function(playlists) {
    // get the songs data
    get_songs(function(songs) {
      req.socket.emit('alldata', {playlists: playlists, songs: songs});
    });
  });
}

// the playlists to sync have been selected, sync them
function syncPlaylists(req) {
  var lists = req.data.playlists;

  // function for within loop
  var playlistResult = function(err, numReplaced, newDoc) {
    if (err) {
      console.error(err);
      return;
    }

    if (newDoc) {
      console.log('Inserted playlist: ' + newDoc.title);
    } else {
      console.log('Updated playlist');
    }
  };

  // loop over lists to join editable lists
  for (var list_cnt = 0; list_cnt < lists.length; list_cnt++) {
    // attempt to replace the playlist if it is editable
    if (lists[list_cnt].editable) {
      app.db.playlists.update({_id: lists[list_cnt]._id}, lists[list_cnt], {upsert: true}, playlistResult);
    }
  }

  var songs = req.data.songs;
  var remote_url = req.data.remote_url;
  lib_func.sync_import(songs, remote_url);
}

// download the soundcloud/youtube song
function youtubeDownload(req) {
  if (req.data.url.match(/soundcloud\.com/g)) {
    lib_func.scDownload(req.data.url);
  } else {
    lib_func.ytDownload({url: req.data.url});
  }
}

function youtubeImport(req) {
  var queue = async.queue(function(result, next) {
    // augment the song info object with the url needed
    result.url = 'https://www.youtube.com/watch?v=' + result.youtube_id;
    lib_func.ytDownload(result, next);
  }, app.get('config').youtube.parallel_download);

  // add all the items to the queue
  queue.push(req.data.songs);
}

// update the app settings
function updateSettings(req) {
  // emit the settings updated message to the client
  req.socket.emit('message', {message: 'Settings Updated'});

  // update the settings
  if (req.data.music_dir) {
    // first remove all music_dir settings
    app.db.settings.remove({key: 'music_dir'}, {multi: true}, function() {
      // add a new one in
      app.db.settings.insert({key: 'music_dir', value: req.data.music_dir}, function() {
        // update config
        app.get('config').music_dir = req.data.music_dir;
        app.get('config').music_dir_set = true;
      });
    });
  }

  if (req.data.country_code) {
    // first remove all country_code settings
    app.db.settings.remove({key: 'country_code'}, {multi: true}, function() {
      // add a new one in
      app.db.settings.insert({key: 'country_code', value: req.data.country_code}, function() {
        // update config
        app.get('config').country_code = req.data.country_code;
      });
    });
  }
}

// fetch the similar songs for a given title and artist
function getSimilarSongs(req) {
  var title = req.data.title;
  var artist = req.data.artist;

  similarSongs.find({
    title: title,
    artist: artist,
    limit: req.data.limit || 50,
    lastfmAPIKey: '4795cbddcdec3a6b3f622235caa4b504',
    lastfmAPISecret: 'cbe22daa03f35df599746f590bf015a5',
    youtubeAPIKey: app.get('config').youtube.api,
  }, function(err, songs) {
    if (err) {
      console.log(err);

      // if it couldn't find it, just pass that through
      if (err.message == 'Track not found') {
        err = null;
        songs = [];
      }
    }

    req.socket.emit('similar_songs', {
      error: err,
      songs: songs,
      url: 'mix/' + encodeURIComponent(title),
      title: "Instant mix for: '" + title + "' by '" + artist + "'",
    });
  });
}
function getYoutubeSongs(req) {
  var search = req.data.search;

  songSearch.search({
    search: search,
    limit: req.data.limit || 50,
    itunesCountry: app.get('config').country_code,
    youtubeAPIKey: app.get('config').youtube.api,
  }, function(err, songs) {
    if (err) {
      console.log(err);
      songs = [];
      return;
    }

    req.socket.emit('similar_songs', {
      error: err,
      songs: songs,
      url: 'searchyt/' + encodeURIComponent(search),
      title: "Youtube listings for: '" + search + "'",
    });
  });
}
