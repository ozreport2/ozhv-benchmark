<%@page import="java.util.*,java.io.*,java.nio.file.*"%>
<%@page language="java" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8" trimDirectiveWhitespaces="true"%>

<%
    String _userName = request.getParameter("user");
    final String userName = (_userName != null && !_userName.isEmpty()) ? _userName : "default";
    final String repoPath = application.getRealPath("/api/userdata/");
    final Path userPath = Paths.get(repoPath, userName + ".json");
    final File userFile = userPath.toFile();

    if (!userFile.exists()) {
        response.sendError(HttpServletResponse.SC_NOT_FOUND, "JSON file not found.");
        return;
    }

    response.setContentType("application/json; charset=UTF-8");
    response.setContentLength((int) userFile.length());

    FileInputStream fis = null;
    OutputStream os = null;
    try {
        out.clear();
        out = pageContext.pushBody();

        fis = new FileInputStream(userFile);
        os = response.getOutputStream();

        final byte[] buffer = new byte[8192];
        int bytesRead;
        while ((bytesRead = fis.read(buffer)) != -1) {
            os.write(buffer, 0, bytesRead);
        }
        os.flush();
    } catch (Exception e) {
        e.printStackTrace();
        if (!response.isCommitted()) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND, e.getMessage());
        }
    } finally {
        if (fis != null) {
            try {
                fis.close();
            } catch (Exception e) {
            }
        }
    }
%>