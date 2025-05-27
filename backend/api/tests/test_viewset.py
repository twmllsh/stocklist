from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from api.models import *

class TickerViewSetTests(APITestCase):
    def setUp(self):
        # 테스트용 티커 데이터 생성
        Ticker.objects.create(code='000100', name='TestCorp1')
        Ticker.objects.create(code='000200', name='TestCorp2')

    def test_list_filter_by_code(self):
        """쿼리 파라미터 ticker=000100 으로 필터링 테스트"""
        # reverse() 대신 직접 URL 지정
        url = "/api/ticker/"
        response = self.client.get(url, {'ticker': '000100'})
        print("test data : ", response.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 필터링된 결과는 1개이어야 함
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['code'], '000100')



class InfoViewSetTests(APITestCase):
    def setUp(self):
        # 테스트용 티커 데이터 생성
        self.ticker = Ticker.objects.create(code='000100', name='testTicker')
        
        # 테스트용 Info 데이터 생성
        Info.objects.create(
            ticker=self.ticker,
            id = 367,
            date = "2025-05-23",
            상장주식수 = 5919637922.0,
            외국인한도주식수 = 5919637922.0,
            외국인보유주식수 = 2940153011.0,
            외국인소진율 = 49.67,
            액면가 = 100.0,
            ROE = None,
            EPS = None,
            PER = 11.05,
            PBR = 0.94,
            주당배당금 = None,
            배당수익율 = 2.67,
            구분 = "코스피",
            업종 = "전기·전자",
            FICS = "반도체 및 관련장비",
            시가총액 = 3208444.0,
            시가총액순위 = 1,
            외국인보유비중 = 49.67,
            유동주식수 = 3268.0,
            유동비율 = 1796.0,
            보통발행주식수 = 5919.0,
            우선발행주식수 = 815974.0,
            PER_12M = 10.62,
            배당수익률 = 2.64,
            동일업종저per_name = "",
            동일업종저per_code = "",
        )
    
    def test_list_filter_by_ticker(self):
        """쿼리 파라미터 ticker=005930 으로 필터링 테스트"""
        url = "/api/info/"
        response = self.client.get(url, {'ticker': '000100'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 필터링된 결과는 1개이어야 함
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ticker'], self.ticker.code)
        for item in ['상장주식수','외국인보유주식수','외국인소진율']:
            self.assertIn(item, response.data[0].keys()) 
        
        

class ShortViewSetTests(APITestCase):
    def setUp(self):
        # 테스트용 티커 데이터 생성
        self.ticker = Ticker.objects.create(code='000100', name='testTicker')
        Short.objects.create(ticker=self.ticker,
            Date="2025-05-23",
            공매도=10,
            매수=100,
            비중=0.05,)
        
    def test_list_filter_by_ticker(self):
        """쿼리 파라미터 ticker=000100 으로 필터링 테스트"""
        url = "/api/short/"
        response = self.client.get(url, {'ticker': '000100'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # 필터링된 결과는 1개이어야 함
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ticker'], self.ticker.code)
        for item in ['공매도', '매수', '비중']:
            self.assertIn(item, response.data[0].keys())
