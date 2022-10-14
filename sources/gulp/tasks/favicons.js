module.exports = function() {
    $.gulp.task("favicons", function() {
        return $.gulp.src("./src/images/favicons/*.*")
            // .pipe($.favicons({
            //     path: "./",
            //     appName: "",
            //     appShortName: "",
            //     appDescription: "",
            //     icons: {
            //         appleIcon: true,
            //         favicons: true,
            //         online: false,
            //         appleStartup: false,
            //         android: true,
            //         firefox: false,
            //         yandex: true,
            //         windows: true,
            //         coast: false
            //     }
            // }))
            .pipe($.gulp.dest($.path.dest+"images/favicons/"))
            .pipe($.debug({"title": "favicons"}));
    });
};