module.exports = function() {
    $.gulp.task("libs", function() {
        var modules = Object.keys($.packageJson.dependencies);

        if (modules.length){
            if (process.versions.pnp){ // Yarn 2
                const pnpApi = require('pnpapi');
                const {PosixFS, ZipOpenFS} = require(`@yarnpkg/fslib`);
                const libzip = require(`@yarnpkg/libzip`).getLibzipSync();
                // This will transparently open zip archives
                const zipOpenFs = new ZipOpenFS({libzip});
                // This will convert all paths into a Posix variant, required for cross-platform compatibility
                const crossFs = new PosixFS(zipOpenFs);
                
                modules.forEach(function(module) {
                    // Something like /full/path/to/.yarn/cache/jquery-npm-3.5.0-6db13a3f79-2.zip/node_modules/jquery/
                    var module_folder = pnpApi.resolveToUnqualified(module, process.cwd());
                    crossFs.copySync(process.cwd()+"/src/libs/"+module, module_folder, { overwrite: false });
                });
                return Promise.resolve();
            } else {
                var moduleFiles = modules.map(function(module) {
                    return "./node_modules/" + module + "/**/*";
                });
                return $.gulp.src(moduleFiles, {base: "./node_modules/"})
                    .pipe($.gulp.dest("./src/libs/"));
            }
        }
    });
};