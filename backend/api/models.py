import pandas as pd
from django.db import models
from model_utils import FieldTracker
from django.utils import timezone
from django.db.models import F, Subquery, OuterRef, Q, Sum, Count
from django.db import transaction
from api.utils.mystock import ElseInfo
from accounts.models import User
from django.db.models.functions import TruncDate




class Ticker(models.Model):
    code = models.CharField(max_length=10, primary_key=True)
    name = models.CharField(max_length=20)
    구분 = models.CharField(max_length=10)
    create_at = models.DateField(auto_now_add=True)
    
    def __str__(self):
        return f"Ticker[{self.name}({self.code})]"

    class Meta:
        verbose_name='Ticker'
        verbose_name_plural = 'Tickers'
        # db_table = 'stock__ticker'
    @classmethod
    def get_dart_list(cls, code):
        '''
        날짜 , 카테고리, 대략적인 내용(link),  
        all_dic = {'날짜':[], '카테고리':[], '대략적인 내용':[]}
        '''
        ticker = cls.objects.get(code=code)
        if ticker is None:
            return
        all_ls = []
        
        contract = ticker.dartcontract_set.all()
        if contract.count():
            cont_df = pd.DataFrame(contract.values('rcept_dt', 'rcept_no', '계약내용', '계약금액',
        '계약상대방', '공급지역', '매출액대비', '계약기간_시작', '계약기간_종료', '계약기간일', '계약일'))
            
            for i, row in cont_df.iterrows():
                dic = {}
                dic['날짜'] = row['rcept_dt']
                dic['rcept_no'] = row['rcept_no']
                dic['카테고리'] = '계약'
                매출액대비 = f"{row['매출액대비']:,.0f}%" if row['매출액대비'] is not None else ''
                계약내용 = row['계약내용'] if row['계약내용'] is not None else ''
                계약상대방 = row['계약상대방'] if row['계약상대방'] is not None else ''
                dic['대략적인 내용'] = f"{계약내용} ({계약상대방}) 매출액대비: {매출액대비}"        
                all_ls.append(dic)
        bonusissue = ticker.dartbonusissue_set.all()
        if bonusissue.count():
            bonus_df = pd.DataFrame(bonusissue.values('rcept_dt', 'rcept_no', '주당배정주식수', '상장예정일',))
            for i, row in bonus_df.iterrows():
                dic = {}
                dic['날짜'] = row['rcept_dt']
                dic['rcept_no'] = row['rcept_no']
                dic['카테고리'] = '무상증자'
                dic['대략적인 내용'] = f"주당배정주식수: {row['주당배정주식수']} 상장예정일: {row['상장예정일']}"
                all_ls.append(dic)
        
        convertible = ticker.dartconvertiblebond_set.all()
        if convertible.count():
            bonus_df = pd.DataFrame(convertible.values('rcept_dt', 'rcept_no', '전환사채총액', '전환가액','표면이자율','만기이자율'))
            for i, row in bonus_df.iterrows():
                dic = {}
                dic['날짜'] = row['rcept_dt']
                dic['rcept_no'] = row['rcept_no']
                dic['카테고리'] = '전환사채'
                dic['대략적인 내용'] = f"전환사채총액: {row['전환사채총액']:,.0f} 전환가액: {row['전환가액']:,.0f}원 표면이자율: {row['표면이자율']}% 만기이자율: {row['만기이자율']}%"
                all_ls.append(dic)
        
        rightsissue = ticker.dartrightsissue_set.all()
        if rightsissue.count():
            rights_df = pd.DataFrame(rightsissue.values('rcept_dt', 'rcept_no', '증자방식', '발행가액', '제3자배정대상자', '신주비율'))
            for i, row in rights_df.iterrows():
                dic = {}
                dic['날짜'] = row['rcept_dt']
                dic['rcept_no'] = row['rcept_no']
                dic['카테고리'] = '3자배정유증'
                dic['대략적인 내용'] = f"증자방식: {row['증자방식']} 발행가액: {row['발행가액']:,.0f}원 제3자배정대상자: {row['제3자배정대상자']} 신주비율: {row['신주비율']}%"
                all_ls.append(dic)
        
        # 날짜로 내림차순 정렬
        sorted_ls = sorted(all_ls, key=lambda x: x['날짜'], reverse=True)
        
        return sorted_ls
    
        
    
class Info(models.Model):
    ticker = models.OneToOneField(Ticker, on_delete=models.CASCADE)
    date = models.DateField(null=True) #
    상장주식수 = models.FloatField(null=True)
    외국인한도주식수 = models.FloatField(null=True)
    외국인보유주식수 = models.FloatField(null=True)
    외국인소진율 = models.FloatField(null=True)
    액면가 = models.FloatField(null=True)
    ROE = models.FloatField(null=True) #
    EPS = models.FloatField(null=True) #
    PER = models.FloatField(null=True) #
    PBR = models.FloatField(null=True) #
    주당배당금 = models.FloatField(null=True)
    배당수익율 = models.FloatField(null=True, blank=True)
    구분 = models.CharField(max_length=7, null=True, blank=True)
    업종 = models.CharField(max_length=20, null=True, blank=True)
    FICS = models.CharField(max_length=20, null=True, blank=True)
    시가총액 = models.FloatField(null=True)
    시가총액순위 = models.PositiveBigIntegerField(null=True)
    외국인보유비중 = models.FloatField(null=True)
    유동주식수 = models.FloatField(null=True)
    유동비율 = models.FloatField(null=True)
    보통발행주식수 = models.FloatField(null=True)
    우선발행주식수 = models.FloatField(null=True)
    PER_12M = models.FloatField(null=True)
    배당수익률 = models.FloatField(null=True)
    동일업종저per_name = models.CharField(max_length=30, blank=True)
    동일업종저per_code = models.CharField(max_length=10)
    
    tracker = FieldTracker(fields=['ROE', 'EPS', '액면가', '상장주식수', '외국인소진율', 'PER_12M', '유동주식수'])

    @classmethod
    def get_info_good_cash(cls, 유보율=200):
        pass
    
    def __str__(self):
        return f"Info[{self.ticker.name} 업종 : {self.업종} 구분 : {self.구분} 외국인소진율: {self.외국인소진율}]"

    class Meta:
        verbose_name='Info'
        verbose_name_plural = 'Infos'
        
        
