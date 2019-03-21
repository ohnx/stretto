module.exports = function(grunt) {
  let bootswatchThemes = ['cerulean','cosmo','cyborg','darkly','flatly','journal','lumen','paper','readable','sandstone','simplex','slate','spacelab','superhero','united','yeti'];
  let customThemes = ['darkforest', 'zesty'];
  let lessTasks = {};
  let borkedThemes = ['cerulean', 'slate'];

  for (var i = 0; i < bootswatchThemes.length; i++) {
    lessTasks[bootswatchThemes[i]] = {
      options: {
        modifyVars: {
          theme_using: bootswatchThemes[i]
        }
      },
      files: {}
    };
    if (borkedThemes.includes(bootswatchThemes[i])) {
      /* some themes don't have @web-font-path set, so they get borked by an undefined variable */
      /* I would've loved to have some sort of "if undefined" thing, but apparently that doesn't exist in less */
      lessTasks[bootswatchThemes[i]].options.modifyVars['web-font-path'] = 'potato';
    }
    lessTasks[bootswatchThemes[i]].files['static/css/themes/' + bootswatchThemes[i] + '.css'] = 'static/less/bootswatch.less';
    
  }

  for (var i = 0; i < customThemes.length; i++) {
    lessTasks[customThemes[i]] = {
      options: {},
      files: {}
    };
    lessTasks[customThemes[i]].files['static/css/themes/' + customThemes[i] + '.css'] = 'static/less/' + customThemes[i] + '.less';
  }

  // Project configuration.
  grunt.initConfig({
    http: {
      jquery: {
        options: {
          url: 'https://code.jquery.com/jquery-2.2.4.js',
        },
        dest: 'node_modules/jquery/dist/jquery.js'
      }
    },
    // because grunt-bower-task doesn't correctly move font-awesome
    copy: {
      fontawesome_fonts: {
        src: 'node_modules/font-awesome/fonts/*',
        dest: 'static/lib/font-awesome-bower/fonts/',
        expand: true, flatten: true, filter: 'isFile',
      },
      fontawesome_css: {
        src: 'node_modules/font-awesome/css/*',
        dest: 'static/lib/font-awesome-bower/css/',
        expand: true, flatten: true, filter: 'isFile',
      },
      headjs: {
        src: 'node_modules/headjs/dist/1.0.0/head.min.js',
        dest: 'static/lib/head.min.js',
      },
    },
    uglify: {
      options: {
        mangle: false,
      },
      my_target: {
        files: [
          {
            src: [
              'node_modules/jquery/dist/jquery.js',
              'node_modules/jquery-ui/ui/core.js',
              'node_modules/jquery-ui/ui/widget.js',
              'node_modules/jquery-ui/ui/position.js',
              'node_modules/jquery-ui/ui/menu.js',
              'node_modules/jquery-ui/ui/mouse.js',
              'node_modules/jquery-ui/ui/sortable.js',
              'node_modules/underscore/underscore.js',
              'node_modules/backbone/backbone.js',
              'node_modules/backbone.babysitter/lib/backbone.babysitter.js',
              'node_modules/backbone.wreqr/lib/backbone.wreqr.js',
              'node_modules/backbone.marionette/lib/backbone.marionette.js',
              'node_modules/bootstrap/dist/js/bootstrap.min.js',
              'node_modules/bootstrap-slider/dist/bootstrap-slider.js',
              'node_modules/bootbox/bootbox.js',
              'node_modules/messenger/build/js/messenger.min.js',
              'node_modules/civswig/swig.min.js',
              'node_modules/datejs/build/production/date.min.js',
              'node_modules/lastfm-api/lastfm-api.js',
            ],
            dest: 'static/lib/libs.min.js',
            nonull: true,
            sourceMap: true
          }
        ]
      }
    },
    /* css tasks now */
    less: lessTasks,
    cssmin: {
      options: {
        shorthandCompacting: false,
        roundingPrecision: -1,
      },
      target: {
        files: {
          'static/lib/libs.min.css': [
            'node_modules/messenger/build/css/messenger.css',
            'node_modules/messenger/build/css/messenger-theme-air.css',
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-http');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');

  grunt.registerTask('default', ['http', 'copy', 'uglify', 'less', 'cssmin']);
};
