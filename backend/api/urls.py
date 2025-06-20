from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import *

router = DefaultRouter()
router.register(r'ticker', TickerViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/ticker
router.register(r'info', InfoViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/info
router.register(r'ohlcv', OhlcvViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/ticker
router.register(r'ohlcv1', Ohlcv1ViewSet, basename="ohlcv1")  # 'yourmodel' URL에 ViewSet 연결  /api/ticker
router.register(r'finstats', FinstatsViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/ticker
router.register(r'investor', InvestorTradingViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/ticker

router.register(r'broker', BrokerTradingViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/ticker
router.register(r'chartvalue', ChartValueViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/chartvalue
# router.register(r'realtime', RealtimeStockViewSet)  # 'yourmodel' URL에 ViewSet 연결  /api/realtime
router.register(r'stocklist', StocklistViewSet, basename='stocklist')
router.register(r'news', NewsViewSet)
router.register(r'short', ShortViewSet, basename='short')
router.register(r'shortinterest', ShortInterestViewSet, basename='shortinterest')
router.register(r'aiopinion', AiOpinionViewSet, basename='aiopinion')
router.register(r'aiopinionstock', AiOpinonForStockViewSet, basename='aiopinionforstock')
router.register(r'aiopinionstocktoday', AiOpinionForStockTodayViewSet, basename='aiopinionforstocktoday')
router.register(r'dart', AllDartViewSet)
router.register(r'dartinfo', DartInfoViewSet, basename='dartinfo')
router.register(r'iss', IssViewSet)
router.register(r'favorites', FavoriteViewSet, basename='favorite')
app_name = "api"

urlpatterns = [
    path('', include(router.urls)),  # API URL에 포함
]

