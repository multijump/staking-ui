module.exports = function() {
    $.gulp.task("images", function() {
        // Just direct copying
        $.gulp.src("./src/images/skip-optimization/**/*")
            .pipe($.newer("./"+$.path.dest+"images/"))
            .pipe($.gulp.dest("./"+$.path.dest+"images/"));

        // WebP optimization
        $.gulp.src("./src/images/webp/**/*")
            .pipe($.newer({dest: "./"+$.path.dest+"images/", ext: ".webp"}))
            .pipe($.webp({quality: 85}))
            .pipe($.gulp.dest("./"+$.path.dest+"images/"));

        // Standart optimization
        return $.gulp.src(["./src/images/**/*",
                    "!./src/images/skip-optimization",
                    "!./src/images/skip-optimization/**/*",
                    "!./src/images/sprite-*",
                    "!./src/images/sprite-*/**/*",
                    "!./src/images/webp",
                    "!./src/images/webp/**/*",
                    "!./src/images/favicons/**/*"])
            .pipe($.newer("./"+$.path.dest+"images/"))
            .pipe($.imagemin([
                $.imagemin.gifsicle({interlaced: true}),
                $.imageminJpegRecompress({
                    progressive: true,
                    accurate: true,
                    subsample: "disable",
					max: 80,
					min: 70
				}),
                $.imagemin.svgo({plugins: [{removeViewBox: false}]}),
                $.imagemin.optipng({optimizationLevel: 1}),
                $.pngquant({quality: [0.6, 0.95], speed: 3})
            ]))
            .pipe($.gulp.dest("./"+$.path.dest+"images/"))
            .pipe($.debug({"title": "images"}))
            .on("end", $.browsersync.reload);
    });
};