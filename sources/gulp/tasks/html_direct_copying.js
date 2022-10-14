module.exports = function() {
    $.gulp.task("html_direct_copying", function() {
        // Just direct copying
        return $.gulp.src("./src/html_direct_copying/**/*")
            .pipe($.newer("./"+$.path.dest))
            .pipe($.gulp.dest("./"+$.path.dest))
            .pipe($.debug({"title": "html_direct_copying"}));
    });
};