class Ohlcv(models.Model):
    ticker = models.ForeignKey(
        Ticker, on_delete=models.CASCADE
    )  # 여러 개의 Ohlcv가 한 Ticker에 연결
    Date = models.DateField()  # 날짜
    # open = models.DecimalField(max_digits=10, decimal_places=2)  # 시가
    Open = models.FloatField()  # 시가
    High = models.FloatField()   # 고가
    Low = models.FloatField()   # 저가
    Close = models.FloatField()   # 종가
    Volume = models.BigIntegerField()  # 거래량
    Amount = models.BigIntegerField(null=True)  # 거래량
    Change = models.FloatField(null=True)

    class Meta:
        unique_together = (
            "ticker",
            "Date",
        )  # 특정 Ticker의 날짜별 데이터가 중복되지 않도록
        ordering = ['Date']
        verbose_name='OHLCV'
        verbose_name_plural = 'OHLCVs'

        
        
    def get_data_xx(ticker:Ticker):
        ## 240 개만 데이터 가져오기. 
        field_names = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Amount', 'Change']
        qs = Ohlcv.objects.filter(ticker=ticker)
        qs = qs.values(*field_names)
        df = pd.DataFrame(qs)
        df['Date'] = pd.to_datetime(df['Date'])
        if df.index.name != 'Date' and 'Date' in df.columns:
            df = df.set_index('Date')
        return df
    
    @classmethod
    def get_data(cls, ticker:Ticker):
        """특정 ticker ohlcv 데이터 가져오기"""
        qs = cls.objects.filter(ticker=ticker)
        field_names = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Amount', 'Change']
        qs = qs.values(*field_names)
        df = pd.DataFrame(qs)
        df['Date'] = pd.to_datetime(df['Date'])
        if df.index.name != 'Date' and 'Date' in df.columns:
            df = df.set_index('Date')
        return df
    
    
    def __str__(self):
        return f"Ohlcv [{self.Date} {self.ticker.name} close : {self.Close}]"


class Finstats(models.Model):
    FIN_TYPE = [
        ("연결연도", "연결연도"),
        ("연결분기", "연결분기"),
        ("별도연도", "별도연도"),
        ("별도분기", "별도분기"),
    ]

    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE)
    fintype = models.CharField(max_length=4, choices=FIN_TYPE)
    year = models.IntegerField()  # 연도
    quarter = models.IntegerField()  # 분기 (분기별 데이터가 없을 경우 연도 데이터만)
    매출액 = models.FloatField(null=True, blank=True)
    영업이익 = models.FloatField(null=True, blank=True)
    영업이익발표기준 = models.FloatField(null=True, blank=True)
    당기순이익 = models.FloatField(null=True, blank=True)
    자산총계 = models.FloatField(null=True, blank=True)
    부채총계 = models.FloatField(null=True, blank=True)
    자본총계 = models.FloatField(null=True, blank=True)
    자본금 = models.FloatField(null=True, blank=True)
    부채비율 = models.FloatField(null=True, blank=True)
    유보율 = models.FloatField(null=True, blank=True)
    영업이익률 = models.FloatField(null=True, blank=True)
    순이익률 = models.FloatField(null=True, blank=True)
    ROA = models.FloatField(null=True, blank=True)
    ROE = models.FloatField(null=True, blank=True)
    EPS = models.FloatField(null=True, blank=True)
    BPS = models.FloatField(null=True, blank=True)
    DPS = models.FloatField(null=True, blank=True)
    PER = models.FloatField(null=True, blank=True)
    PBR = models.FloatField(null=True, blank=True)
    발행주식수 = models.FloatField(null=True, blank=True)
    배당수익률 = models.FloatField(null=True, blank=True) 
    지배주주순이익 = models.FloatField(null=True, blank=True)
    비지배주주순이익 = models.FloatField(null=True, blank=True)
    지배주주지분 = models.FloatField(null=True, blank=True)
    비지배주주지분 = models.FloatField(null=True, blank=True)
    지배주주순이익률 = models.FloatField(null=True, blank=True)
    tracker = FieldTracker(fields=['매출액', '영업이익', '당기순이익', '부채비율', '유보율', '발행주식수', 'EPS'])

    
    # 실적주만 가져오기. 
    @classmethod
    def get_good_consen(cls, pct=0.3):
        c_year, f_yaer = ElseInfo.check_y_current
        
        data = Finstats.objects.filter(
            year=f_yaer,
            fintype='연결연도',
            quarter=0,
            영업이익__gt=0  # 2024년 영업이익은 양수
        ).annotate(
            prev_year_profit=Subquery(
                Finstats.objects.filter(
                    ticker=OuterRef('ticker'),
                    fintype='연결연도',
                    year=c_year,
                    quarter=0
                ).values('영업이익')[:1]
            )
        ).filter(
            prev_year_profit__isnull=False,
            prev_year_profit__gt=0,     # 2023년 영업이익도 양수인 경우만
            영업이익__gte=F('prev_year_profit') * (1 + pct)
        ).select_related('ticker')

        
        data = { item.ticker.code : f"{item.ticker.name} {item.영업이익}({((item.영업이익 / item.prev_year_profit) - 1) * 100 :,.0f}%)"                        for item in data}
        # # 결과 출력
        # for item in data:
        #     try:
        #         growth_rate = ((item.영업이익 / item.prev_year_profit) - 1) * 100
            
        #         print(f"""
        #         기업: {item.ticker.name}
        #         2024년 영업이익: {item.영업이익:,.0f}
        #         2023년 영업이익: {item.prev_year_profit:,.0f}
        #         증가율: {growth_rate:.1f}%
        #         """)
        #     except:
        #         print(f"""
        #         기업: {item.ticker.name}
        #         2024년 영업이익: {item.영업이익:,.0f}
        #         2023년 영업이익: {item.prev_year_profit:,.0f}
        #         """)
        return data
    
    @classmethod
    def get_good_cash(cls, 유보율=1000):
        datas = cls.objects.filter(
             fintype__in=['연결연도', '연결분기'],
             유보율__isnull=False
         ).filter(
             id=Subquery(
                 cls.objects.filter(
                     ticker=OuterRef('ticker'),
                     fintype__in=['연결연도', '연결분기'],
                     유보율__isnull=False
                 ).order_by('-year', '-quarter').values('id')[:1]
             )
         ).select_related('ticker').values('ticker', 'ticker__name', '유보율').order_by('-유보율')
         
        datas = datas.filter(유보율__gte=유보율)
        
        result = {
             item['ticker'] : f"{item['ticker__name']}({item['유보율']}%)" 
                   for item in datas
                   }
        
        return result

    def __str__(self):
        return f"Fin [{self.ticker.name}, year {self.year}({self.quarter}), 영업이익{self.영업이익}]"
    
    
    class Meta:
        unique_together = (
            "ticker",
            "fintype",
            "year",
            "quarter",
            )  # 특정 Ticker의 날짜별 데이터가 중복되지 않도록
        ordering = ['year', 'quarter']
        verbose_name='재무제표'
        verbose_name_plural = '재무제표 목록'


