'use strict';

let project_folder = require("path").basename(__dirname);
let source_folder = "#src";

let fs = require('fs');

let path = {
  build: {
    html: project_folder + "/",
    css: project_folder + "/css/",
    js: project_folder + "/js/",
    img: project_folder + "/img/",
    fonts: project_folder + "/fonts/",
    svg: project_folder + "/img/icons/",
    media: project_folder + "/media/",
  },
  src: {
    html: [source_folder + "/*.html", "!" + source_folder + "/_*.html"],
    css: source_folder + "/scss/style.scss",
    js: source_folder + "/js/**/*.js",
    img: source_folder + "/img/**/*.{jpg,png,svg,gif,ico,webp,JPG,PNG,SVG,GIF,ICO,WEBP}",
    fonts: source_folder + "/fonts/*.ttf",
    svg: source_folder + "/iconsprite/*.svg",
    media: source_folder + "/media/*.{mp4,ogv,avi,webm,mov}",
  },
  watch: {
    html: source_folder + "/**/*.html",
    css: source_folder + "/scss/**/*.scss",
    js: source_folder + "/js/**/*.js",
    img: source_folder + "/img/**/*.{jpg,png,svg,gif,ico,webp,JPG,PNG,SVG,GIF,ICO,WEBP}",
    fonts: source_folder + "/fonts/*.ttf",
    svg: source_folder + "/iconsprite/*.svg",
    media: source_folder + "/media/*.{mp4,ogv,avi,webm,mov}",
  },
  clean: "./" + project_folder + "/"
}

let isProd = false;

let { src, dest, parallel } = require('gulp'),
  gulp = require('gulp'),
  browsersync = require("browser-sync").create(),
  fileinclude = require("gulp-file-include"),
  del = require("del"),
  scss = require("gulp-sass"),
  autoprefixer = require("gulp-autoprefixer"),
  group_media = require("gulp-group-css-media-queries"),
  clean_css = require("gulp-clean-css"),
  rename = require("gulp-rename"),
  uglify = require("gulp-uglify-es").default,
  imagemin = require("gulp-imagemin"),
  svgSprite = require("gulp-svg-sprite"),
  ttf2woff = require("gulp-ttf2woff"),
  ttf2woff2 = require("gulp-ttf2woff2"),
  fonter = require("gulp-fonter"),
  webpack = require("webpack"),
  webpackStream = require("webpack-stream"),
  sourcemaps = require('gulp-sourcemaps'),
  notify = require('gulp-notify'),
  gulpif = require('gulp-if');

function browserSync(params) {
  browsersync.init({
      server: {
        baseDir: "./" + project_folder + "/",
      },
      port: 3000,
      notify: false,
  })
  watchFiles();
}

function html() {
  return src(path.src.html)
  .pipe(fileinclude({
      prefix: '@',
      basepath: '@file'
  }))
      .pipe(dest(path.build.html))
      .pipe(browsersync.stream())
}

function css() {
  return src(path.src.css)
      .pipe(sourcemaps.init())
      .pipe(
        scss({
            outputStyle: 'expanded'
        })
      )
      .pipe(
        group_media())
      .pipe(gulpif(isProd,
        autoprefixer({
            overrideBrowserslist: ["last 10 versions"],
            cascade: true
        })
      ))
      .pipe(gulpif(!isProd, sourcemaps.write('.')))
      .pipe(dest(path.build.css))
      .pipe(gulpif(isProd, clean_css()))
      .pipe(
        rename({
            extname: ".min.css"
        })
      )
      .pipe(dest(path.build.css))
      .pipe(browsersync.stream({match: '**/*.css'}))
}

function js() {
  return src(path.src.js)
  .pipe(gulpif(!isProd, sourcemaps.init()))
    .pipe(webpackStream({
      output: {
        filename: 'script.js',
      },
      module: {
        rules: [
          {
            test: /\.m?js$/,
            exclude: /node_modules/,
            use: {
              loader: 'babel-loader',
              options: {
                presets: [
                  ['@babel/preset-env', { targets: "defaults" }]
                ]
              }
            }
          }
        ]
      }
    }))
    .pipe(dest(path.build.js))
    .pipe(gulpif(isProd, uglify().on("Error", notify.onError())))
    .pipe(gulpif(!isProd, sourcemaps.write('.')))
    .pipe(dest(path.build.js))
    .pipe(browsersync.stream())
}

