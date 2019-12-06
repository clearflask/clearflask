package com.smotana.clearflask.store.elastic;

import com.google.inject.AbstractModule;
import com.google.inject.Module;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import com.google.inject.multibindings.Multibinder;
import com.smotana.clearflask.core.ManagedService;
import com.smotana.clearflask.util.NetworkUtil;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.FileUtils;
import org.apache.http.HttpHost;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.common.settings.Settings;
import org.elasticsearch.env.Environment;
import org.elasticsearch.node.Node;
import org.elasticsearch.node.NodeValidationException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Log4j2
@Singleton
public class InMemoryElasticSearchProvider extends ManagedService implements Provider<RestClient> {
    private Optional<Path> tempDirOpt = Optional.empty();
    private Optional<RestClient> restClientOpt = Optional.empty();
    private Optional<Node> nodeOpt = Optional.empty();

    @Override
    public RestClient get() {
        String clusterName = "elasticsearch-temp-" + UUID.randomUUID().toString();
        Path tempDir;
        try {
            tempDir = Files.createTempDirectory(clusterName);
            this.tempDirOpt = Optional.of(tempDir);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        log.info("Elastic Search temp dir: {}", tempDir);

        int httpPort;
        int transportTcpPort;
        try {
            httpPort = NetworkUtil.findAscendingFreePort(2000);
            transportTcpPort = NetworkUtil.findAscendingFreePort(2000);
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }

        Settings settings = Settings.builder()
                .put("path.home", tempDir)
                .put("path.conf", tempDir)
                .put("path.data", tempDir)
                .put("path.work", tempDir)
                .put("path.logs", tempDir)
                .put("http.port", httpPort)
                .put("transport.tcp.port", transportTcpPort)
                .put("index.number_of_shards", 1)
                .put("index.number_of_replicas", 0)
                .put("discovery.zen.ping.multicast.enabled", false)
                .build();

        Node node = new Node(new Environment(settings, tempDir));
        this.nodeOpt = Optional.of(node);

        try {
            node.start();
        } catch (NodeValidationException ex) {
            throw new RuntimeException(ex);
        }

        RestClient restClient = RestClient.builder(new HttpHost("localhost", httpPort)).build();
        this.restClientOpt = Optional.of(restClient);

        return restClient;
    }

    @Override
    protected void serviceStop() throws Exception {
        if (this.restClientOpt.isPresent()) {
            restClientOpt.get().close();
        }

        if (this.nodeOpt.isPresent()) {
            nodeOpt.get().awaitClose(1, TimeUnit.MINUTES);
        }

        if (this.tempDirOpt.isPresent()) {
            FileUtils.deleteDirectory(this.tempDirOpt.get().toFile());
        }
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(RestClient.class).toProvider(InMemoryElasticSearchProvider.class).asEagerSingleton();
                Multibinder.newSetBinder(binder(), ManagedService.class).addBinding().to(InMemoryElasticSearchProvider.class);
            }
        };
    }
}
