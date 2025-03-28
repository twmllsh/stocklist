import json
import os
import random
import pandas as pd
from openai import OpenAI
import FinanceDataReader as fdr
from pykrx import stock as pystock
import ta
from api.models import Ticker, AiOpinion, AiOpinionForStock
import asyncio
import aiohttp
from asgiref.sync import sync_to_async
from .mystock import GetData


def get_korean_stock_status(ai_method="openai"):
    '''
    한국 주식 지수 분석. 
    {"의견": "보류" ,"매수", "매도",
    "이유": "최근 코스피 지수는..."}
    '''
    ai_method = random.choice(['openai','gemini'])
    if ai_method == "openai":
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        client = OpenAI(api_key=OPENAI_API_KEY)
        model  = "gpt-4o"
        print("use openai")

    elif ai_method == "gemini":
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        # Gemini API Key 및 Base URL
        BASE_URL = "https://generativelanguage.googleapis.com/v1beta/"
        # OpenAI Library 초기화 (Gemini API 활용)
        client = OpenAI(api_key=GEMINI_API_KEY, base_url=BASE_URL)
        model  = "gemini-1.5-flash"
        print("use gemini")
    
    end = pd.Timestamp.now()
    start = end - pd.DateOffset(months=3) 
    
    # ks = fdr.DataReader('KS11',start=start, end=end) # KOSPI 지수 (KRX)
    # kq = fdr.DataReader('KQ11',start=start, end=end) # KOSDAQ 지수 (KRX)
    kodex_레버리지_d = GetData._get_ohlcv_from_fdr(code='122630')
    kodex_레버리지30 = GetData._get_ohlcv_from_daum(code='122630', data_type='30분봉', limit=300)
    KODEX_200선물인버스2X = GetData._get_ohlcv_from_fdr(code='252670')
    KODEX_200선물인버스2X30 = GetData._get_ohlcv_from_daum(code='252670', data_type='30분봉', limit=300)
    kodex_ticker = Ticker.objects.get(code='122630')
    KODEX_200선물인버스2X_ticker = Ticker.objects.get(code='252670')
    
    kodex_레버리지_investor_data =  pd.DataFrame(kodex_ticker.investortrading_set.values())
    KODEX_200선물인버스2X_investor_data =  pd.DataFrame(KODEX_200선물인버스2X_ticker.investortrading_set.values())
    
    # ks200 = fdr.DataReader('KS200',start=start, end=end) # KOSPI 200 (KRX)
    vix = fdr.DataReader("VIX", start=start, end=end)
    usd_krw = fdr.DataReader('USD/KRW',start=start, end=end) # 달러 원화
    # 외국계추정합 최근 동향 추가.
    contents1 = """당신은 한국주식 ​​스윙투자의 전문가입니다. 주어진 여러 지표데이터를 분석하고 현재 kodex_레버리지를 투자를할 적절한 시기인지 아닌지 판단해줘:
    Response in json format.
    Response Example:
    {"opinion": "매수 or 관망 or 매도", "reason": 의견에 대한 이유} ...
    """
    contents2 = f"""kodex_레버리지 일봉: {kodex_레버리지_d.to_json()}
                    kodex_레버리지 30분봉 데이터: {kodex_레버리지30.to_json()}
                    kodex_레버리지 최근투자자: {kodex_레버리지_investor_data.to_json()}
                    KODEX_200선물인버스2X 일봉: {KODEX_200선물인버스2X.to_json()}
                    KODEX_200선물인버스2X 30분봉 데이터: {KODEX_200선물인버스2X30.to_json()}
                    KODEX_200선물인버스2X 최근투자자: {KODEX_200선물인버스2X_investor_data.to_json()}
                    변동성지수 (VIX): {vix.to_json()}
                    달러 원화 환율 (USD_KRW): {usd_krw.to_json()}"""
                    
    response = client.chat.completions.create(
    model = model,
    messages=[
        {
        "role": "system",
        "content": contents1,
        },
        {
        "role": "user",
        "content": contents2,
        }
    ],
    response_format={
        "type": "json_object"
    }
    )
    result = response.choices[0].message.content
    print(result)
    try:
        result = json.loads(result)
        result['ai_method']= ai_method
        ob = AiOpinion(**result)
        ob.save()
        print('데이터베이스 저장')
    except:
        result = {"error": "error"}
    return result

