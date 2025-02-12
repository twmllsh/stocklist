FROM nginx:alpine

# envsubst 설치
RUN apk add --no-cache bash

# nginx.conf 템플릿 복사
COPY default.conf /etc/nginx/conf.d/default.conf

# 시작 스크립트 생성
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]