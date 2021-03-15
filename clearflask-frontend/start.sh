set -ex

NODE_ENV="${NODE_ENV:=production}" ENV="${ENV:=production}" node --unhandled-rejections=strict --trace-warnings main.js
