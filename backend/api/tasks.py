import logging
from celery import shared_task
from api.utils.dbupdater import DBUpdater
from django.core.management import call_command
from datetime import datetime
from django.db import transaction

# 로거 설정
logger = logging.getLogger(__name__)


#@shared_task
#def scheduler_test():
#    """테스트 용도임."""
#    try:
#        print('scheduler test!!')
#        return "test scheduler completed successfully"
#    except Exception as e:
#        return f"test scheduler failed: {str(e)}"

@shared_task
def scheduler_ticker():
    """주식 티커 정보 업데이트 (평일 07:30)"""
    try:
        DBUpdater.update_ticker()
        return "Ticker update completed successfully"
    except Exception as e:
        return f"Ticker update failed: {str(e)}"

@shared_task(
    bind=True,
    max_retries=3,  # 최대 재시도 횟수
    autoretry_for=(Exception,),  # 자동 재시도할 예외
    retry_backoff=True  # 지수 백오프 사용
)
def scheduler_ohlcv(self):
    """OHLCV 데이터 업데이트"""
    try:
        with transaction.atomic():  # 트랜잭션 추가
            DBUpdater.update_ohlcv()
            return "OHLCV update completed successfully"
    except Exception as e:
        # 에러 로깅 추가
        logger.error(f"OHLCV update failed: {str(e)}")
        raise  # Celery가 재시도 처리

@shared_task
def scheduler_basic_info2():
    """기본 정보 업데이트 및 주식 분석 (평일 16:05)"""
    try:
        DBUpdater.update_ohlcv()
        DBUpdater.update_basic_info()
        DBUpdater.anal_all_stock()
        return "Ohlcv update and Basic info and analysis completed successfully"
    except Exception as e:
        return f"Basic info update failed: {str(e)}"

@shared_task
def scheduler_update_investor():
    """투자자 정보 업데이트 (평일 18:05)"""
    try:
        DBUpdater.update_investor()
        return "Investor data updated successfully"
    except Exception as e:
        return f"Investor update failed: {str(e)}"

@shared_task
def scheduler_update_issue():
    """이슈 정보 업데이트 (45분마다)"""
    try:
        DBUpdater.update_issue()
        return "Issue data updated successfully"
    except Exception as e:
        return f"Issue update failed: {str(e)}"

@shared_task
def scheduler_update_stockplus_news():
    """뉴스 정보 업데이트 (30분마다)"""
    try:
        DBUpdater.update_stockplus_news()
        return "News data updated successfully"
    except Exception as e:
        return f"News update failed: {str(e)}"

@shared_task
def scheduler_update_theme_upjong():
    """테마/업종 정보 업데이트 (토요일 22:00)"""
    try:
        DBUpdater.update_theme_upjong()
        return "Theme/Upjong data updated successfully"
    except Exception as e:
        return f"Theme/Upjong update failed: {str(e)}"

@shared_task
def scheduler_db_backup():
    """데이터베이스 백업 (일요일 01:00)"""
    try:
        call_command('backup_db')
        return "Database backup completed successfully"
    except Exception as e:
        return f"Database backup failed: {str(e)}"
