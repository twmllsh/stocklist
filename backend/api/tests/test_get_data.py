from django.test import SimpleTestCase
import asyncio
import pandas as pd
from api.utils.dbupdater import GetData 
from pykrx import stock as pystock

class GetDataTests(SimpleTestCase):
    def test_get_code_info_df_async(self):
        """GetData.get_code_info_df_async()가 DataFrame을 반환하는지 확인"""
        df = asyncio.run(GetData.get_code_info_df_async())

        # 반환 타입 확인
        self.assertIsInstance(df, pd.DataFrame)

        # 필수 컬럼 존재 확인
        for col in ("code", "name", "gb"):
            self.assertIn(col, df.columns)

        # 최소 한 건 이상 조회
        self.assertGreater(len(df), 0)

class GetInfoAsyncTests(SimpleTestCase):
    def test_get_info_async_returns_expected_structure(self):
        """_get_info_async(code,name) 호출 시 (dict, dict, dict) 반환 및 code/name 확인"""
        dic, traderinfo, finstats = asyncio.run(
            GetData._get_info_async('005930', '삼성전자')
        )

        # 반환 타입 확인
        self.assertIsInstance(dic, dict)
        self.assertIsInstance(traderinfo, dict)
        self.assertIsInstance(finstats, dict)

        # 필수 키 확인
        self.assertEqual(dic.get('code'), '005930')
        self.assertEqual(dic.get('name'), '삼성전자')
        
class GetInvestorAsyncTests(SimpleTestCase):
    def test_get_investor_async_returns_expected_structure(self):
        """_get_investor_all_async(date) 호출 시 df 반환 및 columns , 투자자 확인"""
        today = pd.Timestamp.now().date()
        start = today - pd.Timedelta(days=20)
        str_today = today.strftime('%Y%m%d')
        start = start.strftime('%Y%m%d')
        kospi= pystock.get_index_ohlcv(start, str_today, "1001")
        the_date = kospi.index[-2]
        the_date= the_date.strftime('%Y%m%d')
        df = asyncio.run(GetData._get_investor_all_async([the_date]))

        # 반환 타입 확인
        self.assertIsInstance(df, pd.DataFrame)
        
                # 필수 컬럼 존재 확인
        for col in ("code", "종목명", "순매수거래대금", '투자자', '날짜'):
            self.assertIn(col, df.columns)

        for item in ['개인', '외국인', '기관합계', '금융투자', '투신', '연기금', '보험', '사모', '은행', '기타금융',
       '기타법인', '기타외국인']:
            self.assertIn(item, df['투자자'].unique())
        # 최소 한 건 이상 조회
        self.assertGreater(len(df), 0)
        
class GetIssTests(SimpleTestCase):
    def test_get_iss_returns_expected_structure(self):
        """_get_investor_all_async(date) 호출 시 df 반환 및 columns , 투자자 확인"""
        # today = pd.Timestamp.now().date()
        # start = today - pd.Timedelta(days=20)
        # str_today = today.strftime('%Y%m%d')
        # start = start.strftime('%Y%m%d')
        # kospi= pystock.get_index_ohlcv(start, str_today, "1001")
        # the_date = kospi.index[-2]
        # the_date= the_date.strftime('%Y%m%d')
        df = GetData.get_iss_list()
        
        # 반환 타입 확인
        self.assertIsInstance(df, pd.DataFrame)
        
        # 필수 컬럼 존재 확인
        for col in ("issn", "iss_str", "hl_str", 'regdate', 'ralated_code_names'):
            self.assertIn(col, df.columns)

        # 최소 한 건 이상 조회
        self.assertGreater(len(df), 0)
        
class GetThemeUpjongTests(SimpleTestCase):
    def test_get_theme_async_returns_expected_structure(self):
        """_get_group_list_async() """
        data = asyncio.run(GetData._get_group_list_async('theme'))
        data1 = asyncio.run(GetData._get_group_list_async('upjong'))
        
        # 반환 타입 확인
        self.assertIsInstance(data, list )

        # 최소 한 건 이상 조회
        self.assertGreater(len(data), 0)
        self.assertGreater(len(data1), 0)
        
        self.assertGreater(len(data[0]), 0)
        self.assertGreater(len(data1[0]), 0)
        
        ## 상세정보 체크 확인
        name1 , url1 = data[0]
        name2 , url2 = data1[0]

        data3 = asyncio.run(GetData._get_theme_codelist_from_theme_async(name1, url1))
        data4 = asyncio.run(GetData._get_theme_codelist_from_theme_async(name2, url2))
        
        for item in ['name','code','code_name']:
            self.assertIn(item, data3[0].keys())
            self.assertIn(item, data4[0].keys())
        
        

class GetNewsTests(SimpleTestCase):
    def test_get_news_async_returns_expected_structure(self):
        """_get_news_async(date) 호출 시 데이터 및 구조 확인"""
        data = asyncio.run(GetData._get_news_from_stockplus_today())
        
        # 반환 타입 확인
        self.assertIsInstance(data, list)

        # 최소 한 건 이상 조회
        self.assertGreater(len(data), 0)
        
        # 필수 컬럼 존재 확인
        for col in ("no", "title", "createdAt", 'writerName'):
            self.assertIn(col, data[0].keys())
            
            
class GetOhlcvTests(SimpleTestCase):
    def test_get_ohlcv_async_returns_expected_structure(self):
        """_get_ohlcv_async(date) 호출 시 데이터 및 구조 확인"""
        today = pd.Timestamp.now().date()
        start = today - pd.Timedelta(days=20)
        str_today = today.strftime('%Y%m%d')
        start = start.strftime('%Y%m%d')
        kospi= pystock.get_index_ohlcv(start, str_today, "1001")
        the_date = kospi.index[-1]
        the_date= the_date.strftime('%Y%m%d')
        data = asyncio.run(GetData._get_news_from_stockplus_today())
        
        data = GetData.get_ohlcv_all_market(the_date)
        
        # 반환 타입 확인
        self.assertIsInstance(data, pd.DataFrame)

        # 최소 한 건 이상 조회
        self.assertGreater(len(data), 0)
        
        # 필수 컬럼 존재 확인
        for col in ("Date", "code", "Open", 'Close'):
            self.assertIn(col, data.columns)
            
class GetRealOhlcvTests(SimpleTestCase):
    def test_get_real_ohlcv_async_returns_expected_structure(self):
        """_get_real_ohlcv_async(date) 호출 시 데이터 및 구조 확인"""
       
        data = asyncio.run(GetData.get_data_from_naver())
    
        # 반환 타입 확인
        self.assertIsInstance(data, pd.DataFrame)

        # 최소 한 건 이상 조회
        self.assertGreater(len(data), 0)
        
        # 필수 컬럼 존재 확인
        for col in ("종목명", "현재가", "등락률", '거래량', '매수총잔량', '매도총잔량'):
            self.assertIn(col, data.columns)