from django.shortcuts import render, redirect
from django.contrib.auth.mixins import LoginRequiredMixin
from django.conf import settings
from django.contrib.auth import login
from django.db.models import Q, Max, Min
from django.views.generic import ListView
from django.contrib.auth import views as auth_views
from django.urls import reverse_lazy , reverse
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
    permission_classes = [AllowAny]  # 추가된 줄
    def list(self, request):
        
        # 모든 쿼리 파라미터를 가져옴
        all_params = request.query_params

        # 파라미터별 처리
        params ={}
        for param, value in all_params.items():
            if param == 'search':
                params[param] = str(value)
                continue
            if value.isdecimal():
                params[param] = int(value)    
            else:
                params[param] = value
            
        
        from .utils.dbupdater import Api
        print('params: ' , params)
        result = Api.choice_for_api(**params)
        
        # Handle NaN values
        result = result.fillna('N/A')
        
        result_dict = result.to_dict(orient='records')
        # return JsonResponse({'result': result_dict}, json_dumps_params={'ensure_ascii': False})
        return JsonResponse( result_dict, safe=False, json_dumps_params={'ensure_ascii': False})
        
        
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
        queryset = queryset.order_by('title','-createdAt').distinct('title')[:10]
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
        queryset = queryset.order_by('hl_str','-regdate').distinct('hl_str')[:10]
        # queryset = queryset.order_by('hl_str', '-regdate').distinct('hl_str')[:10]
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
        return Favorite.objects.filter(user=self.request.user)
    
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

######################  rest api  #########################

def health_check(request):
    return HttpResponse("OK")
