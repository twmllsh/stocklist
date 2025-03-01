from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from api.models import AllDart, Ticker
from django.utils import timezone

class AllDartViewSetTests(APITestCase):
    def setUp(self):
        # 테스트용 데이터 생성
        self.ticker = Ticker.objects.create(
            code='005930',
            name='삼성전자',
            구분='코스피'
        )
        
        # 샘플 공시 데이터 생성
        self.dart_data = AllDart.objects.create(
            ticker=self.ticker,
            rcept_dt=timezone.now(),
            rcept_no='20240101000001',
            report_nm='테스트 공시',
            corp_cls='유가증권',
        )
        
        # API 클라이언트 설정
        self.client = APIClient()

    def test_get_dart_list(self):
        """
        공시 목록 조회 테스트
        """
        url = reverse('api:dart-list')  # URL pattern name 수정
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['report_nm'], '테스트 공시')

    def test_get_dart_by_ticker(self):
        """
        특정 종목 공시 조회 테스트
        """
        url = reverse('api:dart-list')  # URL pattern name 수정
        response = self.client.get(url, {'ticker': '005930'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['ticker']['code'], '005930')

    def test_get_dart_order(self):
        """
        공시 정렬 테스트 (최신순)
        """
        # 추가 테스트 데이터 생성
        older_dart = AllDart.objects.create(
            ticker=self.ticker,
            rcept_dt=timezone.now() - timezone.timedelta(days=1),
            rcept_no='20240101000002',
            report_nm='이전 공시',
            corp_cls='유가증권',
        )
        
        url = reverse('api:alldart-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['report_nm'], '테스트 공시')
        self.assertEqual(response.data[1]['report_nm'], '이전 공시')

    def test_invalid_ticker(self):
        """
        잘못된 종목코드로 조회 시 테스트
        """
        url = reverse('api:alldart-list')
        response = self.client.get(url, {'ticker': 'invalid'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)
