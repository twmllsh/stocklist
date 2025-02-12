#!/bin/bash

# nginx 설정 파일에 환경변수 적용
envsubst < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf

# nginx 실행
exec "$@"