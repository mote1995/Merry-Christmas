const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HTMLInlineScriptWebpackPlugin = require("html-inline-script-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
    publicPath: "auto",
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env", "@babel/preset-react"],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader", "postcss-loader"],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./public/index.html",
      inject: "body",
    }),
    new HTMLInlineScriptWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: "public",
          to: "",
          filter: (resourcePath) => !resourcePath.endsWith("index.html")
        },
      ],
    }),
  ],
  resolve: {
    extensions: [".js", ".jsx"],
    fallback: {
      "crypto": false,
      "fs": false,
      "path": false,
      "os": false,
      "stream": false,
      "buffer": false,
      "util": false,
    }
  },
  devServer: {
    static: {
      directory: path.join(__dirname, "public"),
    },
    compress: true,
    port: 3000,
  },
};
