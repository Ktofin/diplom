const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('moc3')) {
  config.resolver.assetExts.push('moc3');
}

module.exports = config;
