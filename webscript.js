import http from 'k6/http';
import { sleep, check } from 'k6';
import { Trend } from 'k6/metrics';

let downloadSpeed = new Trend('download_speed');

export const options = {
    stages: [
        { duration: '10s', target: 50 },
        { duration: '20s', target: 50 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 10 },
        { duration: '30s', target: 50 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<500'],
        'download_speed': ['p(95)<2000'],
    },
};

export default function () {
    let fileUrl = "http://rds.rosmontis.shop/images/common1.png";
    let res = http.get(fileUrl);
    check(res, {
        '파일 다운로드 성공': (r) => r.status === 200,
    });

    downloadSpeed.add(res.timings.duration);

    let linkUrl = "http://grafana.rosmontis.shop:3000";
    res = http.get(linkUrl);
    console.log('링크 요청 상태:', res.status);

    check(res, {
        '링크 클릭 성공': (r) => r.status === 200,
    });

    sleep(30);
}

// 결과 파일 생성
export function handleSummary(data) {
    const summaryData = {
        "테스트 결과": {
            "요청 횟수": data.metrics['http_req_duration']['count'],
            "성공 요청": data.metrics['http_req_duration']['success'],
            "실패 요청": data.metrics['http_req_duration']['failed'],
            "평균 응답 시간": data.metrics['http_req_duration']['avg'],
            "최대 응답 시간": data.metrics['http_req_duration']['max'],
            "95퍼센트 응답 시간": data.metrics['http_req_duration']['p(95)'],
            "다운로드 속도 (평균)": data.metrics['download_speed']['avg'],
            "다운로드 속도 (최대)": data.metrics['download_speed']['max'],
            "응답 크기 (평균)": data.metrics['http_req_size']['avg'],
            "응답 크기 (최대)": data.metrics['http_req_size']['max'],
        }
    };

    return {
        'result.json': JSON.stringify(summaryData, null, 2),  // 여기에 데이터를 JSON 형식으로 변환해서 파일에 저장
    };
}


