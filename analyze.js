let app = {
  get: function() {return process.env.configDir || __dirname;}
};
require('./db.js')(app);
let db = app.db;
let songdb = app.db.songs;
const fs = require('fs');

// get all items in the songs db
songdb.find({}, function (err, docs) {
  let lens = [], lens2 = [];

  let out = 'title,album,year,plays,artist1,artist2,artist3,artist4\n';
  let out_oneart = 'title,album,year,plays,artist\n';
  let artists_songs = {};

  for (var i = 0; i < docs.length; i++) {
    let doc = docs[i];
    let artists = doc['display_artist'].split(/&|,/);
    let feat_artists = doc.title.match(/(.*) [(\[]feat\. (.*)[\])]/);
    let title = doc.title;
    if (feat_artists) {
      title = feat_artists[1].trim();
      feat_artists = feat_artists[2].split(/&|,/);
    } else {
      feat_artists = [];
    }
    out += `"${title.replace(/\"/g, '""')}","${doc.album.replace(/\"/g, '""')}",${doc.year},${doc.play_count}`;
    let all_artists = artists.concat(feat_artists);
    var j = 0;
    for (j = 0; j < all_artists.length; j++) {
      out += ',' + all_artists[j].trim();
      if (!(all_artists[j].trim() in artists_songs)) {
        artists_songs[all_artists[j].trim()] = "";
      }
      artists_songs[all_artists[j].trim()] += `"${title.replace(/\"/g, '""')}","${doc.album.replace(/\"/g, '""')}",${doc.year},${doc.play_count},${all_artists[j].trim()}\n`;
    }
    for (; j < 4; j++) {
      out += ',';
    }
    out += '\n';
  }

  fs.writeFile('analysis.csv', out, function(err) {
    if (err) console.error(err);
  });

  console.log(artists_songs);

  for (artist in artists_songs) {
    out_oneart += artists_songs[artist];
  }

  fs.writeFile('analysis_oneart.csv', out_oneart, function(err) {
    if (err) console.error(err);
  });
});