def get_opinion_by_ticker(code , ai_method="openai"):
    '''
    개별종목 분석 
    {"의견": "보류" ,"매수", "매도",
    "이유": "최근 코스피 지수는..."}
    '''
    ai_method = random.choice(['openai','gemini'])
    if ai_method == "openai":
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        client = OpenAI(api_key=OPENAI_API_KEY)
        model  = "gpt-4o"
        print("use openai")

    elif ai_method == "gemini":
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        # Gemini API Key 및 Base URL
        BASE_URL = "https://generativelanguage.googleapis.com/v1beta/"
        # OpenAI Library 초기화 (Gemini API 활용)
        client = OpenAI(api_key=GEMINI_API_KEY, base_url=BASE_URL)
        model  = "gemini-1.5-flash"
        print("use gemini")
    
    try:
        ticker = Ticker.objects.get(code=code)
    except:
        try:
            ticker = Ticker.objects.get(name=code)
        except:
            return {"error": "ticker error"}
        
    end = pd.Timestamp.now()
    start = end - pd.DateOffset(months=3) 
       
    # 제공할 데이터 ohlcv, 최근투자자, 뉴스, 컨센서스 데이터. 
    ohlcv = fdr.DataReader(ticker.code,  start=start, end=end) # KOSPI 지수 (KRX)
    ohlcv_30 = GetData._get_ohlcv_from_daum(
                        code=ticker.code, data_type="30분봉", limit=200)
    close = int(ohlcv['Close'].iloc[-1])
    # 컨센서스 정보
    start_year = pd.Timestamp.now().year -2
    finstats = ticker.finstats_set.filter(year__gte=start_year)
    finstats = finstats.filter(fintype__contains='연결')
    year = finstats.filter(quarter=0)
    quarter = finstats.filter(quarter__gt=0)

       
    consen_year = pd.DataFrame(year.values())
    consen_year = consen_year.filter(regex='^((?!id).)*$')
    consen_quarter = pd.DataFrame(quarter.values())
    consen_quarter = consen_quarter.filter(regex='^((?!id).)*$')
    consen_quarter['quarter'] = consen_quarter['quarter'] / 3
    
    # 최근투자자.
    end = pd.Timestamp.now()
    start = end - pd.DateOffset(months=1) 
    investing = ticker.investortrading_set.all()
    investing = investing.filter(날짜__gte=start)
    invest_df = pd.DataFrame(investing.values('날짜','투자자','매도거래대금','매수거래대금'))
    
    
    # 외국계추정합 최근 동향 추가.
    broker = ticker.brokertrading_set.all()
    broker = broker.filter(date__gte=start)
    broker_df = pd.DataFrame(broker.values('date','broker_name','buy','sell'))
    broker_df = broker_df.fillna(0)
    
    # 120일 기준 매물대
    price_level1 = ticker.chartvalue.매물대1 if ticker.chartvalue.매물대1 else None
    price_level2 = ticker.chartvalue.매물대2 if ticker.chartvalue.매물대1 else None
        
    contents1 = """당신은 한국주식 ​​스윙투자의 전문가입니다. 단타위주로 매매할 것이다. 주어진 데이터를 분석해서 지금이 투자를 할 적절한시기인지 아닌지 판단해줘. :

    Response in json format.

    Response Example:
    {"opinion": "매수 or 보류 or 매도", "reason": 의견에 대한 이유}...
  """
    contents2 = f"""종목 OHLCV 데이터: {ohlcv.to_json()}
                    종목 OHLCV 30분봉 데이터: {ohlcv_30.to_json()}
                    종목 연간 컨센서스 정보: {consen_year.to_json()}
                    종목 분기 컨센서스 정보: {consen_quarter.to_json()}
                    최근 투자자 정보: {invest_df.to_json()}
                    최근 외국계창구 현황: {broker_df.to_json()}
                    최근 6개월기준 첫번째 매물대: {price_level1}
                    최근 6개월기준 두번째 매물대: {price_level2}
                    """
                    
    response = client.chat.completions.create(
    model = model,
    messages=[
        {
        "role": "system",
        "content": contents1,
        },
        {
        "role": "user",
        "content": contents2,
        }
    ],
    response_format={
        "type": "json_object"
    }
    )
    result = response.choices[0].message.content
    print(result)
    try:
        result = json.loads(result)
        result['ticker'] = ticker
        result['ai_method']= ai_method
        result['close'] = close
        ob = AiOpinionForStock(**result)
        ob.save()
        print('데이터베이스 저장')
    except:
        result = {"error": "error"}
    return result


