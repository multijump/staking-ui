module.exports = function() {
    $.gulp.task("fresh", function() {
        
        $.gulp.src("./src/pug/index.pug")
            .pipe($.replace(/^.*test.*$/gm, ""))
            .pipe($.gulp.dest("./src/pug/"))
            .pipe($.debug({"title": "Fresh index.pug"}));
        $.gulp.src("./src/sass/main.sass")
            .pipe($.replace(/^.*test.*$/gm, ""))
            .pipe($.gulp.dest("./src/sass/"))
            .pipe($.debug({"title": "Fresh main.sass"}));
        $.gulp.src("./src/sass/base/_sprite_generated.scss")
            .pipe($.replace(/.*/gm, ""))
            .pipe($.gulp.dest("./src/sass/base/"))
            .pipe($.debug({"title": "Fresh _sprite_generated.sass"}));
        $.gulp.src("./src/js/main.js")
            .pipe($.replace(/^.*(console|fun\(|^fun|let|const|return|\/\/ Let|\}$).*$\n/gm, ""))
            .pipe($.gulp.dest("./src/js/"))
            .pipe($.debug({"title": "Fresh main.js"}));

        return $.gulp.src([
                "./src/sass/blocks/index-test-block.sass",
                "./src/fonts/test.woff",
                "./src/html_direct_copying/test_folder",
                "./src/images/skip-optimization/skipped-optim.png",
                "./src/images/skip-optimization/skipped-optim.svg",
                "./src/images/sprite-svg/clock.svg",
                "./src/images/sprite-svg/money-hover.svg",
                "./src/images/sprite-svg/money.svg",
                "./src/images/sprite-svg/personal-hover.svg",
                "./src/images/sprite-svg/personal.svg",
                "./src/images/sprite-svg/phone-rounded.svg",
                "./src/images/webp/about@1x.jpg",
                "./src/images/webp/about@2x.jpg",
                "./src/images/webp/games-bg.png",
                "./src/images/webp/sk-setmenu.webp",
                "./src/images/about@1x.jpg",
                "./src/images/about@2x.jpg",
                "./src/images/games-bg.png",
                "./src/images/optim.png",
                "./src/images/optim.svg",
                "./src/js/test.json",
                "./src/pug/blocks/index-test-block.pug",
                "./src/pug/sub-folder/sub-page.pug",
                "./src/pug/sub-folder",
                "./src/sass/blocks/index-test-block.sass"
                // "",
            ], {read: false, allowEmpty: true})
            .pipe($.clean())
            .pipe($.debug({"title": "Removed"}));
    });
};