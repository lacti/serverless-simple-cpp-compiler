const path = require("path");
const slsw = require("serverless-webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: slsw.lib.webpack.isLocal ? "development" : "production",
  entry: slsw.lib.entries,
  devtool: "source-map",
  resolve: {
    extensions: [".js", ".jsx", ".json", ".ts", ".tsx"]
  },
  output: {
    libraryTarget: "commonjs",
    path: path.join(__dirname, ".webpack"),
    filename: "[name].js"
  },
  target: "node",
  module: {
    rules: [
      // all files with a `.ts` or `.tsx` extension will be handled by `ts-loader`
      { test: /\.tsx?$/, loader: "ts-loader" }
    ]
  },
  plugins: [new CopyWebpackPlugin([{ from: "cc", to: "cc" }])]
  // plugins: [new CopyWebpackPlugin(["x86_64-linux-musl-native.tgz"])]
};
