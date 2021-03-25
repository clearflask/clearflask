package com.smotana.clearflask.core.image;

import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.testutil.AbstractTest;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;

import static org.junit.Assert.assertEquals;

@RunWith(Parameterized.class)
public class ImageNormalizationTest extends AbstractTest {

    @Inject
    private ImageNormalization normalization;

    private final String testImagePath;

    public ImageNormalizationTest(String testImagePath) {
        this.testImagePath = testImagePath;
    }

    @Parameterized.Parameters(name = "{0}")
    public static Iterable<String> data() {
        return ImmutableList.of(
                "smotana-logo-master.svg",
                "favicon.ico",
                "example.png",
                "profile.jpg",
                "example.jpeg",
                "hotjar.png",
                "zapier.png",
                "rotating_earth.gif");
    }

    @Override
    protected void configure() {
        super.configure();

        install(Modules.override(
                ImageNormalizationImpl.module()
        ).with(new AbstractModule() {
            @Override
            protected void configure() {
                install(ConfigSystem.overrideModule(ImageNormalizationImpl.Config.class, om -> {
                    om.override(om.id().maxWidth()).withValue(10000d);
                    om.override(om.id().maxHeight()).withValue(10000d);
                }));
            }
        }));
    }

    @Test(timeout = 10_000L)
    public void test() throws Exception {
        byte[] examplePngBytes = Thread.currentThread().getContextClassLoader().getResourceAsStream(testImagePath).readAllBytes();
        BufferedImage examplePngBuffered = ImageIO.read(new ByteArrayInputStream(examplePngBytes));
        int width = examplePngBuffered.getWidth();
        int height = examplePngBuffered.getHeight();

        ImageNormalization.Image normalized = normalization.normalize(new ByteArrayInputStream(examplePngBytes));
        assertEquals("image/jpeg", normalized.getMediaType());
        BufferedImage normalizedBuffered = ImageIO.read(new ByteArrayInputStream(normalized.getData()));
        assertEquals(width, normalizedBuffered.getWidth());
        assertEquals(height, normalizedBuffered.getHeight());

        configSet(ImageNormalizationImpl.Config.class, "maxWidth", String.valueOf(width / 2));
        normalized = normalization.normalize(new ByteArrayInputStream(examplePngBytes));
        normalizedBuffered = ImageIO.read(new ByteArrayInputStream(normalized.getData()));
        assertEquals(width / 2, normalizedBuffered.getWidth());
        assertEquals(height / 2, normalizedBuffered.getHeight());

        configSet(ImageNormalizationImpl.Config.class, "maxWidth", String.valueOf(width));
        configSet(ImageNormalizationImpl.Config.class, "maxHeight", String.valueOf(height / 2));
        normalized = normalization.normalize(new ByteArrayInputStream(examplePngBytes));
        normalizedBuffered = ImageIO.read(new ByteArrayInputStream(normalized.getData()));
        assertEquals(width / 2, normalizedBuffered.getWidth());
        assertEquals(height / 2, normalizedBuffered.getHeight());
    }
}