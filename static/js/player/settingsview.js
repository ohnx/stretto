var save_func = function() {
  music_dir = $('#music_dir_val').val();
  country_code = $('#country_code').val();
  var player_theme_old = player_theme;
  player_theme = $('#player_theme').val();
  localStorage.setItem('theme', player_theme);
  socket.emit('update_settings', {music_dir: music_dir, country_code: country_code});
  if (player_theme != player_theme_old) setTimeout(function(){location.reload()}, 100);
};

var showSettings = function(message) {
  // render the template
  var options = {
    music_dir: music_dir,
    country_code: country_code,
    message: message,
  };
  var body = render('#settings_template', options);

  // show the dialog
  bootbox.dialog({
    title: 'Settings',
    message: body,
    buttons: {
      success: {
        label: 'Save',
        className: 'btn-success',
        callback: save_func,
      },
      main: {
        label: 'Close Without Saving',
        className: 'btn-default',
      },
    },
  });
};