function images() {
  return src(path.src.img)
      .pipe(dest(path.build.img))
      .pipe(src(path.src.img))
      .pipe(imagemin([
        imagemin.gifsicle({interlaced: true}),
        imagemin.mozjpeg({quality: 85, progressive: true}),
        imagemin.optipng({optimizationLevel: 5}),
        imagemin.svgo({
          plugins: [
              {removeViewBox: true},
              {cleanupIDs: false}
          ]
        })
      ]))
      .pipe(dest(path.build.img))
      .pipe(browsersync.stream())
}

function fonts(params) {
  src(path.src.fonts)
      .pipe(ttf2woff())
      .pipe(dest(path.build.fonts));
  return src(path.src.fonts)
      .pipe(ttf2woff2())
      .pipe(dest(path.build.fonts));
}

gulp.task('otf2ttf', function () {
  return src([source_folder + '/fonts/*.otf'])
      .pipe(fonter({
        formats: ['ttf']
      }))
      .pipe(dest(source_folder + '/fonts/'));
})

function svgSprites(params) {
  return gulp.src([source_folder + '/iconsprite/*.svg'])
    .pipe(imagemin([
      imagemin.svgo({
        plugins: [
          { removeViewBox: true },
          { cleanupIDs: false }
        ]
      })
    ]))
    .pipe(svgSprite({
      mode: {
        stack: {
          sprite: "../icons.svg"
        }
      }
    }))
    .pipe(dest(path.build.svg))
}

function media(params) {
  return src(path.src.media)
  .pipe(dest(path.build.media))
}

function cb() {

}

function fontsStyle() {
  let file_content = fs.readFileSync(source_folder + '/scss/_fonts.scss');

  if (!file_content == '') {
    fs.writeFile(source_folder + '/scss/_fonts.scss', '', cb);
    return fs.readdir(path.build.fonts, function (err, items) {
      if (items) {
        let c_fontname;
        for (var i = 0; i < items.length; i++) {
          let fontname = items[i].split('.');
          fontname = fontname[0];
          let font = fontname.split('-')[0];
          let weight = checkWeight(fontname);

          if (c_fontname != fontname) {
            fs.appendFile(source_folder + '/scss/_fonts.scss', '@include font-face("' + font + '", "' + fontname + '", ' + weight + ', "normal");\r\n', cb);
          }
          c_fontname = fontname;
        }
      }
    })
  }
}

const checkWeight = (fontname) => {
  let weight = 400;
  switch (true) {
    case /Thin/.test(fontname):
      weight = 100;
      break;
    case /ExtraLight/.test(fontname):
      weight = 200;
      break;
    case /Light/.test(fontname):
      weight = 300;
      break;
    case /Regular/.test(fontname):
      weight = 400;
      break;
    case /Medium/.test(fontname):
      weight = 500;
      break;
    case /SemiBold/.test(fontname):
      weight = 600;
      break;
    case /Bold/.test(fontname):
      weight = 700;
      break;
    case /ExtraBold/.test(fontname):
      weight = 800;
      break;
    case /Black/.test(fontname):
      weight = 900;
      break;
  }
  return weight;
}

function watchFiles(params) {
  gulp.watch([path.watch.html], html);
  gulp.watch([path.watch.css], css);
  gulp.watch([path.watch.js], js);
  gulp.watch([path.watch.img], images);
  gulp.watch([path.watch.svg], svgSprites);
  gulp.watch([path.watch.fonts], fonts);
  gulp.watch([path.watch.fonts], fontsStyle);
  gulp.watch([path.watch.media], media)
}

const toProd = (done) => {
  isProd = true;
  done();
}

function clean(params) {
  return del(path.clean);
}

let dev2 = gulp.series(clean, gulp.parallel(html, js, fonts, images, svgSprites, media), fontsStyle, css);
let dev = parallel(dev2, watchFiles, browserSync)
let build = gulp.series(clean, gulp.parallel(toProd, js, css, html, images, fonts, svgSprites, media), fontsStyle);
let watch = gulp.parallel(build, watchFiles, browserSync);

exports.media = media;
exports.svgSprites = svgSprites;
exports.fontsStyle = fontsStyle;
exports.fonts = fonts;
exports.images = images;
exports.js = js;
exports.css = scss;
exports.html = html;
exports.dev2 = dev2;
exports.dev = dev;
exports.build = build;
exports.watch = watch;
exports.default = watch;
