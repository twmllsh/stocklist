"""
데이터베이스 연결을 확인하는 간단한 스크립트
"""
import os
import time
import sys
import psycopg2

# DB 연결 정보
config = {
    'dbname': os.environ.get('POSTGRES_DB', 'postgres'),
    'user': os.environ.get('POSTGRES_USER', 'postgres'),
    'password': os.environ.get('POSTGRES_PASSWORD', 'postgres'),
    'host': os.environ.get('DB_HOST', 'db'),
    'port': os.environ.get('DB_PORT', '5432')
}

# 최대 시도 횟수
max_retries = 30
retry_interval = 2

print("데이터베이스 연결 확인 중...")

for i in range(max_retries):
    try:
        conn = psycopg2.connect(**config)
        conn.close()
        print("데이터베이스에 연결되었습니다!")
        sys.exit(0)
    except psycopg2.OperationalError:
        if i < max_retries - 1:
            print(f"데이터베이스 연결 실패. {retry_interval}초 후 재시도... ({i+1}/{max_retries})")
            time.sleep(retry_interval)
        else:
            print("데이터베이스 연결 시도 최대 횟수 초과")
            sys.exit(1)
