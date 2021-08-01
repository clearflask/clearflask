// SPDX-FileCopyrightText: 2019-2021 Matus Faro <matus@smotana.com>
// SPDX-License-Identifier: AGPL-3.0-only
package com.smotana.clearflask.web;

import com.google.gson.Gson;
import com.google.inject.Inject;
import com.smotana.clearflask.api.model.ErrorResponse;
import com.smotana.clearflask.core.ServiceInjector;
import lombok.extern.slf4j.Slf4j;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.core.Response;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Optional;

@Slf4j
public class ErrorHandler extends HttpServlet {

    @Inject
    private Gson gson;

    public ErrorHandler() {
        ServiceInjector.INSTANCE.get().injectMembers(this);
    }

    @Override
    public void doGet(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        Throwable throwable = (Throwable) request.getAttribute("javax.servlet.error.exception");
        int statusCode = Optional.ofNullable((Integer) request.getAttribute("javax.servlet.error.status_code"))
                .orElse(-1);
        String servletName = Optional.ofNullable((String) request.getAttribute("javax.servlet.error.servlet_name"))
                .orElse("default");
        String requestUri = Optional.ofNullable((String) request.getAttribute("javax.servlet.error.request_uri"))
                .orElse("/");
        Optional<Throwable> throwableOpt = Optional.ofNullable((Throwable) request.getAttribute("javax.servlet.error.exception"));
        Optional<ApiException> apiExceptionOpt = Optional.empty();
        if (throwableOpt.isPresent() && throwableOpt.get() instanceof ApiException) {
            apiExceptionOpt = Optional.of((ApiException) throwableOpt.get());
        } else if (throwableOpt.isPresent() && throwableOpt.get().getCause() instanceof ApiException) {
            apiExceptionOpt = Optional.of((ApiException) throwableOpt.get().getCause());
        }
        log.trace("Handling error, status {} servletName {} requestUri {} throwable {} apiEx {}",
                statusCode, servletName, requestUri, throwableOpt, apiExceptionOpt);

        if ("api".equals(servletName)) {
            if (requestUri.matches("^/api/?$")) {
                request.getServletContext()
                        .getRequestDispatcher("/api/index.html")
                        .forward(request, response);
            } else {
                response.setStatus(apiExceptionOpt
                        .map(ApiException::getStatus)
                        .map(Response.Status::getStatusCode)
                        .orElse(statusCode));
                PrintWriter out = response.getWriter();
                response.setContentType("application/json");
                response.setCharacterEncoding("UTF-8");
                apiExceptionOpt.flatMap(ApiException::getUserFacingMessageOpt).ifPresent(userFacingMessage -> {
                    out.print(gson.toJson(new ErrorResponse(userFacingMessage)));
                    out.flush();
                });
                response.flushBuffer();
            }
        } else {
            request.getServletContext()
                    .getRequestDispatcher("/")
                    .forward(request, response);
        }
    }

    // Method to handle POST method request.
    public void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {

        doGet(request, response);
    }
}