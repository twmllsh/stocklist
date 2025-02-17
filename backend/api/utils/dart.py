import os
import requests
from bs4 import BeautifulSoup
import pandas as pd
import OpenDartReader

OPEN_DART_TOKEN = os.getenv('OPEN_DART_TOKEN', default="32bd9dd01c08811f4d14a149e773a033e62166c5")


class DartData():
    def __init__(self):
        self.dart = OpenDartReader(OPEN_DART_TOKEN) 
        self.last_report_no = "" # db에서 마지막값 가져오기.
        
    
    def check_new_data(self):
        today = pd.Timestamp.today().date()
        df = self.dart.list_date_ex(today)
        df = df.loc[df['corp_cls'].str.contains("유|코")]
        new_df = df[df['rcept_no'] > self.last_report_no]
        self.new_df = new_df
    
    def get_contract(self):
        '''
        공급계약 정보 가져와 저장하기. 
        report_no 로 url 만들어서 각 데이터 가져오기.  방식.
        '''
        if self.new_df > 0: 
            print('공급계약 데이턱 있는지 혹인.')
            print('새로운데이터 작업 시작')
        else:
            print('새로운데이터가 없습니다. ')
    
    def get_무상증자(self):
        '''
        dart.event('휴림네트웍스', '유상증자') # 휴림네트웍스(192410)
        dart.event('미원상사', '무상증자') # 미원상사(084990)
        dart.event('017810', '전환사채발행') # 풀무원(017810)

        dart.report('005930', '증자', 2021) # 증자(감자) 현황
        dart.report('005930', '배당', 2018)  # 배당에 관한 사항
        '''
        
        pass
    