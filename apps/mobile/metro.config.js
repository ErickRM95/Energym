const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/shared")];

module.exports = withNativeWind(config, { input: "./global.css" });