class InvestorTrading(models.Model):
   
    INVESTOR_TYPES=(
        ('개인', '개인'),
        ('외국인', '외국인'),
        ('기관합계', '기관합계'),
        ('금융투자', '금융투자'),
        ('보험', '보험'),
        ('은행', '은행'),
        ('투신', '투신'),
        ('사모', '사모'),
        ('연기금', '연기금'),
        ('기타법인', '기타법인'),
        ('기타금융', '기타금융'),
        ('기타외국인', '기타외국인'),
    )
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE)
    날짜 = models.DateField()  # 거래 일자
    투자자 = models.CharField(max_length=50,choices=INVESTOR_TYPES)  # 투자자 유형 (예: 개인, 기관, 외국인)
    매도거래량 = models.BigIntegerField()
    매수거래량 = models.BigIntegerField()
    순매수거래량 = models.BigIntegerField(null=True)
    매도거래대금 = models.BigIntegerField()
    매수거래대금 = models.BigIntegerField()
    순매수거래대금 = models.BigIntegerField(null=True)
    
    class Meta:
        unique_together = ('ticker', '날짜', '투자자')
        verbose_name='투자자'
        verbose_name_plural = '투자자 목록'
        indexes = [
            models.Index(fields=['ticker', '-날짜','투자자']),
            ]
        
    
    # 최근 10(n)일 동향 가져오기
    @classmethod
    def trader_trade(cls, n=10, investors=None):
        '''
        investors  = " " 로 분리된 스트링.
        '''
        the_day = list(cls.objects.values_list('날짜',flat=True)
                       .distinct().order_by('-날짜')[:n])[-1] 
       
        if investors is None:
            investors = ['외국인']
        else:
            investors = investors.split()
        
        tickers = []
        qs = cls.objects.filter(날짜__gte=the_day)
        for investor in investors:
            qs1 = qs.filter(투자자=investor)
            qs1 = qs1.filter(매도거래대금__gt=0)
            qs1 = qs1.values("날짜").annotate(
                total_sell = Sum('매도거래대금'),
                total_buy = Sum('매수거래대금'),).annotate(
                ratio = F('total_buy') / F('total_sell')).filter(
                Q(ratio__gt=2) & Q(total_buy__gt=10 * 100000000)).order_by('-ratio')[:20]
            tickers = [item.ticker for item in qs1]
            tickers += tickers
        result = list(set(tickers))
        result = {ticker.code : ticker for ticker in result}
        return result
        

    def __str__(self):
        return f"Investor[{self.ticker} - {self.날짜} - {self.투자자} - {self.순매수거래량}]"
        
        
