from django.shortcuts import render, redirect
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings
from django.contrib.auth import login
from django.db.models import Q, Max, Min
from django.views.generic import ListView
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy , reverse
from django.utils import timezone
from .utils import mystock
from .utils.dbupdater import GetData
import numpy as np
import pandas as pd
from pykrx import stock as pystock
import plotly.offline as pyo
import plotly.io as pio
from django.shortcuts import get_object_or_404
import plotly.offline as opy
######################  restapi#######################################
import FinanceDataReader as fdr
from rest_framework import viewsets, status  # status 추가
from .models import Ticker
from .serializers import *
from rest_framework.response import Response
from django.db.models import F, ExpressionWrapper, IntegerField
from django.http import JsonResponse, HttpResponse  # 추가된 줄
from rest_framework.permissions import AllowAny, IsAuthenticated  # 추가된 줄
from rest_framework.decorators import action  # 추가된 줄

class TickerViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = Ticker.objects.all()
    serializer_class = TickerSerializer

    def get_queryset(self):
        queryset = Ticker.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(code=ticker)
        return queryset
  
    
class InfoViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = Info.objects.all()
    serializer_class = InfoSerializer

    def get_queryset(self):
        queryset = Info.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker=ticker)
        return queryset
    
    
class OhlcvViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = Ohlcv.objects.all()
    serializer_class = OhlcvSerializer

    def get_queryset(self):
        queryset = Ohlcv.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker=ticker)
        else:
            last_date = Ohlcv.objects.aggregate(Max('Date'))['Date__max']
            queryset = queryset.filter(Date=last_date)
        return queryset
    
    
class FinstatsViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = Finstats.objects.all()
    serializer_class = FinstatsSerializer

    def get_queryset(self):
        queryset = Finstats.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker=ticker)
        else:
            queryset = queryset.filter(ticker='005930')
        queryset = queryset.filter(fintype__contains='연결')
        return queryset


# class InvestorTradingViewSet(viewsets.ModelViewSet):
#     queryset = InvestorTrading.objects.all()
#     serializer_class = InvestorTradingSerializer

#     def get_queryset(self):
#         queryset = InvestorTrading.objects.all()
#         last_date = InvestorTrading.objects.aggregate(Max('날짜'))['날짜__max']
#         pre_month = last_date - pd.Timedelta(days=30)
#         ticker = self.request.query_params.get('ticker', None)
#         start = self.request.query_params.get('start', None)
#         if ticker is not None:
#             if start is not None:
#                 queryset = queryset.filter(ticker=ticker, 날짜__gte=pd.to_datetime(start))
#             else:
#                 queryset = queryset.filter(ticker=ticker, 날짜__gte=pre_month)
#         else:
#             queryset = queryset.filter(날짜=last_date)
#             queryset = queryset.order_by('-날짜').distinct('날짜')[:10]
#         return queryset


    
class BrokerTradingViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = BrokerTrading.objects.all()
    serializer_class = BrokerTradingSerializer

    def get_queryset(self):
        queryset = BrokerTrading.objects.all()
        last_date = BrokerTrading.objects.aggregate(Max('date'))['date__max']
        pre_month = last_date - pd.Timedelta(days=30)
        ticker = self.request.query_params.get('ticker', None)
        start = self.request.query_params.get('start', None)
        if ticker is not None:
            if start is not None:
                queryset = queryset.filter(ticker_id=ticker, date__gte=pd.to_datetime(start))
            else:
                queryset = queryset.filter(ticker_id=ticker, date__gte=pre_month)
        else:
            queryset = queryset.filter(date=last_date)
        queryset = queryset.order_by('date')
        return queryset
    
    
class ChartValueViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = ChartValue.objects.all()
    serializer_class = ChartValueSerializer

    def get_queryset(self):
        queryset = ChartValue.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker_id=ticker)
        return queryset
    
    
