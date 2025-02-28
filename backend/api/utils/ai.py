import json
import os
import pandas as pd
from openai import OpenAI
import FinanceDataReader as fdr
from pykrx import stock as pystock
import ta
from api.models import AiOpinion

def get_korean_stock_status(ai_method="openai"):
    '''
    {"의견": "보류" ,"매수", "매도",
    "이유": "최근 코스피 지수는..."}
    '''
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


