import asyncio
import os
import re
import pytz
# from dotenv import load_dotenv
from io import StringIO
import pandas as pd
import requests
from bs4 import BeautifulSoup
import OpenDartReader
# import nest_asyncio
# nest_asyncio.apply()
from playwright.async_api import async_playwright
from .sean_func import Text_mining
from api.models import *
from django.db.models import Max
from django.db import transaction

'''
각각 save 함수에 메세지 보내기 기능 추가하기. 
'''
# load_dotenv()
class MyDart:
    
    def __init__(self, OPEN_DART_TOKEN=None):
        
        self.max_concurrent_requests = 1
        if OPEN_DART_TOKEN is None:
            OPEN_DART_TOKEN = os.getenv("OPEN_DART_TOKEN")
        self.dart = OpenDartReader(OPEN_DART_TOKEN)
        if AllDart.objects.count():
            self.last_date = AllDart.objects.aggregate(Max('rcept_dt'))['rcept_dt__max']   ## db에서 가져온값.
            self.last_rcpNo = AllDart.objects.aggregate(Max('rcept_no'))['rcept_no__max']   ## db에서 가져온값.
            print('database 에서 마지막날짜 가져옴.')
            print('last_date', self.last_date)
            print('last_rcpNo', self.last_rcpNo)
        else:
            print('기존데이터가 없습니다.')
            self.last_date = None
            self.last_rcpNo = None
    
    
    
    def run(self,n=2):
        '''
        데이터 가져와서 저장까지 하기.
        '''
        if AllDart.objects.count():
            self.last_date = AllDart.objects.aggregate(Max('rcept_dt'))['rcept_dt__max']   ## db에서 가져온값.
            self.last_rcpNo = AllDart.objects.aggregate(Max('rcept_no'))['rcept_no__max']   ## db에서 가져온값.
            print('database 에서 마지막날짜 가져옴.')
            print('last_date', self.last_date)
            print('last_rcpNo', self.last_rcpNo)


        
        result = asyncio.run(self.get_data(n=n))
        # except Exception as e:
        #     print(f'{e} 데이터 가져오는중 에러발생으로 저장하지 않습니다.')
        #     return
        
        print('데이터 저장하는중')
        self.save_dart_all_to_db()
        print('데이터 저장완료')
        
    
    async def get_data(self,n=2):
        '''
        데이터만 가져오기
        '''
        self.dart_list = self.get_dart_list(n=n)

        # ## 실시간으로 감지할때 사용하는 방법.
        # tasks = [self.get_contract_data_by_df(),
        #         self.get_rights_issue_data_by_df(),
        #         self.get_convertible_bond_data_by_df(),
        #         self.get_bonus_issue_data_by_df(),
        #         ]
        # self.contract, self.rights_issue, self.convertible_bond, self.bonus_issue = await asyncio.gather(*tasks,  return_exceptions=True)
        
        ## 데이터 수집할때 사용하는 임시작업 . 
        ## self.max_concurrent_requests = 1 로 설정됨.  
        self.contract = await self.get_contract_data_by_df()
        self.rights_issue = await self.get_rights_issue_data_by_df()
        self.convertible_bond = await self.get_convertible_bond_data_by_df()
        self.bonus_issue = await self.get_bonus_issue_data_by_df()
        
        
        #############################3
        # # 후처리.
        # if len(self.contract):
        #     self.contract = [item for item in self.contract if not isinstance(item, TypeError)]
        #     self.contract = [item for item in self.contract if len(item)!=0]
        # if len(self.rights_issue):
        #     self.rights_issue = [item for item in self.rights_issue if not isinstance(item, TypeError)]
        #     self.rights_issue = [item for item in self.rights_issue if len(item)!=0]
        # if len(self.convertible_bond):
        #     self.convertible_bond = [item for item in self.convertible_bond if not isinstance(item, TypeError)]
        #     self.convertible_bond = [item for item in self.convertible_bond if len(item)!=0]
        # if len(self.bonus_issue):
        #     self.bonus_issue = [item for item in self.bonus_issue if not isinstance(item, TypeError)]
        #     self.bonus_issue = [item for item in self.bonus_issue if len(item)!=0]
        
        
        ## 모두 성공하면 dart_list 로 저장하기.
        
        
        return self.contract, self.rights_issue, self.convertible_bond, self.bonus_issue 
    
    def delete_latest_data(self):
        all_dart = AllDart.objects.filter(rcept_dt__gt=self.last_date)
        if all_dart.count():
            all_dart.delete()
            print('최신데이터 삭제완료')
        contract = DartContract.objects.filter(rcept_dt__gt=self.last_date)
        if contract.count():
            contract.delete()
            print('contract 삭제완료')
        rights_issue = DartRightsIssue.objects.filter(rcept_dt__gt=self.last_date)
        if rights_issue.count():
            rights_issue.delete()
            print('rights_issue 삭제완료')
        convertible_bond = DartConvertibleBond.objects.filter(rcept_dt__gt=self.last_date)
        if convertible_bond.count():
            convertible_bond.delete()
            print('convertible_bond 삭제완료')
        bonus_issue = DartBonusIssue.objects.filter(rcept_dt__gt=self.last_date)
        if bonus_issue.count():
            bonus_issue.delete()
            print('bonus_issue 삭제완료')
        
        
    
    def save_dart_list(self):
        if len(self.dart_list) == 0:
            print('데이터가 없습니다.')
            return 
        to_create = []
        new_tickers = []
        exist_tickers = { ticker.code:ticker for ticker in Ticker.objects.all()  }
        for item in self.dart_list.to_dict('records'):
            code = item.pop('stock_code')
            if code is None:
                continue
            if len(item['report_nm']) > 100:
                item['report_nm'] = item['report_nm'][:100]
            if code not in exist_tickers:
                ticker = Ticker(
                    code = code,
                    name = item.get('corp_name'),
                    구분 = item.get('corp_cls')
                )
                new_tickers.append(ticker)
                exist_tickers[code] = (
                    ticker  # 새로만든 ticker도 tickers_dict에 넣어줘야 위에서 다시 만들지 않는다.
                )
            else:
                ticker = exist_tickers[code]
                
            object = AllDart(ticker=ticker, **item)
            to_create.append(object)
            
            # 일정 개수 이상일 때 bulk_create()로 한 번에 저장
            bulk_cnt = 10000
            if len(to_create) >= bulk_cnt:
                with transaction.atomic():
                    print(f" --{bulk_cnt}개 bulk_create중....")
                    if new_tickers:
                        print(f"새로운 ticker정보 {len(new_tickers)}개 저장!")
                        Ticker.objects.bulk_create(new_tickers)
                        new_tickers = []
                    AllDart.objects.bulk_create(
                        to_create, batch_size=2000
                    )
                    to_create = []  # 저장 후 리스트 초기화

        # 남은 객체들도 저장
        try:
            with transaction.atomic():
                if to_create:
                    print(f"{len(to_create)} 개 last bulk_create중..")
                    if new_tickers:
                        print(f"새로운 ticker정보 {len(new_tickers)}개 저장!")
                        Ticker.objects.bulk_create(new_tickers)
                        new_tickers = []
                        
                    AllDart.objects.bulk_create(to_create)
                    to_create = []
                print('bulk_create:', )
        except Exception as e:
            print('bulk_create error AAA:', e)

    def save_bonus_issue(self):
        
        if len(self.bonus_issue):
            exist_tickers = { ticker.code:ticker for ticker in Ticker.objects.all()  }
            to_create = []
            for dic in self.bonus_issue:
                code = dic.pop('code')
                if code not in exist_tickers:
                    ticker = Ticker.objects.create(code=code, name=dic['name'])
                else:
                    ticker = exist_tickers[code]
                object = DartBonusIssue(ticker=ticker, **dic)
                to_create.append(object)
            
            with transaction.atomic():
                if to_create:
                    DartBonusIssue.objects.bulk_create(to_create)
                    print(f'{len(to_create)} bulk_create : bonus_issue' )
                    to_create = []
        else:
            print('bouns_issue is empty')
            
    def save_contract(self):
        
        if len(self.contract):
            exist_tickers = { ticker.code:ticker for ticker in Ticker.objects.all()  }
            to_create = []
            for dic in self.contract:
                code = dic.pop('code')
                if code not in exist_tickers:
                    ticker = Ticker.objects.create(code=code, name=dic['name'])
                else:
                    ticker = exist_tickers[code]
                if len(dic['name']) > 100:
                    dic['name'] = dic['name'][:100]
                if len(dic['계약내용']) > 100:
                    dic['계약내용'] = dic['계약내용'][:100]
                    
                if len(dic['계약상대방']) > 100:
                    dic['계약상대방'] = dic['계약상대방'][:100]
                    
                if len(dic['공급지역']) > 100:
                    dic['공급지역'] = dic['공급지역'][:100]
                    
                object = DartContract(ticker=ticker, **dic)
                to_create.append(object)
            
            with transaction.atomic():
                if to_create:
                    DartContract.objects.bulk_create(to_create)
                    print(f'{len(to_create)} bulk_create : contract', )
                    to_create = []
        else:
            print('contract is empty')
            
    def save_rights_issue(self):
        
        if len(self.rights_issue):
            exist_tickers = { ticker.code:ticker for ticker in Ticker.objects.all()  }
            to_create = []
            for dic in self.rights_issue:
                code = dic.pop('code')
                if code not in exist_tickers:
                    ticker = Ticker.objects.create(code=code, name=dic['name'])
                else:
                    ticker = exist_tickers[code]
                object = DartRightsIssue(ticker=ticker, **dic)
                to_create.append(object)
            
            with transaction.atomic():
                if to_create:
                    DartRightsIssue.objects.bulk_create(to_create)
                    print(f'{len(to_create)} bulk_create:rights_issue {len(to_create)}', )
                    to_create = []

        else:
            print('rights_issue is empty')
        
    def save_convertible_bond(self):
        
        if len(self.convertible_bond):
            exist_tickers = { ticker.code:ticker for ticker in Ticker.objects.all()  }
            to_create = []
            for dic in self.convertible_bond:
                code = dic.pop('code')
                if code not in exist_tickers:
                    ticker = Ticker.objects.create(code=code, name=dic['name'])
                else:
                    ticker = exist_tickers[code]
                object = DartConvertibleBond(ticker=ticker, **dic)
                to_create.append(object)
            
            with transaction.atomic():
                if to_create:
                    DartConvertibleBond.objects.bulk_create(to_create)
                    print(f'{len(to_create)} bulk_create: convertible_bond', )
                    to_create = []
        else:
            print('convertible_bond is empty')
    
    def save_dart_all_to_db(self):
    
        if len(self.contract) > 0:
            self.save_contract()
            
        if len(self.bonus_issue) > 0:
            self.save_bonus_issue()
            
        if len(self.convertible_bond) > 0:
            self.save_convertible_bond()
            
        if len(self.rights_issue) > 0:
            self.save_rights_issue()
            
        if len(self.dart_list) > 0:
            self.save_dart_list()
    
        
        
        
                    
    
    
    def get_dart_list(self, n=2):
        
        if self.last_date is None:
            self.last_date = pd.Timestamp.now().date() - pd.Timedelta(days=302)

        # self.last_date를 Timestamp로 변환
        self.last_date = pd.Timestamp(self.last_date)

        # 현재 시간을 'Asia/Seoul' 시간대로 변환
        now = pd.Timestamp.now(tz='Asia/Seoul')

        # self.last_date의 시간대가 없는 경우, 시간대 설정
        if self.last_date.tz is None:
            self.last_date = self.last_date.tz_localize('Asia/Seoul')
        else:
            self.last_date = self.last_date.tz_convert('Asia/Seoul')

        # date_range 생성
        dates = pd.date_range(self.last_date, now, freq='b')
        dates = dates[:n]  # 앞에서 5일만 작업하기
        print(dates)
        
        all_ls = []
        for date in dates:
            temp = self.dart.list_date_ex(date)
            print(date, '데이터 가져오는중.')
            if len(temp)>0:
                temp = temp.loc[temp['corp_cls'].str.contains("유|코")]
                all_ls.append(temp)
        df = pd.concat(all_ls)
        corp_codes = self.dart.corp_codes
        corp_codes = corp_codes.loc[corp_codes['stock_code'].str.len() > 5]
        df = pd.merge(df, corp_codes[['corp_name','stock_code']], how='left', on='corp_name')
        df = df.loc[:, ~df.columns.str.contains('flr_nm|rm')]
        download_cnt = len(df)
        if self.last_rcpNo:
            df = df.loc[df['rcept_no'] > self.last_rcpNo]
        if len(df)> 0 :
            df['rcept_dt'] = df['rcept_dt'].dt.tz_localize('Asia/Seoul')
        print(f"{len(df)} / {download_cnt} 공시데이터 작업시작!!")
        return df
    
    
    ## 공급계약 =================================
    async def get_second_url(self, playwright, rcpNo):
        async with async_playwright() as playwright:
            try:
                browser = await playwright.chromium.launch(headless=True)  # 헤드리스 모드로 브라우저 실행
                page = await browser.new_page()  # 새 페이지 생성
                first_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo}"
                await page.goto(first_url)  # URL로 이동
                element_id = "#ifrm"  # 기다릴 요소의 ID
                iframe_element = await page.wait_for_selector(element_id)  # 요소가 나타날 때까지 대기
                # iframe의 src 속성 가져오기
                iframe_src = await iframe_element.get_attribute("src")
                base_url = "https://dart.fss.or.kr"
                url = f"{base_url}{iframe_src}"
            except Exception as e:
                print(f"get_second_url error : {e}")
                return None
            await browser.close()  # 브라우저 종료
        return url
    
    async def get_contract(self, rcpNo, corp_name=None, code=None, rcept_dt=None):
        
        dic = {}
        dic['code'] = code
        dic['name'] = corp_name
        dic['rcept_dt'] = rcept_dt
        print(f"{corp_name} https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo} 공급계약 작업중.."  )
        url = await self.get_second_url(async_playwright(),rcpNo)
        if url is None:
            print(f"{corp_name} https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo} 공급계약 실패.."  )
            return {}
        print(url)
        
        resp = requests.get(url)
        stringio = StringIO(resp.text)
        dic['계약내용'] = Text_mining._extract_table(stringio, '공급계약', '공급계약 내용', verbose=False)
        
        dic['계약금액'] = Text_mining._extract_table(stringio, '공급계약', '계약금액 총액', verbose=False)
        try:
            dic['계약금액'] = int(dic['계약금액'])
        except:
            dic['계약금액'] = 0
        dic['계약상대방'] = Text_mining._extract_table(stringio, '공급계약', '계약상대', verbose=False)
        dic['공급지역'] = Text_mining._extract_table(stringio, '공급계약', '공급지역', verbose=False)
        매출액대비 = Text_mining._extract_table(stringio, '공급계약', '매출액 대비 -최근', verbose=False)
        try:
            dic['매출액대비'] = float(매출액대비)
        except:
            dic['매출액대비'] = None
        계약기간_시작 = Text_mining._extract_table(stringio, '공급계약', '계약기간 +시작 ', verbose=False)
        dic['계약기간_시작'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 계약기간_시작)).tz_localize('Asia/Seoul') if len(계약기간_시작) > 3 else None
        
        계약기간_종료 = Text_mining._extract_table(stringio, '공급계약', '계약기간 +종료', verbose=False)
        dic['계약기간_종료'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 계약기간_종료)).tz_localize('Asia/Seoul') if len(계약기간_종료) > 3 else None
        
        try:
            계약기간일 = dic['계약기간_종료'] - dic['계약기간_시작']
            dic['계약기간일'] = 계약기간일.days
        except:
            dic['계약기간일'] = -1
            
        계약일 = Text_mining._extract_table(stringio, '공급계약', '계약 +수주 +일 ', verbose=False)
        dic['계약일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 계약일)).tz_localize('Asia/Seoul') if len(계약일) > 3 else None

        
        result_dict= {}
        for key, value in dic.items():
            if isinstance(value, str):  # 값이 문자열인지 확인
                if len(value) > 99:  # 길이가 100을 넘는지 확인
                    result_dict[key] = value[:99]  # 100글자로 잘라서 저장
                else:
                    result_dict[key] = value  # 길이가 100 이하일 경우 원본 저장
            else:
                result_dict[key] = value  # 문자열이 아닐 경우 원본 저장

        if not 'code' in result_dict.keys():
            print('code is not in result_dict')
            print('dic:;', dic)
            print('result_dict :;', result_dict)
            print('url:: ', url)
        return result_dict
    
    async def get_contract_data_by_df(self):
        df = self.dart_list
        contract_df = df.loc[df['report_nm'].str.contains('공급계약') & ~df['report_nm'].str.contains('기재정정|해지')]
        if len(contract_df)==0:
            print('No contract_data!')
            return []
            
        max_concurrent_requests = self.max_concurrent_requests
        semaphore = asyncio.Semaphore(max_concurrent_requests)

        async def limited_get_contract(rcpNo, corp_name, code,rcept_dt):
            async with semaphore:  # 세마포어를 사용하여 동시 작업 수 제한
                return await self.get_contract(rcpNo, corp_name, code,rcept_dt)

        # 모든 계약 요청을 비동기적으로 실행
        tasks = [limited_get_contract(row['rcept_no'], row['corp_name'], row['stock_code'], row['rcept_dt']) 
                 for _, row in contract_df.iterrows()]
        results = await asyncio.gather(*tasks,  return_exceptions=True)
        # 후처리.
        self.contract = results
        if len(self.contract):
            self.contract = [item for item in self.contract if not isinstance(item, TypeError)]
            self.contract = [item for item in self.contract if isinstance(item, dict)]
            self.contract = [item for item in self.contract if len(item)!=0]
            try:
                self.contract = [item for item in self.contract if item['code'] is not None and item['code'] != 'nan']
            except:
                pass
            

        return self.contract
    
    ## 유상증자
    async def get_rights_issue(self, rcpNo, corp_name=None, code=None, rcept_dt=None):
        '''
        제3자배정유상증자.
        '''
        dic = {}
        dic['code'] = code
        dic['name'] = corp_name
        dic['rcept_dt'] = rcept_dt
        temp_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo}"
        try:
            second_url = self.dart.sub_docs(rcpNo)['url'].iloc[-1]
            print(f"{corp_name} {temp_url} 제3자배정유증 작업중.."  )
        except:
            try:
                second_url = await self.get_second_url(async_playwright(),rcpNo)
                print(f"{corp_name} {second_url} 제3자배정유증 작업중 subdoc 실패로 playwright 가동..."  )
            except:                
                temp_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo}"
                print('sub_docs failed : ',  temp_url , '제3자배정유증 작업실패')
                return {}
        
        resp = requests.get(second_url)
        stringio = StringIO(resp.text)
        
        dic['증자방식'] = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'증자방식' )
        if "3" not in dic['증자방식']:
            return {}
        보통신주의수 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'신주 +보통주식' )
        기타신주의수 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'신주 +기타주식' )
        try:
            보통신주의수 = int(보통신주의수)
        except:
            보통신주의수 = 0
        try:
            기타신주의수 = int(기타신주의수)
        except:
            기타신주의수 = 0
        dic['신주의수'] = 보통신주의수 + 기타신주의수

        dic['증자전주식수'] = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'증자전 주식수' )

        dic['신주비율'] = round((dic['신주의수'] / dic['증자전주식수']) * 100 , 1)

        자금조달목적_list = []
        시설자금 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 +시설' )
        if isinstance(시설자금, (int, float)):
            자금조달목적_list.append('시설자금')
        영업양수자금 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 +영업양수자금' )
        if isinstance(영업양수자금, (int, float)):
            자금조달목적_list.append('영업양수자금')
        운영자금 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 +운영' )
        if isinstance(운영자금, (int, float)):
            자금조달목적_list.append('운영자금')
        채무상환자금 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 +채무' )
        if isinstance(채무상환자금, (int, float)):
            자금조달목적_list.append('채무상환자금')
        타법인증권 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 +타법인' )
        if isinstance(타법인증권, (int, float)):
            자금조달목적_list.append('타법인증권')
        취득자금 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 _취득' )
        if isinstance(취득자금, (int, float)):
            자금조달목적_list.append('취득자금')
        기타자금 = Text_mining._extract_table(stringio, '액면가 자금조달 ' ,'목적 +기타' )
        if isinstance(기타자금, (int, float)):
            자금조달목적_list.append('기타자금')
        dic['자금조달목적'] = ','.join(자금조달목적_list)
        try:
            dic['발행가액']= Text_mining._extract_table(stringio, '발행가액 납입 ' ,'발행가액 +보통주식' )
            dic['발행가액'] = int(dic['발행가액'])
        except:
            dic['발행가액'] = 0
        납입일 = Text_mining._extract_table(stringio, '발행가액 납입 ' ,'납입' )
        신주의배당기산일 = Text_mining._extract_table(stringio, '발행가액 납입 ' ,'배당기산' )
        신주의상장예정일 = Text_mining._extract_table(stringio, '발행가액 납입 ' ,'상장예정' )
        dic['납입일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 납입일)).tz_localize('Asia/Seoul') if len(납입일) > 3 else None
        dic['배당기산일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 신주의배당기산일)).tz_localize('Asia/Seoul') if len(신주의배당기산일) > 3 else None
        dic['상장예정일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 신주의상장예정일)).tz_localize('Asia/Seoul') if len(신주의상장예정일) > 3 else None

        dic['제3자배정대상자'] = Text_mining._extract_table(stringio, '제3자배정 +대상자 -배정내역' , col_match=0)
        dic['제3자배정대상자관계'] = Text_mining._extract_table(stringio, '제3자배정 +대상자 -배정내역' , col_match=1)
        dic['제3자배정대상자선정경위'] = Text_mining._extract_table(stringio, '제3자배정 +대상자 -배정내역' , col_match=2)
        
        result_dict= {}
        for key, value in dic.items():
            if isinstance(value, str):  # 값이 문자열인지 확인
                if len(value) > 99:  # 길이가 100을 넘는지 확인
                    result_dict[key] = value[:99]  # 100글자로 잘라서 저장
                else:
                    result_dict[key] = value  # 길이가 100 이하일 경우 원본 저장
            else:
                result_dict[key] = value  # 문자열이 아닐 경우 원본 저장
        
        return result_dict
    
    async def get_rights_issue_data_by_df(self):
        df = self.dart_list
        rights_issue_df = df.loc[df['report_nm'].str.contains('유상증자결정') & ~df['report_nm'].str.contains('기재정정')]
        if len(rights_issue_df)==0:
            print('No rights_issue_data!')
            return []
        max_concurrent_requests = self.max_concurrent_requests
        semaphore = asyncio.Semaphore(max_concurrent_requests)
        
        async def limited_get_data(rcpNo, corp_name, code, rcept_dt):
            async with semaphore:  # 세마포어를 사용하여 동시 작업 수 제한
                return await self.get_rights_issue(rcpNo, corp_name, code, rcept_dt)
        
        # 모든 계약 요청을 비동기적으로 실행
        tasks = [limited_get_data(row['rcept_no'],  row['corp_name'], row['stock_code'], row['rcept_dt']) 
                 for _, row in rights_issue_df.iterrows()]
        results = await asyncio.gather(*tasks,  return_exceptions=True)
        # 후처리.
        self.rights_issue = results
        if len(self.rights_issue):
            self.rights_issue = [item for item in self.rights_issue if not isinstance(item, TypeError)]
            self.rights_issue = [item for item in self.rights_issue if isinstance(item, dict)]
            self.rights_issue = [item for item in self.rights_issue if len(item)!=0]
            try:
                self.rights_issue = [item for item in self.rights_issue if item['code'] is not None and item['code'] != 'nan']
            except:
                pass

        return self.rights_issue
    
## 전환사채
    async def get_convertible_bond(self, rcpNo, corp_name=None, code=None, rcept_dt=None):
        '''
        CB
        '''
        try:
            dic = {}
            dic['code'] = code
            dic['name'] = corp_name
            dic['rcept_dt'] = rcept_dt
            temp_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo}"
            try:
                second_url = self.dart.sub_docs(rcpNo)['url'].iloc[-1]
                print(f"{corp_name} {temp_url} 전환사채 작업중.."  )
            except:
                print('sub_docs failed : ',  temp_url , '전환사채 작업실패')
                return {}
            resp = requests.get(second_url)
            stringio = StringIO(resp.text)

            dic['전환사채총액'] = Text_mining._extract_table(stringio, '사채의 종류', '사채의 총액 +(원)')
            try:
                dic['전환사채총액'] = int(dic['전환사채총액'])
            except:
                dic['전환사채총액'] = 0
                
            자금조달목적_list = []
            시설자금 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 +시설' )
            if isinstance(시설자금, (int, float)):
                자금조달목적_list.append('시설자금')
            영업양수자금 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 +영업양수자금' )
            if isinstance(영업양수자금, (int, float)):
                자금조달목적_list.append('영업양수자금')
            운영자금 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 +운영' )
            if isinstance(운영자금, (int, float)):
                자금조달목적_list.append('운영자금')
            채무상환자금 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 +채무' )
            if isinstance(채무상환자금, (int, float)):
                자금조달목적_list.append('채무상환자금')
            타법인증권 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 +타법인' )
            if isinstance(타법인증권, (int, float)):
                자금조달목적_list.append('타법인증권')
            취득자금 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 _취득' )
            if isinstance(취득자금, (int, float)):
                자금조달목적_list.append('취득자금')
            기타자금 = Text_mining._extract_table(stringio, '자금조달 목적' ,'목적 +기타' )
            if isinstance(기타자금, (int, float)):
                자금조달목적_list.append('기타자금')
            dic['자금조달목적'] = ','.join(자금조달목적_list)

            표면이자율 = Text_mining._extract_table(stringio, '사채의 종류', '표면 이자 (%)')
            만기이자율 = Text_mining._extract_table(stringio, '사채의 종류', '만기 이자 (%)')
            try:
                dic['표면이자율'] = float(표면이자율)
            except:
                dic['표면이자율'] = None
            try:
                dic['만기이자율'] = float(만기이자율)
            except:
                dic['만기이자율'] = None

            
            dic['전환가액'] = Text_mining._extract_table(stringio, '사채의 종류', '전환가 가액')

            전환청구시작일 = Text_mining._extract_table(stringio, '사채의 종류', '전환청구 시작')
            전환청구종료일 = Text_mining._extract_table(stringio, '사채의 종류', '전환청구 종료')
            dic['전환청구시작일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 전환청구시작일)).tz_localize('Asia/Seoul') if len(전환청구시작일) > 3 else None
            dic['전환청구종료일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 전환청구종료일)).tz_localize('Asia/Seoul') if len(전환청구종료일) > 3 else None
            
            dic['발행주식수'] = Text_mining._extract_table(stringio, '사채의 종류', '전환 발행 +주식수')
            
            주식총수대비비율 = Text_mining._extract_table(stringio, '사채의 종류', '대비 비율 +총수')
            try:
                주식총수대비비율 = float(주식총수대비비율)
            except:
                주식총수대비비율 = None
            dic['주식총수대비비율'] = 주식총수대비비율
        except Exception as e:
            print(f"get_convertible_bond error : {e}")
            return {}
        
        result_dict= {}
        for key, value in dic.items():
            if isinstance(value, str):  # 값이 문자열인지 확인
                if len(value) > 99:  # 길이가 100을 넘는지 확인
                    result_dict[key] = value[:99]  # 100글자로 잘라서 저장
                else:
                    result_dict[key] = value  # 길이가 100 이하일 경우 원본 저장
            else:
                result_dict[key] = value  # 문자열이 아닐 경우 원본 저장
        
        return result_dict
    
    async def get_convertible_bond_data_by_df(self):
        df = self.dart_list
        convertible_bond_df = df.loc[df['report_nm'].str.contains('전환사채권발행결정') & ~df['report_nm'].str.contains('첨부정정|기재정정|해지')]
        if len(convertible_bond_df)==0:
            print('No convertible_bond_data!')
            return []
        max_concurrent_requests = self.max_concurrent_requests
        semaphore = asyncio.Semaphore(max_concurrent_requests)
        
        async def limited_get_data(rcpNo, corp_name, code, rcept_dt):
            async with semaphore:  # 세마포어를 사용하여 동시 작업 수 제한
                return await self.get_convertible_bond(rcpNo, corp_name, code, rcept_dt)
        
        # 모든 계약 요청을 비동기적으로 실행
        tasks = [limited_get_data(row['rcept_no'],  row['corp_name'], row['stock_code'], row['rcept_dt']) 
                 for _, row in convertible_bond_df.iterrows()]
        results = await asyncio.gather(*tasks,  return_exceptions=True)
        # 후처리.
        self.convertible_bond = results
        if len(self.convertible_bond):
            self.convertible_bond = [item for item in self.convertible_bond if not isinstance(item, TypeError)]
            self.convertible_bond = [item for item in self.convertible_bond if isinstance(item, dict)]
            self.convertible_bond = [item for item in self.convertible_bond if len(item)!=0]
            try:
                self.convertible_bond = [item for item in self.convertible_bond if item['code'] is not None and item['code'] != 'nan']
            except:
                pass
        return self.convertible_bond

    ## 무상증자
    async def get_bonus_issue(self, rcpNo, corp_name=None, code=None, rcept_dt=None):
        '''
        무상증자
        '''
        dic = {}
        dic['code'] = code
        dic['name'] = corp_name
        dic['rcept_dt'] = rcept_dt
        temp_url = f"https://dart.fss.or.kr/dsaf001/main.do?rcpNo={rcpNo}"
        try:
            second_url = self.dart.sub_docs(rcpNo)['url'].iloc[-1]
            print(f"{corp_name} {temp_url} 무상증자 작업중.."  )
        except:
            print('sub_docs failed : ',  temp_url , '무상증자 작업실패')
            return {}
        resp = requests.get(second_url)
        stringio = StringIO(resp.text)
        
        보통신주의수 = Text_mining._extract_table(stringio, '신주배정 종류와 수', '보통')
        기타신주의수 = Text_mining._extract_table(stringio, '신주배정 종류와 수', '기타')
        try:
            보통신주의수 = int(보통신주의수)
        except:
            보통신주의수 = 0
        try:
            기타신주의수 = int(기타신주의수)
        except:
            기타신주의수 = 0
        dic['신주의수'] = 보통신주의수 + 기타신주의수

        주당배정보통주식수 = Text_mining._extract_table(stringio, '신주배정 종류와 수', '+신주배정 +1주당 +보통주식 (주)')
        try:
            dic['주당배정주식수'] = float(주당배정보통주식수)
        except:
            dic['주당배정주식수'] = 0

        배당기산일 = Text_mining._extract_table(stringio, '신주배정 종류와 수', '배당기산일')
        dic['배당기산일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 배당기산일)).tz_localize('Asia/Seoul') if len(배당기산일) > 3 else None

        상장예정일 = Text_mining._extract_table(stringio, '신주배정 종류와 수', '+상장 예정일')
        dic['상장예정일'] = pd.to_datetime(re.sub(r'[가-힣]', '-', 상장예정일)).tz_localize('Asia/Seoul') if len(상장예정일) > 3 else None

        result_dict= {}
        for key, value in dic.items():
            if isinstance(value, str):  # 값이 문자열인지 확인
                if len(value) > 99:  # 길이가 100을 넘는지 확인
                    result_dict[key] = value[:99]  # 100글자로 잘라서 저장
                else:
                    result_dict[key] = value  # 길이가 100 이하일 경우 원본 저장
            else:
                result_dict[key] = value  # 문자열이 아닐 경우 원본 저장
        
        return result_dict

    
    async def get_bonus_issue_data_by_df(self):
        df = self.dart_list
        bonus_issue_df = df.loc[df['report_nm'].str.contains('무상증자결정') & ~df['report_nm'].str.contains('기재정정|유무상|해지')]
        if len(bonus_issue_df)==0:
            print('No bonus_issue data!')
            return []
        max_concurrent_requests = self.max_concurrent_requests
        semaphore = asyncio.Semaphore(max_concurrent_requests)
        
        async def limited_get_data(rcpNo,  corp_name, code, rcept_dt):
            async with semaphore:  # 세마포어를 사용하여 동시 작업 수 제한
                return await self.get_bonus_issue(rcpNo, corp_name, code, rcept_dt)
        
        # 모든 계약 요청을 비동기적으로 실행
        tasks = [limited_get_data(row['rcept_no'],  row['corp_name'], row['stock_code'], row['rcept_dt']) 
                 for _, row in bonus_issue_df.iterrows()]
        results = await asyncio.gather(*tasks,  return_exceptions=True)
        # 후처리.
        self.bonus_issue = results
        if len(self.bonus_issue):
            self.bonus_issue = [item for item in self.bonus_issue if not isinstance(item, TypeError)]
            self.bonus_issue = [item for item in self.bonus_issue if isinstance(item, dict)]
            self.bonus_issue = [item for item in self.bonus_issue if len(item)!=0]
            try:
                self.bonus_issue = [item for item in self.bonus_issue if item['code'] is not None and item['code'] != 'nan']
            except:
                pass
        return self.bonus_issue
    
    
    def delete_dupplication_dartModel(self, dartModel:models.Model):
        from django.db.models import Count
        if dartModel.__name__== "DartConvertibleBond":
            temp_col = '전환사채총액'
        elif dartModel.__name__ == "DartContract":
            temp_col = '계약상대방'
        elif dartModel.__name__ == "DartRightsIssue":
            temp_col = '제3자배정대상자'
        elif dartModel.__name__ == "DartBonusIssue":
            temp_col = '주당배정주식수'
        else:
            print('no dartModel !')
            return
        print("temp_col: ", temp_col)
        
            
        old_cnt = dartModel.objects.count()
        # 중복된 데이터 찾기
        duplicates = (
            dartModel.objects
            .values('rcept_dt', temp_col)
            .annotate(count=Count('id'))
            .filter(count__gt=1)
        )
        # 중복된 데이터 삭제
     
        for duplicate in duplicates:
            filter_dict = {
                "rcept_dt": duplicate['rcept_dt'],
                f"{temp_col}":duplicate[temp_col]
            }
            
            # 중복된 데이터 가져오기 (그룹화된 필드로)
            duplicate_records = dartModel.objects.filter(
                **filter_dict
            )
            
            # 첫 번째 항목을 제외한 나머지 항목 삭제
            duplicate_records.exclude(id=duplicate_records.first().id).delete()
            
        new_cnt = dartModel.objects.count()
        print(f" {str(dartModel)} 중복 제거 완료. {old_cnt} -> {new_cnt}")
    
    
    def delete_dupplication_convertible_bond(self):
        from django.db.models import Count
        old_cnt = DartConvertibleBond.objects.count()
        # 중복된 데이터 찾기
        duplicates = (
            DartConvertibleBond.objects
            .values('rcept_dt', '전환사채총액')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
        )
        # 중복된 데이터 삭제
        for duplicate in duplicates:
            # 중복된 데이터 가져오기 (그룹화된 필드로)
            duplicate_records = DartConvertibleBond.objects.filter(
                rcept_dt=duplicate['rcept_dt'],
                전환사채총액=duplicate['전환사채총액']
            )
            
            # 첫 번째 항목을 제외한 나머지 항목 삭제
            duplicate_records.exclude(id=duplicate_records.first().id).delete()
            
        new_cnt = DartConvertibleBond.objects.count()
        print(f"DartConvertibleBond 중복 제거 완료. {old_cnt} -> {new_cnt}")
    
    
    def delete_dupplication_contract(self):
        from django.db.models import Count
        old_cnt = DartContract.objects.count()
        # 중복된 데이터 찾기
        duplicates = (
            DartContract.objects
            .values('rcept_dt', '계약상대방')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
        )
        # 중복된 데이터 삭제
        for duplicate in duplicates:
            # 중복된 데이터 가져오기 (그룹화된 필드로)
            duplicate_records = DartContract.objects.filter(
                rcept_dt=duplicate['rcept_dt'],
                전환사채총액=duplicate['계약상대방']
            )
            
            # 첫 번째 항목을 제외한 나머지 항목 삭제
            duplicate_records.exclude(id=duplicate_records.first().id).delete()
            
        new_cnt = DartContract.objects.count()
        print(f"DartContract 중복 제거 완료. {old_cnt} -> {new_cnt}")
        
    def delete_dupplication_dartrightsIssue(self):
        from django.db.models import Count
        old_cnt = DartRightsIssue.objects.count()
        # 중복된 데이터 찾기
        duplicates = (
            DartRightsIssue.objects
            .values('rcept_dt', '제3자배정대상자')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
        )
        # 중복된 데이터 삭제
        for duplicate in duplicates:
            # 중복된 데이터 가져오기 (그룹화된 필드로)
            duplicate_records = DartRightsIssue.objects.filter(
                rcept_dt=duplicate['rcept_dt'],
                전환사채총액=duplicate['제3자배정대상자']
            )
            
            # 첫 번째 항목을 제외한 나머지 항목 삭제
            duplicate_records.exclude(id=duplicate_records.first().id).delete()
            
        new_cnt = DartRightsIssue.objects.count()
        print(f"DartRightsIssue 중복 제거 완료. {old_cnt} -> {new_cnt}")
        
    def delete_dupplication_bonus(self):
        from django.db.models import Count
        old_cnt = DartBonusIssue.objects.count()
        # 중복된 데이터 찾기
        duplicates = (
            DartBonusIssue.objects
            .values('rcept_dt', '주당배정주식수')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
        )
        # 중복된 데이터 삭제
        for duplicate in duplicates:
            # 중복된 데이터 가져오기 (그룹화된 필드로)
            duplicate_records = DartBonusIssue.objects.filter(
                rcept_dt=duplicate['rcept_dt'],
                전환사채총액=duplicate['주당배정주식수']
            )
            
            # 첫 번째 항목을 제외한 나머지 항목 삭제
            duplicate_records.exclude(id=duplicate_records.first().id).delete()
            
        new_cnt = DartBonusIssue.objects.count()
        print(f"DartBonusIssue 중복 제거 완료. {old_cnt} -> {new_cnt}")
        
if __name__ == "__main__":
    mydart = MyDart()
    mydart.run()
    
    print("===========================================")
    print(mydart.contract)
    print("===========================================")
    print(mydart.rights_issue)
    print("===========================================")
    print(mydart.convertible_bond)
    print("===========================================")
    print(mydart.bonus_issue)
    print("===========================================")