class Ohlcv1ViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    def list(self, request):
        ticker = request.query_params.get('ticker', None)
        interval = request.query_params.get('interval', None)
        if interval is None:
            interval = 'day'
        if ticker  is None:
            return JsonResponse({'result': 'ticker is required'}, json_dumps_params={'ensure_ascii': False})
        if interval == 'day':
            end = pd.Timestamp.today().strftime('%Y%m%d')
            start = pd.Timestamp.today() - pd.Timedelta(days=800)
            df = fdr.DataReader(ticker, start, end)
        elif interval == '30min':
            df = GetData.get_ohlcv_min(ticker, "30분봉")
        elif interval == '5min':
            df = GetData.get_ohlcv_min(ticker, "5분봉")
        elif interval == 'week':
            df = GetData.get_ohlcv_min(ticker, "주봉")
        elif interval == 'month':
            df = GetData.get_ohlcv_min(ticker, "월봉")
        else:
            df = GetData.get_ohlcv_min(ticker, "일봉")
            
        # 거래없는날은 정지로 처리 ohlcv 모두 전일종가로 채움. 
        df.loc[df['Volume'] == 0, ['Open', 'High', 'Low', 'Close']] = df['Close'].shift()
        df = df.reset_index()
        if not 'min' in interval:
            df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')
        df = df.fillna('N/A')
        df_dict = df.to_dict(orient='records')
        return JsonResponse(df_dict, safe=False, json_dumps_params={'ensure_ascii': False})    

class StocklistViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    def list(self, request):
        try:
            # 모든 쿼리 파라미터를 가져옴
            all_params = request.query_params

            # 파라미터별 처리
            params = {}
            for param, value in all_params.items():
                if param == 'search':
                    params[param] = str(value)
                    continue
                if value.isdecimal():
                    params[param] = int(value)    
                else:
                    params[param] = value
            
            from .utils.dbupdater import Api
            print('params: ', params)
            
            # favorites 파라미터 처리
            if "favorites" in params:
                # 로그인 상태 확인
                if not request.user.is_authenticated:
                    return JsonResponse(
                        {'error': '로그인이 필요합니다'}, 
                        status=401,
                        json_dumps_params={'ensure_ascii': False}
                    )
                
                username = request.user.username
                params = {'favorites': username}
                print("params::", params)
                result = Api.choice_for_api(**params)
            elif "search" in params:
                params = {'search': params['search']}
                result = Api.choice_for_api(**params)
            elif "today_ai" in params:
                params = {'today_ai': params['today_ai']}  # 값 그대로 전달
                result = Api.choice_for_api(**params)
            else:
                result = Api.choice_for_api(**params)
            
            # 결과 유효성 검사
            if result is None:
                return JsonResponse([], safe=False)
            
            # DataFrame이 아닌 경우 처리
            if not isinstance(result, pd.DataFrame):
                # Series나 다른 객체인 경우, DataFrame으로 변환 시도
                if hasattr(result, 'to_frame'):
                    result = result.to_frame()
                    if len(result.columns) == 1:
                        # 단일 컬럼인 경우 컬럼명 추가
                        result = result.reset_index()
                else:
                    # 변환 불가능한 경우 빈 DataFrame 반환
                    result = pd.DataFrame()
            
            # Handle NaN values
            result = result.fillna('N/A')
            result_dict = result.to_dict(orient='records')
            
            # 티커 객체 직렬화 처리
            for item in result_dict:
                # ticker 객체가 포함된 경우, 문자열 속성으로 변환
                if 'ticker' in item and hasattr(item['ticker'], 'code'):
                    item['ticker_code'] = item['ticker'].code
                    item['ticker_name'] = item['ticker'].name
                    del item['ticker']  # ticker 객체 제거
                    
                # 다른 비직렬화 객체가 있는지 확인하고 처리
                for key, value in list(item.items()):  # list로 감싸서 순회 중 수정 가능하게
                    if not isinstance(value, (str, int, float, bool, list, dict, type(None))):
                        # 기본 자료형이 아닌 경우 변환 또는 제거
                        try:
                            item[key] = str(value)  # 문자열 변환 시도
                        except:
                            del item[key]  # 변환 실패 시 제거
                
            return JsonResponse(result_dict, safe=False, json_dumps_params={'ensure_ascii': False})
        except Exception as e:
            import traceback
            print(f"StocklistViewSet 오류: {e}")
            print(traceback.format_exc())
            return JsonResponse(
                {'error': f'서버 오류가 발생했습니다: {str(e)}'}, 
                status=500,
                json_dumps_params={'ensure_ascii': False}
            )
        
        
class NewsViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = News.objects.all()
    serializer_class = NewsSerializer
    
    def get_queryset(self):
        queryset = News.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(tickers__code=ticker)
        # 최근 데이터 10개만 가져오기
        # queryset = queryset.order_by('-createdAt')[:10]
        queryset = queryset.order_by('title', '-createdAt').distinct('title')[:20]
        return queryset
class ShortViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = Short.objects.all()
    serializer_class = ShortSerializer
    
    def get_queryset(self):
        queryset = Short.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker=ticker)
        # 최근 데이터 10개만 가져오기
        # queryset = queryset.order_by('-createdAt')[:10]
        queryset = queryset.order_by('-Date')
        return queryset

class ShortInterestViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = ShortInterest.objects.all()
    serializer_class = ShortInterestSerializer

    def get_queryset(self):
        queryset = ShortInterest.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker=ticker)
        # 최근 데이터 10개만 가져오기
        # queryset = queryset.order_by('-createdAt')[:10]
        queryset = queryset.order_by('-Date')
        return queryset


class AllDartViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = AllDart.objects.all() 
    serializer_class = AllDartSerializer

    def get_queryset(self):
        queryset = AllDart.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker__code=ticker)  # tickers__code를 ticker__code로 수정
        # 최근 데이터 100개만 가져오기
        queryset = queryset.order_by('-rcept_dt')[:100]
        return queryset

class IssViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = Iss.objects.all()
    serializer_class = IssSerializer

    def get_queryset(self):
        queryset = Iss.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(tickers__code=ticker)
        # 최근 데이터 10개만 가져오기
        # queryset = queryset.order_by('-regdate')[:10]
        # queryset = queryset.order_by('-regdate').distinct('hl_str')[:20]
        queryset = queryset.order_by('hl_str', '-regdate').distinct('hl_str')[:20]
        return queryset

from collections import defaultdict
class InvestorTradingViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = InvestorTrading.objects.all()
    serializer_class = InvestorTradingSerializer
    
    def get_queryset(self):
        queryset = InvestorTrading.objects.all()
        ticker = self.request.query_params.get('ticker', None)
        if ticker is not None:
            queryset = queryset.filter(ticker=ticker)
        end_date = pd.Timestamp.today().date()
        start_date = end_date - pd.Timedelta(days=30)
        start_date = start_date.strftime('%Y-%m-%d')
        end_date = end_date.strftime('%Y-%m-%d')
        queryset = queryset.filter(날짜__range=[start_date, end_date]).order_by('-날짜', '투자자')
        
        queryset = queryset.annotate(
                    순매수=ExpressionWrapper(
                        F('매수거래량') - F('매도거래량'),
                        output_field=IntegerField()
                    )).values('날짜', '투자자', '매수거래량', '매도거래량', '순매수')
        # queryset = queryset.values('날짜', '투자자').annotate(total_purchase=Sum('매수거래량'))
        queryset = queryset.order_by('날짜')
           # 데이터 변환
        data = defaultdict(lambda: defaultdict(int))
        
        for entry in queryset:
            date = entry['날짜']
            investor = entry['투자자']
            net_purchase = entry['순매수']
            data[date][investor] += net_purchase  # 순매수를 누적

        # JSON 형식으로 변환
        json_data = {
            "index": list(data.keys()),
            "columns": list(set(investor for investors in data.values() for investor in investors)),
            "data": [
                {**{"date": date}, **data[date]} for date in data.keys()
            ]
        }

        return json_data

    def list(self, request, *args, **kwargs):
        # get_queryset에서 반환된 데이터를 Response로 감싸서 반환
        return Response(self.get_queryset())

from rest_framework.permissions import IsAuthenticated
from .serializers import FavoriteSerializer
from rest_framework.decorators import action

class FavoriteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FavoriteSerializer

    def get_queryset(self):
        username = self.request.user.username
        user = User.objects.get(username=username)
        queryset = user.favorites.all().select_related('ticker')
        print("Serialized data:", self.serializer_class(queryset, many=True).data)
        print("Raw qeuryset: ", queryset.values())
        return queryset
    
    @action(detail=False, methods=['post'])
    def toggle(self, request):
        ticker_code = request.data.get('ticker_code')
        if not ticker_code:
            return Response(
                {'error': 'ticker_code is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            favorite = Favorite.objects.filter(
                user=request.user,
                ticker_id=ticker_code
            ).first()

            if favorite:
                favorite.delete()
                return Response({'status': 'removed'})
            else:
                Favorite.objects.create(
                    user=request.user,
                    ticker_id=ticker_code
                )
                return Response({'status': 'added'})
                
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    def update_price(self, request):
        """매수가격 업데이트"""
        try:
            ticker_code = request.data.get('ticker_code')
            buy_price = request.data.get('buy_price')

            if not ticker_code or buy_price is None:
                return Response(
                    {'error': 'ticker_code and buy_price are required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            favorite = Favorite.objects.filter(
                user=request.user,
                ticker_id=ticker_code
            ).first()

            if not favorite:
                return Response(
                    {'error': 'Favorite not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            favorite.buy_price = buy_price
            favorite.save()

            return Response({'status': 'success', 'buy_price': buy_price})

        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class AiOpinionViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 수정
    queryset = AiOpinion.objects.all()
    serializer_class = AiOpinionSerializer

    def get_queryset(self):
        try:
            return AiOpinion.objects.latest('created_at')
        except AiOpinion.DoesNotExist:
            return None
    
    def list(self, request, *args, **kwargs):
        instance = self.get_queryset()
        if instance is None:
            return Response({
                'opinion': '관망',
                'reason': '데이터가 없습니다.',
                'ai_method': 'NONE'
            })
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class AiOpinonForStockViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    queryset = AiOpinionForStock.objects.all()
    serializer_class = AiOpinionForStockSerializer

    def get_queryset(self):
        '''
        추후에 최근저장시간에 따라 새로 ai 요청할지 말지를 결정해야한다.
        데이터베이스에 저장된내용이있다면 되도록 그것을 사용하도록한다.
        
        '''
        ticker = self.request.query_params.get('ticker', None)
        anal = self.request.query_params.get('anal', '').lower() == 'true'
        
        if anal:
            from .utils import ai
            print('ai에게 요청중...')
            if ticker is not None:
                result = ai.get_opinion_by_ticker(ticker)
                print(ticker, result)
                # temp_status = True

        queryset = AiOpinionForStock.get_data_by_ticker(ticker)
        # queryset = queryset.filter(ticker__code=ticker)
        # temp_status = False
        # if queryset.exists():
        #     queryset = queryset.order_by('-created_at')
        #     last_date = queryset.values_list('created_at',flat=True)[0]
        #     last_date = timezone.localtime(last_date).date()
        #     current_date = pd.Timestamp.now().date()
        #     if last_date == current_date:
        #         temp_status = True
        
        # if temp_status:
        #     queryset = AiOpinionForStock.objects.all()
        #     if ticker is not None:
        #         queryset = queryset.filter(ticker__code=ticker)  # tickers__code를 ticker__code로 수정
        #         queryset = queryset.order_by('-created_at')
        
        return queryset

class AiOpinionForStockTodayViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]  # 추가된 줄
    serializer_class = AiOpinionForStockSerializer
    
    def get_queryset(self):
        return AiOpinionForStock.get_today_data(n=3)
    
class DartInfoViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    def list(self, request):
        ticker = request.query_params.get('ticker')
        if not ticker:
            return Response(
                {'error': 'ticker parameter is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            dart_list = Ticker.get_dart_list(ticker)
            serializer = DartListSerializer(dart_list, many=True)
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
######################  rest api  #########################

def health_check(request):
    return HttpResponse("OK")
