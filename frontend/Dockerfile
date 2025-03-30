# 베이스 이미지 설정
FROM node:18-alpine

# 작업 디렉토리 설정
WORKDIR /app

# package.json 복사 전에 디렉토리가 존재하는지 확인
COPY package*.json ./

# 의존성 설치 및 vite 전역 설치 추가
RUN npm install
RUN npm install -g vite

# 애플리케이션 코드 복사
COPY . .

EXPOSE 5173

# 시작 명령어를 docker-compose에서 오버라이드 가능
CMD ["npm", "run", "dev"]