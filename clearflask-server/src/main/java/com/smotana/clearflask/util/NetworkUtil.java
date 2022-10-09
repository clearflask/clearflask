// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.util;

import com.github.rholder.retry.RetryException;
import com.github.rholder.retry.Retryer;
import com.github.rholder.retry.RetryerBuilder;
import com.github.rholder.retry.StopStrategies;
import com.github.rholder.retry.WaitStrategies;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.methods.CloseableHttpResponse;
import org.apache.http.client.methods.HttpGet;
import org.apache.http.impl.client.CloseableHttpClient;
import org.apache.http.impl.client.HttpClientBuilder;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

@Slf4j
public class NetworkUtil {
    private NetworkUtil() {
    }

    public static int findFreePort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    public static int findRandomFreePort(int rangeStartInclusive, int rangeEndExclusive) {
        while (true) {
            int port = ThreadLocalRandom.current().nextInt(rangeStartInclusive, rangeEndExclusive);
            try (ServerSocket socket = new ServerSocket()) {
                socket.setReuseAddress(false);
                socket.bind(new InetSocketAddress(InetAddress.getByName("localhost"), port), 1);
                return socket.getLocalPort();
            } catch (Exception ex) {
            }
        }
    }

    public static int findAscendingFreePort(int portStart) {
        int port = portStart;
        while (true) {
            try (ServerSocket socket = new ServerSocket()) {
                socket.setReuseAddress(false);
                socket.bind(new InetSocketAddress(InetAddress.getByName("localhost"), port), 1);
                return socket.getLocalPort();
            } catch (Exception ex) {
            }
            port++;
            if (port == 65535) {
                port = 1;
            } else if (port == portStart) {
                throw new RuntimeException("Looped through all ports and they are all in use?!?!?");
            }
        }
    }

    public static void waitUntilPortOpen(int port) throws IOException {
        waitUntilPortOpen("127.0.0.1", port);
    }

    public static void waitUntilPortOpen(String urlStr) throws IOException {
        URL url = new URL(urlStr);
        waitUntilPortOpen(
                url.getHost(),
                url.getPort() != -1
                        ? url.getPort()
                        : url.getDefaultPort());
    }

    public static void waitUntilPortOpen(String hostname, int port) throws IOException {
        Retryer<Boolean> retryer = RetryerBuilder.<Boolean>newBuilder()
                .retryIfResult(result -> !result)
                .withStopStrategy(StopStrategies.stopAfterDelay(5, TimeUnit.MINUTES))
                .withWaitStrategy(WaitStrategies.exponentialWait(50, 5, TimeUnit.SECONDS))
                .build();
        try {
            retryer.call(() -> {
                try {
                    Socket s = new Socket(hostname, port);
                    s.close();
                    return true;

                } catch (IOException e) {
                    return false;
                }
            });
        } catch (ExecutionException | RetryException ex) {
            throw new IOException(ex);
        }
    }

    public static void waitUntil200(String url) throws IOException {
        Retryer<Integer> retryer = RetryerBuilder.<Integer>newBuilder()
                .retryIfResult(result -> result < 200 || result > 299)
                .withStopStrategy(StopStrategies.stopAfterDelay(5, TimeUnit.MINUTES))
                .withWaitStrategy(WaitStrategies.exponentialWait(50, 5, TimeUnit.SECONDS))
                .build();
        try (CloseableHttpClient client = HttpClientBuilder.create().build()) {
            retryer.call(() -> {
                HttpGet req = new HttpGet(url);
                try (CloseableHttpResponse res = client.execute(req)) {
                    return res.getStatusLine().getStatusCode();
                }
            });
        } catch (ExecutionException | RetryException ex) {
            throw new IOException(ex);
        }
    }
}