class BrokerTrading(models.Model):
    ticker = models.ForeignKey(
        Ticker, on_delete=models.CASCADE
    )  # 여러 개의 Ohlcv가 한 Ticker에 연결
    date = models.DateField()  # 거래 일자
    broker_name = models.CharField(max_length=100, null=True)  # 거래원 이름,
    buy = models.BigIntegerField(null=True)  # 매수량
    sell = models.BigIntegerField(null=True)  # 매도량

    class Meta:
        unique_together = ('ticker', 'date', 'broker_name')
        ordering = ['-date']
        verbose_name='거래원'
        verbose_name_plural = '거래원 목록'
        

    def __str__(self):
        return f"Broker [{self.ticker.name} - {self.date} - {self.broker_name} +{self.buy} -{self.sell}]"        
    
    
    @classmethod
    def get_ranking_buy_latest(cls, broker_name=None, n=None, cnt=None):
        '''
        특정 거래원의 매수량 순위 가져오기
        n봉전부터 cnt개의 데이터 가져오기
        ['외국계추정합','메릴린치','제이피모간','에스지','홍콩상하이','맥쿼리',
        '다이와','골드만삭스','모간스탠리','다올투자증권','노무라','비엔피','CLSA',
        '씨티그룹','UBS',]
        ''' 
    
        dates = BrokerTrading.objects.values_list('date',flat=True).distinct().order_by('date')
        dates = list(dates)
        start_date = dates[-n:][0] if n is not None else None
        n =  len(dates) if start_date is None else n
        end_date = dates[-n:][:cnt][-1] if cnt is not None else None
        print(f"{start_date} ~ {end_date}")
        qs = cls.objects.all()
        if start_date is not None:
            qs = qs.filter(date__gte=start_date)
        if end_date is not None:
            qs = qs.filter(date__lte=end_date)
        if broker_name is not None:
            qs = qs.filter(broker_name=broker_name)
            
        qs = qs.values('ticker', 'ticker__name').annotate(
            total_buy=Sum('buy'), total_sell=Sum('sell')
            ).annotate(diff=F("total_buy") - F("total_sell")).order_by(F('diff').desc(nulls_last=True))
        df = pd.DataFrame(list(qs))
        return df
    
    @classmethod
    def get_broker_buy_period(cls, ticker=None, broker_name=None, start_date=None, end_date=None):
        '''
        특정 종목의 특정 거래원의 매수량 가져오기
        start_date 부터 end_date 이전까지. ** end_date는 포함하지 않음
        '''
        qs = cls.objects.all()
        if ticker is not None:
            qs = qs.filter(ticker=ticker)
        if broker_name is not None:
            qs = qs.filter(broker_name=broker_name)
        if start_date is not None:
            qs = qs.filter(date__gte=start_date)
        if end_date is not None:
            qs = qs.filter(date__lt=end_date)
        qs = qs.values('ticker', 'ticker__name', 'broker_name').annotate(
            total_buy=Sum('buy'), total_sell=Sum('sell')
            ).annotate(diff=F("total_buy") - F("total_sell")).order_by(F('diff').desc(nulls_last=True))
        df = pd.DataFrame(list(qs))
        return df
    
    
    @classmethod
    def good_broker(cls , brokers=None , n=10):
        
        the_day = list(cls.objects.values_list('date',flat=True)
                       .distinct().order_by('-date')[:n])[-1] 
        if brokers is None:
            brokers = ['외국계추정합']
        
        qs = BrokerTrading.objects.filter(date__gte=the_day).prefetch_related('ticker')
        qs = qs.values('ticker_id', 'ticker__name').annotate(
            total_buy=Sum('buy'), total_sell=Sum('sell')
            ).annotate(diff=F("total_buy") - F("total_sell")).order_by(F('diff').desc(nulls_last=True))
        
        # 상위20개
        result = {item['ticker_id'] : f"{item['ticker__name']}({item['total_buy']}/{item['total_buy']})" for item in qs[:20] }
        return result         
    
    @classmethod
    def get_major_brokers(cls, ticker):
        '''
        외국계 창구와 외국계추정합. 그리고 특이한 창구 분석. 
        외국계창구 = 
        ['외국계추정합','메릴린치','제이피모간','에스지','홍콩상하이','맥쿼리',
        '다이와','골드만삭스','모간스탠리','다올투자증권','노무라','비엔피','CLSA',
        '씨티그룹','UBS',]
        '''
        # 종목 데이터 가져오기.
        qs = cls.objects.filter(Q(ticker=ticker)).order_by('date')
        
        # 최근날짜데이터만 가져오기. 
        start_date = pd.Timestamp.today() - pd.Timedelta(days=30)
        qs = qs.filter(Q(date__gte=start_date))
        
        # 외국계만 가져오기. 
        외국계창구 = ['외국계추정합','메릴린치','제이피모간','에스지','홍콩상하이','맥쿼리',
        '다이와','골드만삭스','모간스탠리','다올투자증권','노무라','비엔피','CLSA',
        '씨티그룹','UBS',]
        # qs = qs.filter(Q(broker_name__in=외국계창구))   
        
        
        df = pd.DataFrame(qs.values('date','broker_name','buy','sell'))
        df.fillna(0,inplace=True)
        df['net_buying'] = df['buy'] - df['sell']
        
        ## 특이 창구 분석. 
        brokers = []
        # 당일 순매수 창구. 
        temp_df = df.loc[( df['buy'] > 0)  & (df['sell']== 0) ]
        if len(temp_df) > 0:
            for i, row in temp_df.iterrows():
                broker_name = row['broker_name']
                date = row['date']
                print(f'당일 순매수만 {date} {broker_name}')
                brokers.append(broker_name)
        
        
        # 전일대비 순매수 2배 
        for broker_name, group in df.groupby('broker_name'):
            if len(group) > 1:
                # cond0 = (group['net_buying'].shift(1) >= 0 ) & (group['net_buying'] <= 0)
                cond1 = abs(group['net_buying'].shift(1)) * 2 <  abs(group['net_buying'])
                cond2 = group['buy'].shift(1) * 2 <  group['buy']
                temp_df = group.loc[cond1 & cond2]
                if len(temp_df) > 0:
                    for i , row in temp_df.iterrows():
                       broker_name = row['broker_name']
                       date = row['date']
                       print(f'전일대비순매수 2배 {date}{broker_name}')
                       brokers.append(broker_name)
                    
        ## 최근 n일 양수이어야함.매수한창구.  
        
        n = 3
        temp_start_date = df['date'].unique()[-n]
        temp_df = df.loc[df['date'] >= temp_start_date]
        temp_group_data = temp_df.groupby('broker_name')['net_buying'].sum()
        buying_brokers = temp_group_data.loc[ temp_group_data > 0 ].index
        for broker_name in buying_brokers:
            print(f'최근{n}일 매수한 창구 {broker_name}')
            brokers.append(broker_name)
         
        
        
        brokers = list(set(brokers)) #3 주요 창구 임. 이 데이터가 있으면 이데이터들만 가져가기. 
        result_df = df.loc[df['broker_name'].isin(brokers)]
        
        return result_df
    
        
    
    
        # tickers = [item.ticker for item in qs1]
        # tickers += tickers
        # result = list(set(tickers))
        # result = {ticker.code : ticker for ticker in result}


