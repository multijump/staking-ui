module.exports = function () {
  $.gulp.task("serve", function () {
    return new Promise((res, rej) => {
      $.browsersync.init({
        server: "./" + $.path.dest,
        tunnel: false,
        port: 9000
      });

      res();
    });
  });
};