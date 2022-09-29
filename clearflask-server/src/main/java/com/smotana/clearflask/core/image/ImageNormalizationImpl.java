// SPDX-FileCopyrightText: 2019-2022 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: Apache-2.0
package com.smotana.clearflask.core.image;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.store.ContentStore.ContentType;
import com.smotana.clearflask.web.ApiException;
import lombok.extern.slf4j.Slf4j;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.plugins.jpeg.JPEGImageWriteParam;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.ws.rs.core.Response;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;

@Slf4j
public class ImageNormalizationImpl implements ImageNormalization {

    public interface Config {
        @DefaultValue("0.8")
        float compressionQuality();

        @DefaultValue("1024")
        double maxWidth();

        @DefaultValue("2048")
        double maxHeight();

        @DefaultValue("true")
        boolean keepGifsAsIs();
    }

    private static final String COMMENT_INDEX = "comment";

    @Inject
    private Config config;

    @Override
    public Image normalize(byte[] imgBytes) throws ApiException {
        try (ByteArrayInputStream bais = new ByteArrayInputStream(imgBytes);
             ImageInputStream iis = ImageIO.createImageInputStream(bais)) {
            Iterator<ImageReader> imageReaders = ImageIO.getImageReaders(iis);
            if (!imageReaders.hasNext()) {
                throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Unsupported format");
            }
            ImageReader imageReader = imageReaders.next();
            String format = imageReader.getFormatName();
            imageReader.setInput(iis);
            int numImages = imageReader.getNumImages(true);

            if (numImages < 1) {
                throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Empty image");
            } else if ("gif".equals(format) && numImages > 1 && config.keepGifsAsIs()) {
                return new Image(ContentType.GIF.getMediaType(), imgBytes);
            } else {
                return writeJpeg(imageReader.read(0));
            }
        } catch (IOException ex) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Corrupted image", ex);
        }
    }

    /**
     * TODO not working....
     * For some reason this produces an empty image file.
     */
    private Image writeGif(ImageReader imageReader) {
        byte[] data;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            final ImageWriter writer = ImageIO.getImageWritersByFormatName("gif").next();
            writer.setOutput(ios);
            writer.prepareWriteSequence(null);
            int numImages = imageReader.getNumImages(true);
            for (int i = 0; i < numImages; i++) {
                BufferedImage image = resizeImg(imageReader.read(imageReader.getMinIndex()));
                writer.writeToSequence(new IIOImage(image, null, null), null);
            }
            writer.endWriteSequence();
            data = out.toByteArray();
        } catch (IOException ex) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Corrupted image", ex);
        }
        return new Image(ContentType.GIF.getMediaType(), data);
    }

    private Image writeJpeg(BufferedImage image) {
        if (image == null) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "No image");
        }

        BufferedImage convertedImage = resizeImg(image);

        JPEGImageWriteParam jpegParams = new JPEGImageWriteParam(null);
        jpegParams.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        jpegParams.setCompressionQuality(0.8f);

        byte[] data;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream();
             ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            final ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
            writer.setOutput(ios);
            writer.write(null, new IIOImage(convertedImage, null, null), jpegParams);
            data = out.toByteArray();
        } catch (IOException ex) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Corrupted image", ex);
        }
        return new Image(ContentType.JPEG.getMediaType(), data);
    }

    private BufferedImage resizeImg(BufferedImage image) {
        Dimension scaledDimension = getScaledDimension(image.getWidth(), image.getHeight(), config.maxWidth(), config.maxHeight());
        final BufferedImage convertedImage = new BufferedImage(
                (int) scaledDimension.getWidth(),
                (int) scaledDimension.getHeight(),
                BufferedImage.TYPE_INT_RGB);

        convertedImage.createGraphics().drawImage(
                image,
                0,
                0,
                convertedImage.getWidth(),
                convertedImage.getHeight(),
                Color.WHITE,
                null);

        return convertedImage;
    }

    Dimension getScaledDimension(double imageWidth, double imageHeight, double boundaryWidth, double boundaryHeight) {
        double ratio = Math.min(boundaryWidth / imageWidth, boundaryHeight / imageHeight);
        return ratio >= 1d
                ? new Dimension((int) imageWidth, (int) imageHeight)
                : new Dimension((int) (imageWidth * ratio), (int) (imageHeight * ratio));
    }

    public static Module module() {
        return new AbstractModule() {
            @Override
            protected void configure() {
                bind(ImageNormalization.class).to(ImageNormalizationImpl.class).asEagerSingleton();
                install(ConfigSystem.configModule(Config.class));
            }
        };
    }
}
