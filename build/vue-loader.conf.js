var utils = require('./utils')
var config = require('../config')
var isProduction = process.env.NODE_ENV === 'production'

let loaders = utils.cssLoaders({
  sourceMap: isProduction
    ? config.build.productionSourceMap
    : config.dev.cssSourceMap,
  extract: isProduction
});
loaders['ts'] =  'ts-loader!tslint-loader';
module.exports = {
  loaders: loaders,
  transformToRequire: {
    video: 'src',
    source: 'src',
    img: 'src',
    image: 'xlink:href'
  }
}
