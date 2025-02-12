# backend/api/management/commands/restore_db.py
### 복구할때 사용명령어.
# python manage.py restore_db db_backups/backup_20240321_010000.sql


import os
from django.core.management.base import BaseCommand
from django.conf import settings

class Command(BaseCommand):
    help = 'Restore PostgreSQL database from backup'

    def add_arguments(self, parser):
        parser.add_argument('backup_file', type=str, help='Backup file name to restore from')

    def handle(self, *args, **kwargs):
        backup_file = kwargs['backup_file']
        if not os.path.exists(backup_file):
            self.stdout.write(self.style.ERROR(f'Backup file not found: {backup_file}'))
            return

        # psql 명령어 생성
        cmd = f'psql -h {settings.DATABASES["default"]["HOST"]} '\
              f'-U {settings.DATABASES["default"]["USER"]} '\
              f'-d {settings.DATABASES["default"]["NAME"]} '\
              f'-f {backup_file}'

        # 복구 실행
        os.environ['PGPASSWORD'] = settings.DATABASES['default']['PASSWORD']
        exit_code = os.system(cmd)
        
        if exit_code == 0:
            self.stdout.write(self.style.SUCCESS('Database restored successfully'))
        else:
            self.stdout.write(self.style.ERROR('Database restore failed'))