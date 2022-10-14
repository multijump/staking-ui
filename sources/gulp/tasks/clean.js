module.exports = function() {
    $.gulp.task("clean", function() {
        return $.gulp.src($.path.dest+"*", {read: false})
            .pipe($.clean({force: true}))
            .pipe($.debug({"title": "clean"}));
    });
};