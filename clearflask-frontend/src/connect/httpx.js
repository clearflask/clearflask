// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
'use strict';
let net = require('net');

// How long a freshly accepted connection may stay silent before we close it.
// The first byte decides whether this is TLS or plaintext, and it normally
// follows the handshake immediately, so this only ever expires on a peer that
// has nothing to say.
const FIRST_BYTE_TIMEOUT_MS = 30 * 1000;

exports.createServer = (serverHttp, serverHttps) => {

  let server = net.createServer(socket => {
    // The socket is ours until a proxy adopts it below, and a client that
    // hangs up before finishing its first write — an abandoned handshake, a
    // scanner moving on — makes it emit 'error'. Node throws an 'error' event
    // that nobody listens for, which would kill the whole worker process.
    socket.on('error', () => { });

    // Until the first byte arrives no server owns this socket, so no other
    // timeout applies to it. Holding connections open and silent is the
    // cheapest way to tie up a server, so put a bound on it here.
    const firstByteTimeout = setTimeout(() => socket.destroy(), FIRST_BYTE_TIMEOUT_MS);

    socket.once('data', buffer => {
      // The adopting server applies its own timeouts from here on.
      clearTimeout(firstByteTimeout);

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
      } else {
        // Neither TLS nor HTTP. Nothing will ever adopt this socket, so close
        // it rather than leaving it open until the peer gives up.
        socket.destroy();
        return;
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