class ChangeLog(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE)
    change_date = models.DateTimeField(auto_now_add=True)
    change_field = models.CharField(max_length=30)
    gb = models.CharField(max_length=20, null=True)  # max_length 추가
    old_value = models.FloatField(null=True)
    new_value = models.FloatField(null=True)

    def __str__(self):
        return f"ChangeLog [ch_date:{self.change_date} field: {self.change_field} old:{self.old_value} new{self.new_value}] "
    
    class Meta():
        unique_together = ['ticker','change_date','change_field']
        ordering = ['change_date','change_field']
        verbose_name='데이터변경'
        verbose_name_plural = '데이터변경 목록'
        # db_table = 'stock__changelog'




class Iss(models.Model):
    
    tickers = models.ManyToManyField(Ticker, related_name='iss_set')
    issn = models.IntegerField()
    iss_str = models.CharField(max_length=50)
    hl_str = models.CharField(max_length=200)
    regdate = models.DateField()
    ralated_codes = models.CharField(max_length=200)
    ralated_code_names = models.CharField(max_length=200)
    hl_cont_text = models.TextField()
    hl_cont_url = models.CharField(max_length=200, unique=True) # 이걸로 url이없는건 저장 불가능.
    
    def __str__(self):
        return f"Issue {self.hl_str}"
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['iss_str', 'regdate'], 
                name='unique_iss_str_regdate'
            )
        ]
        verbose_name='이슈'
        verbose_name_plural = '이슈 목록'


    # def save(self, *args, **kwargs):
    #     # 날짜 부분만 추출하여 중복 체크
    #     date_only = self.regdate
    #     if Iss.objects.filter(title=self.iss_str, regdate__date=date_only).exists():
    #         raise ValueError("이미 같은 제목과 날짜의 이슈가 존재합니다.")
    #     super().save(*args, **kwargs)
    




class Theme(models.Model):
    tickers = models.ManyToManyField(Ticker, through='ThemeDetail', related_name='theme_set')
    name = models.CharField(max_length=50)

    def __str__(self):
        return f"Theme {self.name}"
    
    class Meta:
        verbose_name='테마'
        verbose_name_plural = '테마 목록'
        

    
class ThemeDetail(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='themedtail_set')
    theme = models.ForeignKey(Theme, on_delete=models.CASCADE)
    description = models.TextField()
    class Meta:
        unique_together = ('ticker', 'theme')
        verbose_name='테마텍스트'
        verbose_name_plural = '테마텍스트 목록'
        

    def __str__(self):
        return f"<ThemeDetail {self.ticker}>"
    
    
class Upjong(models.Model):
    tickers = models.ManyToManyField(Ticker, related_name='upjong_set')
    name = models.CharField(max_length=20)
    
    def __str__(self):
        return f"Upjong {self.name}"
    
    class Meta:
        verbose_name='업종'
        verbose_name_plural = '업종 목록'
        

class News(models.Model):
    no = models.BigIntegerField()
    tickers = models.ManyToManyField(Ticker, related_name='news_set')
    title = models.CharField(max_length=200)
    createdAt =models.DateTimeField()
    writerName = models.CharField(max_length=20)

    @classmethod
    def remove_duplicates(cls):
        # 'name'과 'price' 필드 기준으로 중복된 항목 찾기
        filters = ['title','createdAt']
        duplicates = (cls.objects
                    .values(*filters)
                    .annotate(count=Count('id'))
                    .filter(count__gt=1))
        if len(duplicates):
            for duplicate in duplicates:
                filters_kwargs = {item: duplicate[item] for item in filters} ## 아래 for 단수명을 따라야한다. (duplicate)
                items = cls.objects.filter(**filters_kwargs)
                items.exclude(id=items.first().id).delete()
        else:
            print('중복데이터가 없습니다. ')            
    
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['title', 'createdAt'], 
                name='unique_title_createdAt'
            )
        ]
        verbose_name='뉴스'
        verbose_name_plural = '뉴스 목록'

    def save(self, *args, **kwargs):
        # 날짜 부분만 추출하여 중복 체크
        date_only = self.createdAt.date()
        if News.objects.filter(title=self.title, createdAt__date=date_only).exists():
            print(f"{self.title}  이미 존재하는 데이터입니다..")
            return
        super().save(*args, **kwargs)
    
    

    def __str__(self):
        return f"<News {self.title}"


