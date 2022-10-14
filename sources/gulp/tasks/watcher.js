module.exports = function() {
    $.gulp.task("watcher", function() {
        return new Promise((res, rej) => {
            $.watch(["./src/pug/**/*.pug"], $.gulp.series("pug"));
            $.watch("./src/sass/**/*.{scss,sass}", $.gulp.series("styles"));
            $.watch("./src/fonts/**/*", $.gulp.series("fonts"));
            $.watch(["./src/images/**/*", "!./src/images/sprite-*/**/*", "!./src/images/favicons/**/*"], $.gulp.series("images"));
            $.watch("./src/images/sprite-svg/*.svg", $.gulp.series("sprite"));
            $.watch("./src/js/**/*.{js,json}", $.gulp.series("scripts"));
            $.watch("./src/html_direct_copying/**/*", $.gulp.series("html_direct_copying"));
            res();
        });
    });
};