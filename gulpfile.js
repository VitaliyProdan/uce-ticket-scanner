var args = require('yargs').argv,
    gulp = require('gulp'),
    isProd = args.prod != null;

gulp.task('watch', ['compile-less'], function () {
  // Watch files and run tasks if they change
    return gulp.watch('less/*.less', ['compile-less']);
});

// Clean then build
gulp.task('build', function (cb) {
    var runSequence = require('run-sequence');
    runSequence('clean-dist',
                'minify',
                'copy-static',
                cb);
});

gulp.task('minify', ['compile-less'], function () {
    var util = require('gulp-util'),
        uglify = require('gulp-uglify'),
        usemin = require('gulp-usemin'),
        minifyCss = require('gulp-minify-css'),
        opts = { css: [], jslib: [], jsapp: [] };

    if (isProd) {
        // Uglify prod builds
        util.log("Minifying JavaScript for production build");
        opts.css = [ minifyCss(), 'concat' ];
        opts.jsapp.push(uglify());
    } else {
      opts.jstest = [];
    }

    return gulp.src('*.html')
               .pipe(usemin(opts))
               .pipe(gulp.dest('dist'));
});

gulp.task('phonegap', function (cb) {
    var runSequence = require('run-sequence');
    runSequence('bump-version',
                'build',
                'copy-dist',
                cb);
});

gulp.task('zip-dist', function (cb) {
    var fs = require('fs'),
        archiver = require('archiver'),
        output = fs.createWriteStream('./dist.zip'),
        archive = archiver('zip');

    output.on('close', cb);
    archive.on('error', function (err) { throw err; });

    archive.pipe(output);

    archive.bulk([{
        expand: true,
        cwd: './dist/',
        src: ['**', '.*']
    }]);

    archive.finalize();
});

gulp.task('copy-dist', function () {
    return gulp.src([ 'dist/**' ],
                    { base: './dist/' })
               .pipe(gulp.dest('../Dist'));
});

gulp.task('bump-version', function (cb) {
    var fs = require('fs-extra'),
        util = require('gulp-util'),
        xmldom = require('xmldom'),
        config,
        oldVersion,
        version,
        toks,
        val,
        doc;

    config = fs.readFileSync('config.xml', { encoding: 'utf-8' });
    doc = new xmldom.DOMParser().parseFromString(config, 'text/xml');

    if (args.buildVersion != null) {
        version = args.buildVersion;
        util.log('  Using specified buildVersion ' + version);
    } else {
        oldVersion = version = doc.documentElement.getAttribute('version');
        toks = version.split('.');
        val = parseInt(toks.pop(), 10) + 1;
        toks.push(val);
        version = toks.join('.');
        util.log('  Bumped version from ' + oldVersion + ' to ' + version);
    }

    doc.documentElement.setAttribute('version', version);
    fs.writeFileSync('config.xml', new xmldom.XMLSerializer().serializeToString(doc));

    cb();
});

// Mimic:
//
//   curl -u mobility@judge.com:Password56
//        -X PUT
//        -F file=@./dist.zip
//        https://build.phonegap.com/api/v1/apps/375691
//
// gulp.task('upload', function (cb) {
//     var fs = require('fs-extra'),
//         request = require('request');

//     function callback(err, res, body) {
//         if (err) { throw err; }
//         console.log("Response: " + body);
//         cb();
//     }

//     fs.createReadStream('dist.zip')
//       .pipe(request.put('https://build.phonegap.com/api/v1/apps/375691', {}, callback)
//                    .auth('mobility@judge.com', 'Password56', false));
// });

// Convert less/styles.less > css/styles.css
gulp.task('compile-less', function () {
    var less = require('gulp-less');
    return gulp.src('less/main.less')
               .pipe(less())
               .pipe(gulp.dest('css'));
});

// Copy all static assets to dist/
gulp.task('copy-static', ['copy-icon', 'copy-splash'], function () {
    return gulp.src(['img/**',
                     'icon/**',
                     'splash/**',
                     'config.xml',
                     '.nomedia'],
                    { base: './' })
               .pipe(gulp.dest('dist'));
});

gulp.task('copy-icon', function (cb) {
    var fs = require('fs-extra');
    fs.copy('icon/ios/icon.png', 'dist/icon.png', cb);
});

gulp.task('copy-splash', function (cb) {
    var fs = require('fs-extra');
    fs.copy('splash/ios/Default.png', 'dist/splash.png', cb);
});

gulp.task('zip', function () {
    var zip = require('gulp-zip');
    // ??? Why doesn't this include the splash/ directory or the .nomedia file?
    return gulp.src(['dist/**'])
               .pipe(zip('dist.zip'))
               .pipe(gulp.dest('.'));
});

// Remove build artifacts
gulp.task('clean', ['clean-dist'], function () {
    var clean = require('gulp-clean');
    return gulp.src(['css/main.css'], {read: false})
               .pipe(clean());
});

gulp.task('clean-dist', function () {
    var clean = require('gulp-clean');
    return gulp.src(['dist', 'dist.zip'], {read: false})
               .pipe(clean());
});

// Serve up the dev version of the app
gulp.task('serve', function () {
    var express = require('express'),
        app = express();
    app.use(express.static(__dirname));
    app.listen(8000);
});

gulp.task('serve-dist', function () {
    var express = require('express'),
        app = express();
    app.use(express.static(__dirname + '/dist'));
    app.listen(8000);
});