class ChartValue(models.Model):
    ticker = models.OneToOneField(Ticker, on_delete=models.CASCADE)
    date = models.DateTimeField(null=True)
    cur_close = models.FloatField(null=True, blank=True)
    cur_open = models.FloatField(null=True, blank=True)
    pre_close = models.FloatField(null=True, blank=True)
    pre_open = models.FloatField(null=True, blank=True)
    growth_y1 = models.FloatField(null=True, blank=True)
    growth_y2 = models.FloatField(null=True, blank=True)
    growth_q = models.FloatField(null=True, blank=True)
    good_buy = models.IntegerField(null=True, blank=True)
    chart_d_bb60_upper20 = models.FloatField(null=True, blank=True)
    chart_d_bb60_upper10 = models.FloatField(null=True, blank=True)
    chart_d_bb60_upper = models.FloatField(null=True, blank=True)
    chart_d_bb60_width = models.FloatField(null=True, blank=True)
    chart_d_bb240_upper20 = models.FloatField(null=True, blank=True)
    chart_d_bb240_upper10 = models.FloatField(null=True, blank=True)
    chart_d_bb240_upper = models.FloatField(null=True, blank=True)
    chart_d_bb240_width = models.FloatField(null=True, blank=True)
    chart_d_sun_width = models.FloatField(null=True, blank=True)
    chart_d_sun_max = models.FloatField(null=True, blank=True)
    chart_d_new_phase = models.BooleanField(null=True)
    chart_d_ab = models.BooleanField(null=True)
    chart_d_ab_v = models.BooleanField(null=True)
    chart_d_good_array = models.BooleanField(null=True)
    chart_d_bad_array = models.BooleanField(null=True)
    cur_vol = models.FloatField(null=True, blank=True)
    pre_vol = models.FloatField(null=True, blank=True)
    chart_d_vol20 = models.FloatField(null=True, blank=True)
    vol20 = models.FloatField(null=True, blank=True)
    reasons = models.TextField(blank=True)
    reasons_30 = models.TextField(blank=True)
    chart_30_bb60_upper20 = models.FloatField(null=True, blank=True)
    chart_30_bb60_upper10 = models.FloatField(null=True, blank=True)
    chart_30_bb60_upper = models.FloatField(null=True, blank=True)
    chart_30_bb60_width = models.FloatField(null=True, blank=True)
    chart_30_bb240_upper20 = models.FloatField(null=True, blank=True)
    chart_30_bb240_upper10 =models.FloatField(null=True, blank=True)
    chart_30_bb240_upper = models.FloatField(null=True, blank=True)
    chart_30_bb240_width = models.FloatField(null=True, blank=True)
    chart_30_sun_width = models.FloatField(null=True, blank=True)
    chart_30_sun_max = models.FloatField(null=True, blank=True)
    chart_30_new_phase = models.BooleanField(null=True)
    chart_30_ab = models.BooleanField(null=True)
    chart_30_ab_v = models.BooleanField(null=True)
    chart_30_good_array = models.BooleanField(null=True)
    chart_30_bad_array = models.BooleanField(null=True)
    chart_30_vol20 = models.FloatField(null=True, blank=True)
    chart_5_bb60_upper20 = models.FloatField(null=True, blank=True)
    chart_5_bb60_upper10 = models.FloatField(null=True, blank=True)
    chart_5_bb60_upper = models.FloatField(null=True, blank=True)
    chart_5_bb60_width = models.FloatField(null=True, blank=True)
    chart_5_bb240_upper20 = models.FloatField(null=True, blank=True)
    chart_5_bb240_upper10 = models.FloatField(null=True, blank=True)
    chart_5_bb240_upper = models.FloatField(null=True, blank=True)
    chart_5_bb240_width = models.FloatField(null=True, blank=True)
    chart_5_sun_width = models.FloatField(null=True, blank=True)
    chart_5_sun_max = models.FloatField(null=True, blank=True)
    chart_5_new_phase = models.BooleanField(null=True)
    chart_5_ab = models.BooleanField(null=True)
    chart_5_ab_v = models.BooleanField(null=True)
    chart_5_good_array = models.BooleanField(null=True)
    chart_5_bad_array = models.BooleanField(null=True)
    chart_5_vol20 = models.FloatField(null=True, blank=True)
    유보율 = models.FloatField(null=True, blank=True)
    부채비율 = models.FloatField(null=True, blank=True)
    액면가 = models.FloatField(null=True, blank=True)
    cash_value = models.FloatField(null=True, blank=True)
    EPS = models.FloatField(null=True, blank=True)
    상장주식수 = models.FloatField(null=True, blank=True)
    유동주식수 = models.FloatField(null=True, blank=True)
    매물대1 = models.FloatField(null=True, blank=True)
    매물대2 = models.FloatField(null=True, blank=True)
    신규상장 = models.BooleanField(null=True)
    
    
    @classmethod
    def get_data_with_ticker(cls):
        chartvalues = ChartValue.objects.select_related('ticker').all()
        chart_fields = [field.name for field in ChartValue._meta.get_fields()]
        data = []
        for value in chartvalues:
            record = {field :getattr(value, field) for field in chart_fields}
            record['code'] = value.ticker.code
            record['name'] = value.ticker.name
            data.append(record)
        
        df = pd.DataFrame(data)
        return df
    
    
    @classmethod
    def get_data_contain_words(cls, word_list = None, option='day'):
        '''
        구분으로 나눠야함. 
        1. 5분봉 coke 상태의 upper 값 돌파.상태.  --> 3w (실적, 수급, 정배, or 30up, or sun_ac, coke_ac, sun_gcv, coke_gcv)
        2. 30분봉 coke 상태의 upper 값 돌파.상태.  --> 3w (실적, 수급, 정배, or 30up, or sun_ac, coke_ac, sun_gcv, coke_gcv)
        3. 거래량 적고 단봉 -->  (실적, 수급, 정배, or 30up, or sun_ac, coke_ac, sun_gcv, coke_gcv)
        '''
        if word_list is None:
            return pd.DataFrame(cls.objects.values())
        
        
        search_field = 'reasons' if option=='day' else 'reasons_30'
        
        # Q 객체를 사용하여 모든 단어가 포함된 데이터 필터링
        query = Q()
        for keyword in word_list:
            query &= Q(**{f"{search_field}__icontains": keyword})

        # 데이터 가져오기
        qs = cls.objects.filter(query)
        chart_fields = [field.name for field in cls._meta.get_fields()]
        
        qs = qs.select_related('ticker')
        data = []
        for value in qs:
            record = {field :getattr(value, field) for field in chart_fields}
            record['code'] = value.ticker.code
            record['name'] = value.ticker.name
            data.append(record)
        result_df = pd.DataFrame(data)
        return result_df
    
    
    def __str__(self):
        return f"{self.ticker.name} {self.reasons[:10]}"
    

