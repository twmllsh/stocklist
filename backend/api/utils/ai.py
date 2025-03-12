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
       
    ks = fdr.DataReader('KS11',start=start, end=end) # KOSPI 지수 (KRX)
    kq = fdr.DataReader('KQ11',start=start, end=end) # KOSDAQ 지수 (KRX)
  
    # ks200 = fdr.DataReader('KS200',start=start, end=end) # KOSPI 200 (KRX)
    vix = fdr.DataReader("VIX", start=start, end=end)
    usd_krw = fdr.DataReader('USD/KRW',start=start, end=end) # 달러 원화
    # 외국계추정합 최근 동향 추가.
    contents1 = """당신은 한국주식 ​​스윙투자의 전문가입니다. 주어진 여러 지표데이터를 분석하고 현재 투자를할 적절한시기인지 아닌지 판단해줘. 주어진데이터는 최근 6개월치 데이터가 들어있어. 매수,매도,보류 중 어떤상황인지 다음 지표를 고려하여 분석하십시오.:
    - 코스피 지수 (KS11)
    - 코스닥 지수 (KQ11)
    - 변동성지수 (VIX)
    - 달러 원화 환율 (USD_KRW)
    
    Response in json format.

    Response Example:
    {"opinion": "매수", "reason": 의견에 대한 이유}
    {"opinion": "매도", "reason": 의견에 대한 이유}
    {"opinion": "보류", "reason": 의견에 대한 이유}"""
    contents2 = f"""코스피 지수 (KS11): {ks.to_json()}
                    코스닥 지수 (KQ11): {kq.to_json()}
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
    
    
    
    
    
    contents1 = """당신은 한국주식 ​​스윙투자의 전문가입니다. 주어진 데이터를 분석해서 지금이 투자를 할 적절한시기인지 아닌지 판단해줘. :
    - 종목 OHLCV 데이터
    - 종목 컨센서스 정보 (연간, 분기)
    - 최근 투자자 정보
    - 최근 외국계창구 현황.
    
    Response in json format.

    Response Example:
    {"opinion": "매수", "reason": 의견에 대한 이유}
    {"opinion": "매도", "reason": 의견에 대한 이유}
    {"opinion": "보류", "reason": 의견에 대한 이유}"""
    contents2 = f"""종목 OHLCV 데이터: {ohlcv.to_json()}
                    종목 연간 컨센서스 정보: {consen_year.to_json()}
                    종목 분기 컨센서스 정보: {consen_quarter.to_json()}
                    최근 투자자 정보: {invest_df.to_json()}
                    최근 외국계창구 현황: {broker_df.to_json()}"""
                    
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

    # AI 분석 요청
    contents1 = """당신은 한국주식 ​​스윙투자의 전문가입니다. 주어진 데이터를 분석해서 지금이 투자를 할 적절한시기인지 아닌지 판단해줘.
    - 종목 OHLCV 데이터
    - 종목 컨센서스 정보 (연간, 분기)
    - 최근 투자자 정보
    - 최근 외국계창구 현황.

    Response in json format.

    Response Example:
    {"opinion": "매수", "reason": 의견에 대한 이유}
    {"opinion": "매도", "reason": 의견에 대한 이유}
    {"opinion": "보류", "reason": 의견에 대한 이유}
    """ 
    # 기존 프롬프트 내용
    contents2 = f"""종목 OHLCV 데이터: {ohlcv.to_json()}
                   종목 연간 컨센서스 정보: {consen_year.to_json()}
                   종목 분기 컨센서스 정보: {consen_quarter.to_json()}
                   최근 투자자 정보: {invest_df.to_json()}
                   최근 외국계창구 현황: {broker_df.to_json()}"""

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
        await sync_to_async(AiOpinionForStock.objects.create)(**result)
        print('데이터베이스 저장 완료')
    except Exception as e:
        print(f"Error: {str(e)}")
        result = {"error": "error"}
    
    return result

async def get_opinion_by_ticker_async_test(code_list):
    '''
    개별종목 분석의 비동기 버전 테스트
    '''
    tasks = [get_opinion_by_ticker_async(code) for code in code_list]
    result = await asyncio.gather(*tasks)
    return result
