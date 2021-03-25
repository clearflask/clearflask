package com.smotana.clearflask.core.image;

import com.google.inject.AbstractModule;
import com.google.inject.Inject;
import com.google.inject.Module;
import com.kik.config.ice.ConfigSystem;
import com.kik.config.ice.annotations.DefaultValue;
import com.smotana.clearflask.web.ApiException;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.plugins.jpeg.JPEGImageWriteParam;
import javax.ws.rs.core.Response;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class ImageNormalizationImpl implements ImageNormalization {

    public interface Config {
        @DefaultValue("0.8")
        float compressionQuality();

        @DefaultValue("1024")
        double maxWidth();

        @DefaultValue("2048")
        double maxHeight();
    }

    private static final String COMMENT_INDEX = "comment";

    @Inject
    private Config config;

    @Override
    public Image normalize(InputStream in) throws ApiException {
        BufferedImage image;
        try {
            image = ImageIO.read(in);
            in.close();
        } catch (IOException ex) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Corrupted image", ex);
        }
        if (image == null) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Unsupported format");
        }
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

        JPEGImageWriteParam jpegParams = new JPEGImageWriteParam(null);
        jpegParams.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        jpegParams.setCompressionQuality(0.8f);

        byte[] bytesOut;
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            final ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
            writer.setOutput(ImageIO.createImageOutputStream(out));
            writer.write(null, new IIOImage(convertedImage, null, null), jpegParams);
            bytesOut = out.toByteArray();
        } catch (IOException ex) {
            throw new ApiException(Response.Status.UNSUPPORTED_MEDIA_TYPE, "Corrupted image", ex);
        }

        return new Image("image/jpeg", bytesOut);
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
