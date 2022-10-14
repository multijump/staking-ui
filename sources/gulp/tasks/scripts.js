module.exports = function () {
    $.gulp.task("scripts", function () {
        var libs_file = "src/js/_libs_concat.js";

        delete require.cache[require.resolve("../../"+libs_file)];
        var libs_files = require("../../"+libs_file);

        // Json Direct copying
        $.gulp.src("./src/js/**/*.json")
            .pipe($.gulp.dest("./"+$.path.dest+"js/"));

        return $.gulp.src(["./src/js/**/*.js", "!./"+libs_file])
            .pipe($.babel({presets: ["@babel/preset-env"]}))
            .pipe($.uglify()) // Comment this line if not needed minification
            .pipe(libs_files.length ? $.addsrc.prepend(libs_files) : $.tap(function(){}))
            .pipe($.replace(".html?", "?"))
            .pipe($.replace(/^.*sourceMappingURL.*$/gm, ""))
            // .pipe($.concat("main.js")) // Comment this line if not needed contactation to one file
            .pipe($.gulp.dest("./"+$.path.dest+"js/"))
            .pipe($.debug({"title": "scripts"}))
            .pipe($.browsersync.stream());
    });
};