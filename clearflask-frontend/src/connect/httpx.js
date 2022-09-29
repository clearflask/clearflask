// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
'use strict';
let net = require('net');

exports.createServer = (serverHttp, serverHttps) => {

  let server = net.createServer(socket => {
    socket.once('data', buffer => {
      // Pause the socket
      socket.pause();

      // Determine if this is an HTTP(s) request
      let byte = buffer[0];

      let proxy;
      if (byte === 22) {
        proxy = serverHttps;
      } else if (32 < byte && byte < 127) {
        proxy = serverHttp;
      }

      if (proxy) {
        // Push the buffer back onto the front of the data stream
        socket.unshift(buffer);

        // Emit the socket to the HTTP(s) server
        proxy.emit('connection', socket);
      }

      // As of NodeJS 10.x the socket must be 
      // resumed asynchronously or the socket
      // connection hangs, potentially crashing
      // the process. Prior to NodeJS 10.x
      // the socket may be resumed synchronously.
      process.nextTick(() => socket.resume());
    });
  });

  return server;
};