import os
from celery import Celery
from celery.schedules import crontab

# Django 설정 모듈 지정
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Celery 앱 생성
app = Celery('config')

# Celery 설정
app.conf.update(
    broker_connection_retry_on_startup=True,  # 연결 재시도 설정
)
# Django 설정에서 Celery 관련 설정 가져오기
# namespace='CELERY'는 설정 변수들의 접두사가 CELERY_로 시작함을 의미
app.config_from_object('django.conf:settings', namespace='CELERY')

# 등록된 Django 앱에서 tasks.py 자동으로 탐색
app.autodiscover_tasks()

# 정기적 작업 스케줄 설정
app.conf.beat_schedule = {
    # # test (1분)
    # 'test-scheduler': {
    #     'task': 'api.tasks.scheduler_test',
    #     'schedule': crontab(minute="*/10", day_of_week='mon-sun'),
    # },
    # 주식 티커 정보 업데이트 (평일 07:30)
    'update-ticker': {
        'task': 'api.tasks.scheduler_ticker',
        'schedule': crontab(hour=7, minute=30, day_of_week='mon-fri'),
    },
    
    # OHLCV 데이터 업데이트 (월-토 15:55)
    'update-ohlcv': {
        'task': 'api.tasks.scheduler_ohlcv',
        'schedule': crontab(hour=15, minute=55, day_of_week='mon-sat'),
    },
    
    # 기본 정보 업데이트 2 (평일 16:05)
    'update-basic-info': {
        'task': 'api.tasks.scheduler_basic_info2',
        'schedule': crontab(hour=16, minute=5, day_of_week='mon-fri'),
    },
    
    # 투자자 정보 업데이트 (평일 18:05)
    'update-investor': {
        'task': 'api.tasks.scheduler_update_investor',
        'schedule': crontab(hour=18, minute=5, day_of_week='mon-fri'),
    },
    
    # 이슈 업데이트 (월-토 8시-18시 사이 45분마다)
    'update-issue': {
        'task': 'api.tasks.scheduler_update_issue',
        'schedule': crontab(minute='*/45', hour='8-18', day_of_week='mon-sat'),
        # 'schedule': crontab(minute='*/10', hour='8-18', day_of_week='mon-sun'),
    },
    
    # 뉴스 업데이트 (월-토 8시-23시 사이 30분마다)
    'update-news': {
        'task': 'api.tasks.scheduler_update_stockplus_news',
        'schedule': crontab(minute='*/30', hour='8-23', day_of_week='mon-sun'),
        # 'schedule': crontab(minute='*/5', hour='8-23', day_of_week='mon-sun'),
    },
    
    # 테마/업종 업데이트 (토요일 22:00)
    'update-theme': {
        'task': 'api.tasks.scheduler_update_theme_upjong',
        'schedule': crontab(hour=22, minute=0, day_of_week='sat'),
    },
    
    # DB 백업 (일요일 01:00)
    'backup-db': {
        'task': 'api.tasks.scheduler_db_backup',
        'schedule': crontab(hour=1, minute=0, day_of_week='sun'),
    },
}
