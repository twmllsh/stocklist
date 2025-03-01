from rest_framework import serializers
from .models import *
import math

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

class NewsSerializer(serializers.ModelSerializer):
    ticker = TickerSerializer(many=False, read_only=True)
    class Meta:
        model = News
        fields = '__all__'

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
        fields = [ 'opinion', 'reason', 'ai_method', 'created_at']