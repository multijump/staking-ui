module.exports = function() {
    $.gulp.task("styles", function() {
        return $.gulp.src(["./src/sass/*.{scss,sass}", "!./src/sass/**/_*.{scss,sass}", "!./src/vendor/**/*.css"])
            .pipe($.plumber())
            .pipe($.sourcemaps.init())
            .pipe($.sass())
            .pipe($.autoprefixer())
            .pipe($.replace("../../../"+$.path.dest, "../")) // replaces paths in generated .scss files and if you choose file relatively in the sources/src dirs
            .pipe($.mincss({compatibility: "*", level: {1: {specialComments: 0}}})) // * — means IE 10+, also possible ie9, ie8
            .pipe($.plumber.stop())
            .pipe($.sourcemaps.write("./maps/"))
            .pipe($.gulp.dest("./"+$.path.dest+"css/"))
            .pipe($.debug({"title": "styles"}))
            .pipe($.browsersync.stream())
            .pipe($.touch());
    });
};