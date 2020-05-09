# Stretto API

If authentication is enabled, all requests MUST be sent with an HTTP Basic
Authentication username/password.

## Playlists

### `/playlists`

Returns a JSON array of all playlist objects.

Each playlist object has the follow keys:

```
title: Title of the playlist
songs: Array of song objects in the playlist. Note that these song objects only
have the `_id` field and nothing else!
editable: ignore
_id: Playlist ID
```

## Songs

### `GET /songs`

Returns a JSON array of all song objects.

Each song object has the following keys:

```
title: the title of the song
album: the name of the song's album
artist: the artist(s) of the song
albumartist: ignore
display_artist: ignore
genre: ignore
year: ignore
disc: ignore
track: ignore
duration: duration of song, in seconds
play_count: number of times this song has been played
location: location on the disk
date_added: ignore
date_modified: ignore
_id: song ID; use this to fetch the song itself
cover_location: corresponding cover ID for the album that this song is in
```

### `GET /songs/<song_id>.mid`

Path for all of the song files themselves. Fill `<song_id>` with the corresponding
`song_id` that is desired to be fetched.

## Album art

### `/cover/<cover_location>`

Fetches the corresponding cover. Fill `<cover_location>` with the corresponding
`cover_location` that is desired to be fetched.
