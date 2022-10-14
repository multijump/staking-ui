global.$ = {
    gulp: require("gulp"),
    tap: require("gulp-tap"),
    browsersync: require("browser-sync").create(),
    packageJson: require('./package.json'),
    autoprefixer: require("gulp-autoprefixer"),
    babel: require("gulp-babel"),
    uglify: require("gulp-uglify"),
    pug: require("gulp-pug"),
    sass: require("gulp-sass"),
    mincss: require("gulp-clean-css"),
    sourcemaps: require("gulp-sourcemaps"),
    concat: require("gulp-concat"),
    addsrc: require('gulp-add-src'),
    imagemin: require("gulp-imagemin"),
    pngquant: require("imagemin-pngquant"),
    imageminJpegRecompress: require("imagemin-jpeg-recompress"),
    webp: require("gulp-webp"),
    favicons: require("gulp-favicons"),
    svgSprite: require('gulp-svg-sprite'),
    replace: require("gulp-replace"),
    newer: require("gulp-newer"),
    plumber: require("gulp-plumber"),
    debug: require("gulp-debug"),
    watch: require("gulp-watch"),
    clean: require("gulp-clean"),
    touch: require("gulp-touch-cmd"),

    path: {
        tasks: require("./gulp/config.js"),
        dest: '../html/', // or just 'html/', 'dest/' — for current folder. WARNING: This directory will be cleaned at build!
        sources: 'sources/' // or '/' — for current folder
    }
};

$.path.tasks.forEach(function(taskPath) {
    require(taskPath)();
});

// BUILD production
$.gulp.task("build", $.gulp.series("clean", "sprite", "libs", "fonts", "images",
    $.gulp.parallel("pug", "styles", "favicons", "scripts"),
    "html_direct_copying"
));

// BUILD unminified
$.gulp.task("build_unmin", $.gulp.series("clean", "sprite", "libs", "fonts", "images",
    $.gulp.parallel("pug_unmin", "styles_unmin", "favicons", "scripts_unmin"),
    "html_direct_copying"
));

// Watch
$.gulp.task("watch", $.gulp.parallel("watcher", "serve"));
// Watch unminified
$.gulp.task("watch_unmin", $.gulp.parallel("watcher_unmin", "serve"));

// Develop
$.gulp.task("develop", $.gulp.series("build_unmin", "watch_unmin"));

// Default
$.gulp.task("default", $.gulp.series("build", "watch"));

