from rest_framework import serializers
from .models import *
import math
from django.utils import timezone

class TickerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticker
        fields = '__all__'

class InfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Info
        fields = '__all__'

class OhlcvSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ohlcv
        fields = '__all__'
        
class FinstatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Finstats
        fields = '__all__'
        
class InvestorTradingSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestorTrading
        # fields = '__all__'
        fields = ('날짜','투자자', '매수거래량','매도거래량')

class BrokerTradingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BrokerTrading
        fields = '__all__'

class ChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChangeLog
        fields = '__all__'

class IssSerializer(serializers.ModelSerializer):
    class Meta:
        model = Iss
        fields = ('id', 'hl_str', 'regdate', 'ralated_code_names', 'hl_cont_url')

class ThemeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Theme
        fields = '__all__'
        
class ThemeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThemeDetail
        fields = '__all__'
        
class UpjongSerializer(serializers.ModelSerializer):
    class Meta:
        model = Upjong
        fields = '__all__'
class ShortSerializer(serializers.ModelSerializer):
    class Meta:
        model = Short
        fields = '__all__'
class ShortInterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShortInterest
        fields = '__all__'

class NewsSerializer(serializers.ModelSerializer):
    ticker = TickerSerializer(many=False, read_only=True)
    ticker_names = serializers.SerializerMethodField()
    class Meta:
        model = News
        fields = '__all__'
    def get_ticker_names(self, obj):
        return {
            ticker.code : ticker.name 
            for ticker in obj.tickers.all()
        }
# AllDartSerializer 수정
class AllDartSerializer(serializers.ModelSerializer):
    ticker = TickerSerializer(read_only=True)
    
    class Meta:
        model = AllDart
        fields = ['id', 'ticker', 'rcept_dt', 'rcept_no', 'report_nm', 'corp_cls', 'corp_name']

class ChartValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChartValue
        fields = '__all__'
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        
        # 부적합한 부동 소수점 값을 처리
        for key, value in representation.items():
            if isinstance(value, float) and (math.isnan(value) or value in [float('inf'), float('-inf')]):
                representation[key] = None  # 또는 원하는 기본값으로 대체
        
        return representation


class FavoriteSerializer(serializers.Serializer):
    ticker = TickerSerializer(many=False, read_only=True)
    buy_price = serializers.FloatField()
    class Meta:
        model = Favorite
        fields = ("__all__")
class AiOpinionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiOpinion
        fields = ['opinion', 'reason', 'ai_method', 'created_at']


class AiOpinionForStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = AiOpinionForStock
        fields = ['ticker','opinion', 'reason', 'ai_method', 'created_at','close']

class DartListSerializer(serializers.Serializer):
    날짜 = serializers.DateTimeField()
    rcept_no = serializers.CharField()
    카테고리 = serializers.CharField()
    대략적인_내용 = serializers.CharField(source='대략적인 내용')  # 공백이 있는 필드명 처리

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # # UTC 시간을 한국 시간으로 변환
        # if data['날짜']:
        #     data['날짜'] = data['날짜'].astimezone(timezone.pytz.timezone('Asia/Seoul'))
        return data