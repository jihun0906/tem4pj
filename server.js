const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3001;

let progressData = "";
let resultData = "";
let isTestRunning = false;
let k6Process = null;

// 루트 경로에서 간단한 HTML 페이지를 반환 (기본 경로에 접근할 때)
app.get('/', (req, res) => {
    res.send(`<html>
                <head>
                    <title>웹 서버 부하 테스트기</title>
                    <script>
                        let isTestRunning = ${isTestRunning};

                        function startLoadTest() {
                            fetch('/load-test')
                                .then(response => response.text())
                                .then(data => {
                                    document.getElementById('load-test-status').innerHTML = data;
                                    isTestRunning = true;
                                    updateButton();
                                    updateProgress();
                                });
                        }

                        function stopLoadTest() {
                            fetch('/stop-test')
                                .then(response => response.text())
                                .then(data => {
                                    document.getElementById('load-test-status').innerText = '부하 테스트가 중지되었습니다.';
                                    isTestRunning = false;
                                    updateButton();
                                });
                        }

                        function updateButton() {
                            const startButton = document.getElementById('start-button');
                            const stopButton = document.getElementById('stop-button');
                            if (isTestRunning) {
                                startButton.disabled = true;
                                stopButton.disabled = false;
                            } else {
                                startButton.disabled = false;
                                stopButton.disabled = true;
                            }
                        }

                        function updateProgress() {
                            const eventSource = new EventSource('/progress');
                            eventSource.onmessage = function(event) {
                                document.getElementById('progress').innerText = event.data;
                                if (event.data.includes("부하 테스트 완료")) {
                                    eventSource.close();
                                    fetch('/result')
                                        .then(response => response.json())
                                        .then(data => {
                                            document.getElementById('result').innerHTML = \`
                                                <p>들어온 횟수: \${data.entries}</p>
                                                <p>클릭 횟수: \${data.clicks}</p>
                                                <p>다운로드 횟수: \${data.downloads}</p>
                                                <p>실패한 요청: \${data.failed_requests}</p>
                                                <p>평균 응답 시간: \${data.avg_response_time} ms</p>
                                            \`;
                                        });
                                    document.getElementById('load-test-status').innerText = '부하 테스트 완료';
                                    isTestRunning = false;
                                    updateButton();
                                }
                            };
                        }
                    </script>
                </head>
                <body onload="updateButton();">
                    <h1>웹 서버 부하 테스트기</h1>
                    <div id="load-test-status"></div>
                    <button id="start-button" onclick="startLoadTest()">Start Load Test</button>
                    <button id="stop-button" onclick="stopLoadTest()" disabled>Stop Test</button>
                    <pre id="progress"></pre>
                    <h2>결과</h2>
                    <div id="result"></div>
                </body>
              </html>`);
});

// 부하 테스트 실행 API
app.get('/load-test', (req, res) => {
    if (isTestRunning) {
        return res.send('Test is already running.');
    }

    isTestRunning = true;
    progressData = "";
    resultData = "";
    const k6Command = `k6 run --summary-export=summary.json webscript.js`;

    k6Process = spawn('sh', ['-c', k6Command]);

    k6Process.stdout.on('data', (data) => {
        const regex = /(\d+)%/g;
        const match = regex.exec(data.toString());
        if (match) {
            progressData = `진행률: ${match[1]}%`;
        }
        console.log(data.toString());  // 디버그를 위해 k6 출력 내용을 로그에 기록합니다.
    });

    k6Process.on('close', (code) => {
        console.log(`k6 process exited with code ${code}`);
        isTestRunning = false;
        fs.readFile(path.join(__dirname, 'summary.json'), 'utf8', (err, data) => {
            if (err) {
                console.error(err);
            } else {
                const parsedData = JSON.parse(data);
                resultData = {
                    entries: parsedData.metrics.http_reqs.count,
                    clicks: parsedData.root_group.checks["링크 클릭 성공"].passes,
                    downloads: parsedData.root_group.checks["파일 다운로드 성공"].passes,
                    failed_requests: parsedData.metrics.http_req_failed.fails,
                    avg_response_time: parsedData.metrics.http_req_duration.avg,
                };
            }
        });
    });

    res.send('부하 테스트 시작됨.');
});

// 진행률 반환 API (EventSource를 통한 실시간 데이터 전송)
app.get('/progress', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 실시간으로 진행률 데이터를 전송
    const interval = setInterval(() => {
        res.write(`data: ${progressData}\n\n`);
        if (!isTestRunning) {
            res.write(`data: 부하 테스트 완료\n\n`);
            clearInterval(interval);
            res.end();
        }
    }, 1000);
});

// 부하 테스트 결과 반환 API
app.get('/result', (req, res) => {
    res.json(resultData);
});

// 부하 테스트 중지 API
app.get('/stop-test', (req, res) => {
    if (k6Process && isTestRunning) {
        k6Process.kill();  // k6 프로세스를 종료
        res.send('Test stopped');
        isTestRunning = false; // 테스트가 중지되었으므로 상태 업데이트
    } else {
        res.send('No test running');
    }
});

// 서버 실행
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

