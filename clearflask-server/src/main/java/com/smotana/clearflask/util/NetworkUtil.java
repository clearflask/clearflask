package com.smotana.clearflask.util;

import com.github.rholder.retry.RetryException;
import com.github.rholder.retry.Retryer;
import com.github.rholder.retry.RetryerBuilder;
import com.github.rholder.retry.StopStrategies;
import com.github.rholder.retry.WaitStrategies;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
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
        Retryer<Boolean> retryer = RetryerBuilder.<Boolean>newBuilder()
                .retryIfResult(result -> !result)
                .withStopStrategy(StopStrategies.stopAfterDelay(1, TimeUnit.MINUTES))
                .withWaitStrategy(WaitStrategies.exponentialWait(50, 1, TimeUnit.SECONDS))
                .build();
        try {
            retryer.call(() -> {
                try {
                    Socket s = new Socket(InetAddress.getLocalHost(), port);
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
}