class Recommend(models.Model):
    code  = models.CharField(max_length=10)
    name = models.CharField(max_length=30)
    recommend_at = models.DateTimeField(auto_now_add=True, null=True)
    change = models.FloatField(null=True, blank=True)
    valid = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} {self.recommend_at} {self.valid}"
    
    @classmethod
    def refresh_data(cls):
        from django.utils import timezone
        delete_days = 60 # 60일지나면 데이터 삭제.
        min_gap = 5 # 5분지나면 valid =False 처리.
        to_update = []
        update_fields = ['valid']
        the_time = pd.Timestamp.now(tz='Asia/Seoul') -  pd.Timedelta(minutes=min_gap)
        the_time = the_time.to_pydatetime()
        qs = cls.objects.filter(valid=True)
        for item in qs:
            if the_time  > timezone.localtime(item.recommend_at):
                item.valid=False
                to_update.append(item)
        
        if to_update:
            print(f'{len(to_update)} 개 데이터 valid속성변경')
            cls.objects.bulk_update(to_update, fields=update_fields)
        
        the_date = pd.Timestamp.now(tz='Asia/Seoul') -  pd.Timedelta(days=delete_days)
        delete_qs = cls.objects.filter(recommend_at__lte=the_date)
        if delete_qs:
            print(f'제거할 데이터가 {len(delete_qs)}개 있습니다.')
            # delete_qs.delete()
            


class AllDart(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='alldart_set')
    rcept_dt = models.DateTimeField()
    corp_cls = models.CharField(max_length=4)
    corp_name = models.CharField(max_length=30,null=True)
    rcept_no = models.CharField(max_length=18)
    report_nm = models.CharField(max_length=100)
    stock_code = models.CharField(max_length=7,null=True)
    
    def __str__(self):
        return f"{self.corp_name} {self.report_nm}"

    @classmethod
    def get_all_dart_by_ticker(cls, code):
        ticker = Ticker.objects.get(code=code)
        if ticker:
            q = cls.objects.filter(ticker=ticker)
            now = pd.Timestamp.now(tz='Asia/Seoul')
            start = now - pd.Timedelta(days=365)
            q = q.filter(rcept_dt__gte=start)
            return q
        
            
            
    
class DartContract(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='dartcontract_set')
    name = models.CharField(max_length=100,null=True)
    rcept_dt = models.DateTimeField(null=True)
    rcept_no = models.CharField(max_length=18,null=True)
    계약내용 = models.CharField(max_length=100,null=True)
    계약금액 = models.BigIntegerField(null=True)
    계약상대방 = models.CharField(max_length=100,null=True)
    공급지역 = models.CharField(max_length=100,null=True)
    매출액대비 = models.FloatField(null=True)
    계약기간_시작 = models.DateTimeField(null=True)
    계약기간_종료 = models.DateTimeField(null=True)
    계약기간일 = models.IntegerField(null=True)
    계약일 = models.DateTimeField(null=True)
    
    def __str__(self):
        return f"{self.name} {self.매출액대비}"
    
    class Meta:
        verbose_name='공급계약'
        verbose_name_plural = '공급계약 목록'

class DartRightsIssue(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='dartrightsissue_set')
    name = models.CharField(max_length=100,null=True)
    rcept_dt = models.DateTimeField(null=True)
    rcept_no = models.CharField(max_length=18,null=True)
    증자방식 = models.CharField(max_length=100,null=True)
    신주의수 = models.IntegerField(null=True)
    증자전주식수 = models.IntegerField(null=True)
    신주비율 = models.FloatField(null=True)
    자금조달목적 = models.CharField(max_length=100,null=True)
    발행가액 = models.FloatField(null=True)
    납입일 = models.DateTimeField(null=True)
    배당기산일 = models.DateTimeField(null=True)
    상장예정일 = models.DateTimeField(null=True)
    제3자배정대상자 = models.CharField(max_length=100,null=True)
    제3자배정대상자관계 = models.TextField(null=True)
    제3자배정대상자선정경위 = models.TextField(null=True)

    class Meta:
        verbose_name='유상증자'
        verbose_name_plural = '유상증자 목록'

    def __str__(self):
        return f"{self.name} {self.신주비율} {self.제3자배정대상자}"
