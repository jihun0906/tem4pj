#!/bin/bash

LOCK_FILE="/home/ec2-user/k6data/k6_test_lock_file.lock"

# 잠금 파일이 있는지 확인
if [ -f "$LOCK_FILE" ]; then
    echo "이미 부하 테스트가 진행 중입니다."
    exit 1
else
    # 잠금 파일 생성
    touch "$LOCK_FILE"
    echo "부하 테스트를 시작합니다."

    # 두 개의 webscript.js를 병렬로 실행
    nohup k6 run /home/ec2-user/k6data/webscript1.js > /home/ec2-user/k6data/webscript1_output.log 2>&1 &
    nohup k6 run /home/ec2-user/k6data/webscript2.js > /home/ec2-user/k6data/webscript2_output.log 2>&1 &

    # 두 프로세스가 모두 종료될 때까지 대기
    wait

    # 부하 테스트 완료 후 잠금 파일 삭제
    rm -f "$LOCK_FILE"
    echo "부하 테스트가 완료되었습니다."
fi

