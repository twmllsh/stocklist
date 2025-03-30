#!/bin/bash

echo "===== Frontend 컨테이너 문제 해결 스크립트 ====="

# 기존 컨테이너 중지 및 삭제
echo "[1/5] 기존 frontend 컨테이너 정리 중..."
docker compose stop frontend
docker compose rm -f frontend

# 이미지 재빌드
echo "[2/5] frontend 이미지 재빌드 중..."
docker compose build frontend

# node_modules 디렉토리 확인
echo "[3/5] 로컬 node_modules 상태 확인..."
if [ -d "./frontend/node_modules" ]; then
  echo "로컬 node_modules 디렉토리가 존재합니다."
else
  echo "로컬 node_modules 디렉토리가 없습니다. npm install이 필요할 수 있습니다."
fi

# frontend 컨테이너 시작
echo "[4/5] frontend 컨테이너 시작 중..."
docker compose up -d frontend

# 로그 확인
echo "[5/5] frontend 로그 확인 중..."
sleep 5
docker compose logs frontend

echo "===== 문제 해결 완료 ====="
echo "frontend 컨테이너가 제대로 실행되었는지 확인하려면 브라우저에서 http://localhost:5173에 접속하세요."
