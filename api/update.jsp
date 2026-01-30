<%@page import="java.util.*,java.io.*,java.nio.file.*,java.util.regex.*"%>
<%@page language="java" contentType="application/json; charset=UTF-8" pageEncoding="UTF-8" trimDirectiveWhitespaces="true"%>

<%
    // POST Body 읽기
    final StringBuilder sb = new StringBuilder();
    final BufferedReader reader = request.getReader();
    String line;
    while ((line = reader.readLine()) != null) {
        sb.append(line);
    }
    final String rawData = sb.toString().trim();

    String message = "";
    boolean success = false;

    try {
        if (rawData.isEmpty()) {
            throw new Exception("Payload가 비어있습니다.");
        }

        // 이용한 데이터 추출 및 Validation
        // user 추출용 Regex: "user"\s*:\s*"(.*?)"
        final Pattern userPattern = Pattern.compile("\"user\"\\s*:\\s*\"(.*?)\"", Pattern.DOTALL);
        final Matcher userMatcher = userPattern.matcher(rawData);
        String userName = "default";
        if (userMatcher.find()) {
            userName = userMatcher.group(1);
        } else {
            throw new Exception("user 필드를 찾을 수 없습니다.");
        }

        // data 배열 부분 추출 및 검증 Regex
        // "data"\s*:\s*\[ (아이템패턴) \]
        final String itemPattern = "\\{\\s*\"name\"\\s*:\\s*\".*?\"\\s*,\\s*\"paramText\"\\s*:\\s*\".*?\"\\s*,\\s*\"sep\"\\s*:\\s*\".*?\"\\s*\\}";
        final String dataArrayPatternString = "\"data\"\\s*:\\s*\\[\\s*(" + itemPattern + "\\s*,?\\s*)*\\]";
        final Pattern dataPattern = Pattern.compile(dataArrayPatternString, Pattern.DOTALL);
        final Matcher dataMatcher = dataPattern.matcher(rawData);
        if (dataMatcher.find()) {
            // "data": [ ... ] 부분만 추출
            final String dataPart = dataMatcher.group(); 
            // 순수 배열 부분만 남기기 위해 "data": 를 제거하거나 대괄호 위치를 찾음
            final String finalJsonData = dataPart.substring(dataPart.indexOf("["));

            // 파일 저장 경로 설정
            final String repoPath = application.getRealPath("/api/userdata/");
            final File dir = new File(repoPath);
            if (!dir.exists()) dir.mkdirs();
            
            final Path userPath = Paths.get(repoPath, userName + ".json");

            // 파일 쓰기
            final BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(userPath.toFile()), "UTF-8"));
            bw.write(finalJsonData); // 배열 부분만 저장
            bw.close();
            
            success = true;
            message = userName + "의 데이터가 업데이트되었습니다.";
        } else {
            throw new Exception("data 배열 형식이 올바르지 않거나 필수 필드가 누락되었습니다.");
        }

    } catch (Exception e) {
        success = false;
        message = e.getMessage();
    }

    // 결과 응답
    out.clear();
    out.print("{\"success\":" + success + ", \"message\":\"" + message.replace("\"", "\\\"") + "\"}");
%>