/**
 * Created by Stephen on 30/11/2015.
 */

module.exports = function (grunt) {

    grunt.initConfig({
        htmlmin: {                                     // Task
            dist: {                                      // Target
                options: {                                 // Target options
                    removeComments: true,
                    collapseWhitespace: true
                },

                files: [
                    {
                        expand: true,     // Enable dynamic expansion.
                        flatten: true,
                        src: ['build/src/*.html'], // Actual pattern(s) to match.
                        dest: 'pages/',   // Destination path prefix.
                        ext: '.min.html',   // Dest filepaths will have this extension.
                        extDot: 'first'   // Extensions in filenames begin after the first dot
                    }
                ]
            }
        },
        cssmin: {
            options: {
                shorthandCompacting: false,
                roundingPrecision: -1
            },
            target: {
                files: [{
                    expand: true,
                    flatten: true,
                    src: ['build/css/*.css'],
                    dest: 'public/css',
                    ext: '.min.css'
                }]
            }
        },
        uglify: {
            options: {
                mangle: false
            },
            target: {
                files: [{
                    expand: true,
                    flatten: true,
                    src: ['build/js/*.js'],
                    dest: 'public/js',
                    ext: '.min.js'
                }]
            }
        },
        copy: {
            main: {
                files: [
                    {src: 'build/js/xregexp-build-moog.js', dest: 'public/js/xregexp-build-moog.js'},
                    {src: 'build/js/xregexp-build-moog.js', dest: 'lib/xregexp-build-moog.js'}
                ]
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-htmlmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-copy');

    grunt.loadNpmTasks('grunt-contrib-watch');


    grunt.registerTask('default', ['htmlmin', 'cssmin', 'uglify']);
};