class DartConvertibleBond(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='dartconvertiblebond_set')
    name = models.CharField(max_length=100,null=True)
    rcept_dt = models.DateTimeField(null=True)
    rcept_no = models.CharField(max_length=18,null=True)
    전환사채총액 = models.BigIntegerField(null=True)
    자금조달목적 = models.CharField(max_length=100,null=True)
    표면이자율 = models.FloatField(null=True)
    만기이자율 = models.FloatField(null=True)
    전환가액 = models.FloatField(null=True)
    전환청구시작일 = models.DateTimeField(null=True)
    전환청구종료일 = models.DateTimeField(null=True)
    발행주식수 = models.IntegerField(null=True)
    주식총수대비비율 = models.FloatField(null=True)

    class Meta:
        verbose_name='전환사채'
        verbose_name_plural = '전환사채 목록'
        
        
    def __str__(self):
        return f"{self.name} 표면이자:{self.표면이자율} 총주식대비:{self.주식총수대비비율}"
class DartBonusIssue(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='dartbonusissue_set')
    name = models.CharField(max_length=100,null=True)
    rcept_dt = models.DateTimeField(null=True)
    rcept_no = models.CharField(max_length=18,null=True)
    신주의수 = models.IntegerField(null=True)
    주당배정주식수 = models.FloatField(null=True)
    배당기산일 = models.DateTimeField(null=True)
    상장예정일 = models.DateTimeField(null=True)
    
    def __str__(self):
        return f"{self.name} 1주당:{self.주당배정주식수} "
    class Meta:
        verbose_name='무상증자'
        verbose_name_plural = '무상증자 목록'

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE,related_name='favorites')
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE)
    buy_price = models.FloatField(null=True, blank=True, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'ticker')
        verbose_name='즐겨찾기'
        verbose_name_plural = '즐겨찾기 목록'
    
    def __str__(self):
        return f"{self.user}의 즐겨찾기 {self.ticker.name}"


class AiOpinion(models.Model):
    opinion = models.CharField(max_length=4)
    reason = models.TextField()
    ai_method = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.opinion} {self.created_at}"
    
class AiOpinionForStock(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE)
    opinion = models.CharField(max_length=4)
    reason = models.TextField()
    ai_method = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)
    close = models.FloatField(null=True)
    
    def __str__(self):
        return f"{self.ticker}{self.opinion} {self.created_at}"
    
    @classmethod
    def get_nth_latest_data(cls, n=1):
        """
        가장 최근 날짜로부터 n번째 날짜 반환
        n=1: 가장 최근 날짜
        n=2: 두 번째로 최근 날짜
        """
        dates = cls.objects.annotate(
            date=TruncDate('created_at')
        ).values('date').distinct().order_by('-date')
        
        if dates.exists() and len(dates) >= n:
            latest_date = dates[n-1]['date']
            qs = cls.objects.filter(created_at__date__gte=latest_date)
            qs = qs.order_by('-created_at')
            # 서울 시간으로 변환
            for instance in qs:
                instance.created_at = timezone.localtime(instance.created_at)
            return qs
            return latest_date
        return None
        
    
    @classmethod
    def get_today_data(cls, n=1):
        '''
        가장 최근데이터임. 
        '''
        last_date = AiOpinionForStock.objects.values('created_at').order_by('-created_at').first()['created_at']
        if not last_date:
            today = timezone.now().date()
            last_date = today
        qs = cls.objects.filter(created_at__date=last_date)
        qs = qs.order_by('-created_at')
        # 서울 시간으로 변환
        for instance in qs:
            instance.created_at = timezone.localtime(instance.created_at)
        return qs
    
    @classmethod
    def get_data_by_ticker(cls, ticker):
        qs = cls.objects.filter(ticker=ticker)
        qs = qs.order_by('-created_at')
        # 서울 시간으로 변환
        for instance in qs:
            instance.created_at = timezone.localtime(instance.created_at)
        return qs

class Short(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='short_set')
    Date = models.DateField()
    공매도 = models.BigIntegerField(null=True)
    매수 = models.BigIntegerField(null=True)
    비중 = models.FloatField(null=True)
    
    def __str__(self):
        return f"Short {self.ticker.name} {self.Date} 공매도:{self.공매도} 비중:{self.비중}"
    
    @classmethod
    def get_data_by_ticker(cls, ticker):
        qs = cls.objects.filter(ticker=ticker)
        qs = qs.order_by('-Date')
        # # 서울 시간으로 변환
        # for instance in qs:
        #     instance.created_at = timezone.localtime(instance.created_at)
        return qs
class ShortInterest(models.Model):
    ticker = models.ForeignKey(Ticker, on_delete=models.CASCADE, related_name='short_interest_set')
    Date = models.DateField()
    대차체결주식수 = models.BigIntegerField(null=True)
    리콜상환주식수 = models.BigIntegerField(null=True)
    상환주식수 = models.BigIntegerField(null=True)
    대차잔여주식수 = models.BigIntegerField(null=True)
    대차잔액 = models.BigIntegerField(null=True)

    def __str__(self):
        return f"ShortInterest {self.ticker.name} {self.Date} 대차잔액:{self.대차잔액}"
    @classmethod
    def get_data_by_ticker(cls, ticker):
        qs = cls.objects.filter(ticker=ticker)
        qs = qs.order_by('-Date')
        # # 서울 시간으로 변환
        # for instance in qs:
        #     instance.created_at = timezone.localtime(instance.created_at)
        return qs
