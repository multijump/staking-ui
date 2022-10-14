module.exports = function() {
    $.gulp.task("fonts", function() {
        return $.gulp.src("./src/fonts/**/*")
            
            .pipe($.gulp.dest($.path.dest+"fonts/"))
            .pipe($.debug({"title": "fonts"}));
    });
};