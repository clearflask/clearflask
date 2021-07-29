
set -ex

NODE_ENV="${NODE_ENV:=production}" ENV="${ENV:=production}" node --unhandled-rejections=strict --enable-source-maps --trace-warnings main.js
