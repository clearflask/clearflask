// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.image;

import com.google.common.collect.ImmutableList;
import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.util.Modules;
import com.kik.config.ice.ConfigSystem;
import com.smotana.clearflask.testutil.AbstractTest;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.FileUtils;
import org.apache.commons.io.FilenameUtils;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;

import static org.junit.Assert.assertEquals;

@Slf4j
@RunWith(Parameterized.class)
public class ImageNormalizationTest extends AbstractTest {
    public static TemporaryFolder outputFolder = new TemporaryFolder();

    @Inject
    private ImageNormalization normalization;

    private final String testImagePath;

    public ImageNormalizationTest(String testImagePath) {
        this.testImagePath = testImagePath;
    }

    @BeforeClass
    public static void setupBefore() throws IOException {
        outputFolder.create();
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
        boolean isGif = "gif".equals(FilenameUtils.getExtension(testImagePath));
        byte[] exampleImgBytes = Thread.currentThread().getContextClassLoader().getResourceAsStream(testImagePath).readAllBytes();
        BufferedImage exampleImgBuffered = ImageIO.read(new ByteArrayInputStream(exampleImgBytes));
        int width = exampleImgBuffered.getWidth();
        int height = exampleImgBuffered.getHeight();

        ImageNormalization.Image normalized = normalization.normalize(new ByteArrayInputStream(exampleImgBytes));
        writeFileToTempFolder(normalized, "1");
        assertEquals(isGif ? "image/gif" : "image/jpeg", normalized.getMediaType());
        BufferedImage normalizedBuffered = ImageIO.read(new ByteArrayInputStream(normalized.getData()));
        assertEquals(width, normalizedBuffered.getWidth());
        assertEquals(height, normalizedBuffered.getHeight());

        configSet(ImageNormalizationImpl.Config.class, "maxWidth", String.valueOf(width / 2));
        normalized = normalization.normalize(new ByteArrayInputStream(exampleImgBytes));
        writeFileToTempFolder(normalized, "2");
        normalizedBuffered = ImageIO.read(new ByteArrayInputStream(normalized.getData()));
        assertEquals(isGif ? width : width / 2, normalizedBuffered.getWidth());
        assertEquals(isGif ? height : height / 2, normalizedBuffered.getHeight());

        configSet(ImageNormalizationImpl.Config.class, "maxWidth", String.valueOf(width));
        configSet(ImageNormalizationImpl.Config.class, "maxHeight", String.valueOf(height / 2));
        normalized = normalization.normalize(new ByteArrayInputStream(exampleImgBytes));
        writeFileToTempFolder(normalized, "3");
        normalizedBuffered = ImageIO.read(new ByteArrayInputStream(normalized.getData()));
        assertEquals(isGif ? width : width / 2, normalizedBuffered.getWidth());
        assertEquals(isGif ? height : height / 2, normalizedBuffered.getHeight());
    }

    private void writeFileToTempFolder(ImageNormalization.Image image, String suffix) throws IOException {
        String outputFileName = FilenameUtils.getBaseName(testImagePath)
                + "-" + suffix
                + "." + FilenameUtils.getExtension(testImagePath);
        File outputFile = outputFolder.newFile(outputFileName);
        FileUtils.writeByteArrayToFile(
                outputFile,
                image.getData());
        log.info("Result: {}", outputFile);
    }
}