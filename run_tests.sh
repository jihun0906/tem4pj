#!/bin/bash

# lock.sh 실행
./lock.sh &

# webscript.js 실행
k6 run /home/ec2-user/k6data/webscript.js
