module.exports = function () {
  $.gulp.task("pug", function () {
    return $.gulp
      .src([
        "./src/pug/**/*.pug",
        "!./src/pug/_*.pug",
        "!./src/pug/blocks/*.pug",
        "!./src/pug/base/*.pug",
      ])
      .pipe($.pug({ pretty: true }))
      .pipe($.replace(".html", ""))
      .pipe($.replace("../../" + $.path.dest, "")) // .pipe($.replace("../dest/", "../"))
      .pipe($.replace('.js"', `.js?timestamp=${Date.now()}"`))
      .pipe($.replace('main.css', `main.css?timestamp=${Date.now()}`))
      .pipe($.gulp.dest("./" + $.path.dest))
      .pipe($.debug({ title: "html" }))
      .on("end", $.browsersync.reload)
      .pipe($.touch());
  });
};