async def get_opinion_by_ticker_async(code, ai_method="openai"):
    '''
    개별종목 분석의 비동기 버전
    '''
    ai_method = random.choice(['openai','gemini'])
    if ai_method == "openai":
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        client = OpenAI(api_key=OPENAI_API_KEY)
        model = "gpt-4o"
        print("use openai")
    elif ai_method == "gemini":
        GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
        BASE_URL = "https://generativelanguage.googleapis.com/v1beta/"
        client = OpenAI(api_key=GEMINI_API_KEY, base_url=BASE_URL)
        model = "gemini-1.5-flash"
        print("use gemini")
    
    try:
        # Django ORM 호출을 비동기로 변환
        ticker = await sync_to_async(Ticker.objects.get)(code=code)
    except Ticker.DoesNotExist:
        try:
            ticker = await sync_to_async(Ticker.objects.get)(name=code)
        except Ticker.DoesNotExist:
            return {"error": "ticker error"}
    
    end = pd.Timestamp.now()
    start = end - pd.DateOffset(months=3)
    
    
    # 각 데이터 조회를 비동기로 처리
    async with aiohttp.ClientSession() as session:
        # OHLCV 데이터 조회
        ohlcv = await sync_to_async(fdr.DataReader)(ticker.code, start=start, end=end)
        # ohlcv30 = 
        ohlcv_30 = await sync_to_async(GetData._get_ohlcv_from_daum)(
                        code=ticker.code, data_type="30분봉", limit=200)
        close = int(ohlcv['Close'].iloc[-1])
        # 컨센서스 정보 조회
        start_year = pd.Timestamp.now().year - 2
        finstats = await sync_to_async(lambda: list(
            ticker.finstats_set.filter(year__gte=start_year)
            .filter(fintype__contains='연결')
        ))()
        
        # 최근 투자자 정보 조회
        investing_end = pd.Timestamp.now()
        investing_start = investing_end - pd.DateOffset(months=1)
        investing = await sync_to_async(lambda: list(
            ticker.investortrading_set.filter(날짜__gte=investing_start)
        ))()
        
        # 외국계 창구 정보 조회
        broker = await sync_to_async(lambda: list(
            ticker.brokertrading_set.filter(date__gte=investing_start)
        ))()

    # 데이터프레임 변환 및 처리
    year_data = [f for f in finstats if f.quarter == 0]
    quarter_data = [f for f in finstats if f.quarter > 0]
    
    consen_year = pd.DataFrame([{k:v for k,v in f.__dict__.items() if not k.startswith('_')} for f in year_data])
    consen_year = consen_year.filter(regex='^((?!id).)*$') if not consen_year.empty else pd.DataFrame()
    
    consen_quarter = pd.DataFrame([{k:v for k,v in f.__dict__.items() if not k.startswith('_')} for f in quarter_data])
    consen_quarter = consen_quarter.filter(regex='^((?!id).)*$') if not consen_quarter.empty else pd.DataFrame()
    if not consen_quarter.empty:
        consen_quarter['quarter'] = consen_quarter['quarter'].apply(lambda x: x/3)
    
    invest_df = pd.DataFrame([{
        '날짜': i.날짜,
        '투자자': i.투자자,
        '매도거래대금': i.매도거래대금,
        '매수거래대금': i.매수거래대금
    } for i in investing])
    
    broker_df = pd.DataFrame([{
        'date': b.date,
        'broker_name': b.broker_name,
        'buy': b.buy,
        'sell': b.sell
    } for b in broker])
    broker_df = broker_df.fillna(0)

    # 120일 기준 매물대
    # chartvalue = await sync_to_async(Ticker.objects.get)(code=code)
    # price_level1 = await sync_to_async(getattr)(chartvalue, '매물대1')
    # price_level2 = await sync_to_async(getattr)(chartvalue, '매물대2')

    chart_value = await sync_to_async(lambda: ticker.chartvalue)()
    # 매물대 값 접근
    price_level1 = chart_value.매물대1 if hasattr(chart_value, '매물대1') else None
    price_level2 = chart_value.매물대2 if hasattr(chart_value, '매물대2') else None
    
    # AI 분석 요청
    contents1 = """너는 한국주식 ​​스윙투자(단타)의 전문가야.주어진 데이터를 분석해서 지금이 투자를 할 적절한시기인지 아닌지 판단해줘. :
    
    Response in json format.

    Response Example:
    {"opinion": "매수 or 보류 or 매도", "reason": 의견에 대한 이유}...
    """ 
    # 기존 프롬프트 내용
    contents2 = f"""종목 OHLCV 데이터: {ohlcv.to_json()}
                    종목 OHLCV 30분봉 데이터: {ohlcv_30.to_json()}
                    종목 연간 컨센서스 정보: {consen_year.to_json()}
                    종목 분기 컨센서스 정보: {consen_quarter.to_json()}
                    최근 투자자 정보: {invest_df.to_json()}
                    최근 외국계창구 현황: {broker_df.to_json()}
                    최근 6개월기준 첫번째 매물대: {price_level1}
                    최근 6개월기준 두번째 매물대: {price_level2}"""
    response = await sync_to_async(client.chat.completions.create)(
        model=model,
        messages=[
            {"role": "system", "content": contents1},
            {"role": "user", "content": contents2}
        ],
        response_format={"type": "json_object"}
    )
    
    result = response.choices[0].message.content
    print(result)
    
    try:
        result = json.loads(result)
        result['ticker'] = ticker
        result['ai_method'] = ai_method
        result['close'] = close
        await sync_to_async(AiOpinionForStock.objects.create)(**result)
        print('데이터베이스 저장 완료')
    except Exception as e:
        print(f"Error: {str(e)}")
        result = {"error": "error"}
    
    return result

async def get_opinion_by_ticker_async_many(code_list):
    '''
    개별종목 분석의 비동기 버전 테스트
    '''
    tasks = [get_opinion_by_ticker_async(code) for code in code_list]
    result = await asyncio.gather(*tasks)
    return result
