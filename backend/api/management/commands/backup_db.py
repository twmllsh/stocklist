# backend/api/management/commands/backup_db.py
import os
import time
import glob
from django.core.management.base import BaseCommand
from django.conf import settings
from datetime import datetime

class Command(BaseCommand):
    help = 'Backup PostgreSQL database'

    def handle(self, *args, **kwargs):
        # 백업 파일 저장할 디렉토리
        backup_dir = 'db_backups'
        if not os.path.exists(backup_dir):
            os.makedirs(backup_dir)

        # 백업 파일명 생성
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_file = os.path.join(backup_dir, f'backup_{timestamp}.sql')

        # pg_dump 명령어 생성
        cmd = f'pg_dump -h {settings.DATABASES["default"]["HOST"]} '\
              f'-U {settings.DATABASES["default"]["USER"]} '\
              f'-d {settings.DATABASES["default"]["NAME"]} '\
              f'-f {backup_file}'

        # 백업 실행
        os.environ['PGPASSWORD'] = settings.DATABASES['default']['PASSWORD']
        exit_code = os.system(cmd)
        
        if exit_code == 0:
            # 이전 백업 파일 삭제
            backup_files = glob.glob(os.path.join(backup_dir, 'backup_*.sql'))
            for file in backup_files:
                if file != backup_file:  # 현재 생성된 백업 파일 제외
                    try:
                        os.remove(file)
                        self.stdout.write(f"Deleted old backup: {file}")
                    except OSError as e:
                        self.stdout.write(self.style.WARNING(f"Error deleting {file}: {e}"))
            
            self.stdout.write(self.style.SUCCESS(f'Backup created successfully at {backup_file}'))
        else:
            self.stdout.write(self.style.ERROR('Backup failed'))