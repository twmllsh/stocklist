from django.core.management import BaseCommand
from api.utils.dbupdater import DBUpdater

class Command(BaseCommand):
    help = 'Ticker 모델 업데이트 하는 명령'
 
    def handle(self, *args, **options):
        
        DBUpdater.update_ticker()
        
        
       
        