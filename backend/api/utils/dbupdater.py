import asyncio
import json
import random
import re
import csv
import os
import time
import functools
from collections import Counter
import aiohttp
import numpy as np
import requests
import pandas as pd
from io import StringIO
from typing import Optional, List, Dict, Tuple, Iterable, Union
from pathlib import Path
from pykrx import stock as pystock
import FinanceDataReader as fdr
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from django.db import transaction
from django.conf import settings
from django.db.models import Max
from django.db import DatabaseError
from django.db import connection
from api.models import *
from api.utils.sean_func import Text_mining, Sean_func
from api.utils.mystock import Stock, ElseInfo
from .message import My_discord
from .ai import *
import xmltodict

mydiscord = My_discord()

ua = UserAgent()


class StockFunc:

    def to_number(value: Union[str, int, float]) -> Optional[Union[int, float]]:
        if isinstance(value, (int, float)):
            if isinstance(value, float) and (pd.isna(value) or value in (float('inf'), float('-inf'))):
                return None
            return value
            
        if not isinstance(value, str):
            return None

        if "조" in value:
            value = value.replace("조", "").replace(" ", "")
        
        pattern = re.compile(r"\d*,?\d*\.?\d+")
        sub_pattern = re.compile(r"[,% ]")
        
        if match := pattern.search(value):
            cleaned = sub_pattern.sub("", match.group())
            if not cleaned:
                return None
                
            return float(cleaned) if '.' in cleaned else int(cleaned)
        
        return None


    def remove_nomean_index_col(df: pd.DataFrame):
        df = df.transpose()
        df.columns = df.iloc[0]
        df = df.drop(df.index[0])
        return df

    def _cal_investor(df: pd.DataFrame):
        """
        구간데이터를 주면 정리해주는 함수. return dict
        """
        temp_dic = {}
        if all(
            [
                col in df.columns
                for col in [
                    "날짜",
                    "투자자",
                    "매도거래대금",
                    "매수거래대금",
                    # "순매수거래대금",
                ]
            ]
        ):
            temp_df = df.copy()

            ##########################################
            start_date, end_date = temp_df["날짜"].iloc[0], temp_df["날짜"].iloc[-1]
            temp_dic["start"] = start_date
            temp_dic["end"] = end_date

            ########################################
            grouped_temp_df = temp_df.groupby("투자자")[
                ["매도거래대금", "매수거래대금", "순매수거래대금"]
            ].sum()
            grouped_temp_df = grouped_temp_df.loc[
                ~(
                    (grouped_temp_df["매수거래대금"] == 0)
                    & (grouped_temp_df["매도거래대금"] == 0)
                )
            ]  ## 매수매도 모두 0인값 제거.
            grouped_temp_df["매집비"] = round(
                (grouped_temp_df["매수거래대금"] / grouped_temp_df["매도거래대금"])
                * 100,
                1,
            )
            grouped_temp_df["full"] = (
                (grouped_temp_df["순매수거래대금"] == grouped_temp_df["매수거래대금"])
                & (grouped_temp_df["순매수거래대금"] != 0)
                & (grouped_temp_df["매수거래대금"] >= 100000000)
            )  # 1억이상.

            # 주도기관
            적용기관리스트 = list(
                grouped_temp_df.sort_values("매집비", ascending=False).index
            )
            주도기관 = ",".join(적용기관리스트[:2])
            적용기관 = ",".join(적용기관리스트)
            temp_dic["적용기관"] = 적용기관
            temp_dic["주도기관"] = 주도기관

            ##  전체풀매수 여부..
            df_sum = grouped_temp_df.sum()
            매집비 = round(
                df_sum.loc["매수거래대금"] / df_sum.loc["매도거래대금"] * 100, 1
            )
            순매수 = df_sum.loc["순매수거래대금"]
            순매수금액_억 = round(순매수 / 100000000, 1)
            temp_dic["순매수대금"] = 순매수
            temp_dic["순매수금_억"] = 순매수금액_억
            temp_dic["매집비"] = 매집비

            ## 부분 full_buy 여부 ##############################################################
            temp_df["full_b"] = (
                (temp_df["순매수거래대금"] == temp_df["매수거래대금"])
                & (temp_df["매수거래대금"] != 0)
                & (temp_df["매수거래대금"] >= 50000000)
            )
            full_b = temp_df.loc[temp_df["full_b"]]
            if len(full_b):
                # result_b = full_b.groupby('투자자').sum()[['순매수거래량','순매수거래대금','full_b']].sort_values(['순매수거래대금','full_b'],ascending=[False,False])
                result_b = (
                    full_b.groupby("투자자")[
                        ["순매수거래량", "순매수거래대금", "full_b"]
                    ]
                    .sum()
                    .sort_values(["순매수거래대금", "full_b"], ascending=[False, False])
                )
                부분풀매수기관 = ",".join(result_b.index)
                부분풀매수금액 = result_b["순매수거래대금"].sum()
                부분풀매수일 = result_b["full_b"].sum()
                temp_dic["부분풀매수기관"] = 부분풀매수기관
                temp_dic["부분풀매수금액"] = 부분풀매수금액
                temp_dic["부분풀매수일"] = 부분풀매수일
            else:
                temp_dic["부분풀매수기관"] = ""
                temp_dic["부분풀매수금액"] = 0
                temp_dic["부분풀매수일"] = 0

            ## 부분 full_sell 여부 ##############################################################
            temp_df["full_s"] = (
                abs(temp_df["순매수거래대금"]) == temp_df["매도거래대금"]
            ) & (temp_df["매도거래대금"] != 0)
            full_s = temp_df.loc[temp_df["full_s"]]
            if len(full_s):
                # result_s = full_s.groupby('투자자').sum()[['순매수거래량','순매수거래대금','full_s']].sort_values(['순매수거래대금','full_s'],ascending=[True,False])
                result_s = (
                    full_s.groupby("투자자")[
                        ["순매수거래량", "순매수거래대금", "full_s"]
                    ]
                    .sum()
                    .sort_values(["순매수거래대금", "full_s"], ascending=[True, False])
                )
                부분풀매도기관 = ",".join(result_s.index)
                부분풀매도금액 = result_s["순매수거래대금"].sum()
                부분풀매도일 = result_s["full_s"].sum()
                temp_dic["부분풀매도기관"] = 부분풀매도기관
                temp_dic["부분풀매도금액"] = 부분풀매도금액
                temp_dic["부분풀매도일"] = 부분풀매도일
            else:
                temp_dic["부분풀매도기관"] = ""
                temp_dic["부분풀매도금액"] = 0
                temp_dic["부분풀매도일"] = 0

            ## 전체 full 여부
            if len(grouped_temp_df.loc[grouped_temp_df["full"]]):
                풀매수기관 = list(grouped_temp_df.loc[grouped_temp_df["full"]].index)
                풀매수금액 = grouped_temp_df.loc[grouped_temp_df["full"]][
                    "순매수거래대금"
                ].sum()
                풀매수여부 = True if len(풀매수기관) else False
                temp_dic["풀매수여부"] = 풀매수여부
                temp_dic["풀매수기관"] = 풀매수기관
                temp_dic["풀매수금액"] = 풀매수금액
            else:
                temp_dic["풀매수여부"] = False
                temp_dic["풀매수기관"] = ""
                temp_dic["풀매수금액"] = 0
                ## 추후 추가할수 있는 부분.
                # temp_dic["start_ma5_value"] = start_ma5_value
                # temp_dic["저점대비현재가상승률"] = 저점대비현재가상승률

            return temp_dic

    def get_investor_part(code: str, low_dates: List):
        """
        애초부터 investor_ls 자료만 가져온다.
        """
        ls = []
        investor_ls = ["외국인", "투신", "금융투자", "연기금", "사모"]
        if len(low_dates):
            temp_low_dates = [
                date.date() for date in low_dates
            ]  # 임시변환 ? 이게 웨데이터 받는거랑 db 데이터 받는거랑 달라.?
            qs = InvestorTrading.objects.filter(
                ticker__code=code,
                날짜__gte=temp_low_dates[0],
                투자자__in=investor_ls,
            )
            df = pd.DataFrame(
                qs.values("날짜", "투자자", "매도거래대금", "매수거래대금")
            )
            if len(df):
                df["날짜"] = pd.to_datetime(df["날짜"])

                ## low_dates 별로 나누기. 시작 포함 끝 미포함.
                for i in range(len(low_dates) - 1):
                    temp_dic = {}
                    start_date, end_date = low_dates[i], low_dates[i + 1]
                    temp_df = df.loc[
                        (df["날짜"] >= start_date) & (df["날짜"] < end_date)
                    ]
                    if len(temp_df):
                        temp_dic = StockFunc._cal_investor(temp_df)
                        ls.append(temp_dic)
                ls.append(StockFunc._cal_investor(df))  # 마지막을 전체 데이터 계산.

        return pd.DataFrame(ls)

    def delete_old_data(the_model: models.Model, date_field="date", days=800):
        """
        대상
        """
        # model 있는지 확인
        if days < 800:
            print(
                "데이터 삭제 위험이 있습니다. 현재 n일이 {days} 일로 지정되어있습니다. 데이터 지우기를 취소합니다. "
            )
            return

        try:
            the_model.objects.exists()
            print("모델이 존재합니다.")
        except DatabaseError:
            print("테이블이 존재하지 않습니다.")
            return

        # date_field 있는지 확인
        exist_fields = [
            field.name
            for field in the_model._meta.get_fields()
            if field.name == date_field
        ]
        if not exist_fields:
            print("field가 존재하지 않습니다.")
            return
        # 데이터 있는지 확인
        if the_model.objects.exists():
            the_date = pd.Timestamp.now().date()
            the_date = the_date - pd.Timedelta(days=days)
            filter_args = {f"{date_field}__lte": the_date}  ##
            qs = the_model.objects.filter(**filter_args)
            if qs.exists():
                print(qs.values())
                print(f"{qs.count()}개 데이터 삭제중. test..")

                # 있다면 삭제.
                # qs.delete()

    
    def is_holiday(verbose=False):
        """
        주말이거나 공휴일이면 True
        """
        is_holiday = False
        today = pd.Timestamp.now().date()
        # today = pd.Timestamp(year=2024, month=12, day=25) # test 용 #######################
        if today.weekday() == 5 or today.weekday() == 6:
            print('토요일이나 일요일입니다.')
            print(f"weekday: {today.weekday()}") if verbose else None
            is_holiday = True
            return is_holiday

        ## https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15012690
        ## 2027-01-26 만료예정 . 연장해야함. 응답을 안받으면 체크하지 않고 false 반환해야함. 
        url = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'
        api_key = "gygPD+lpgkY4Idpksim4zNjCOj3V4BuOZBSAEXjx2hN6WVxcewdWfypdN0t6sv4Pmm3N5ggLGmkzh2V1cLlzfA=="
        params ={'serviceKey' : api_key, 'solYear' : today.year , 'solMonth' : today.month }
        response = requests.get(url, params=params)
        print(f"response status_code: {response.status_code}"  if verbose else None)
        if response.status_code == 200:
            response_str = response.content.decode('utf-8')
            data_dict = xmltodict.parse(response_str)
        else:
            return False
            
        try:
            df_rest = pd.DataFrame(data_dict['response']['body']['items']).T
            df_rest['locdate'] = pd.to_datetime(df_rest['locdate'])
        except:
            df_rest = pd.DataFrame()
            print('df_rest error') if verbose else None
            return False
        # 특정 날짜 필터링
        # today = pd.Timestamp('2024-12-25')  # 필터링할 날짜
        filtered_df = df_rest[df_rest['locdate'] == today]
        
        if not len(filtered_df) == 0:
            print(f"{filtered_df.iloc[0]['dateName']} 입니다. ")
            is_holiday = True
        return is_holiday
    
    def is_market_open():
        '''
        9시이후에 한번 실행해서 서버에서 상태업데이트하기. 
        
        '''
        result = True
        now = pd.Timestamp.now()
        hour = now.hour
        if 9 <= hour:
            data = fdr.DataReader("KS11", now.date(), now.date())
            if len(data) == 0:
                result = False
        return True
    
    
    
    def get_progress_percentage():
        """
        Calculates the progress percentage of the day within the specified time range.
        """
        
        import datetime
        import pytz
        try:
            # Set the timezone to Asia/Seoul
            seoul_tz = pytz.timezone('Asia/Seoul')
            now = datetime.datetime.now(seoul_tz)

            # Define the start and end times
            start_time = now.replace(hour=9, minute=0, second=0, microsecond=0)
            end_time = now.replace(hour=15, minute=0, second=0, microsecond=0)

            # Check if the current time is within the specified range
            if start_time <= now <= end_time:
                # Calculate the elapsed time
                elapsed_time = now - start_time

                # Calculate the total time duration
                total_time = end_time - start_time

                # Calculate the progress percentage
                progress_percentage = (elapsed_time / total_time) 
                return round(progress_percentage,3)
            else:
                return 1 # return 100 if the current time is after the end time.
        except Exception as e:
            print(f"An error occurred: {e}")
            return None

       

class DBUpdater:

    def update_ticker():
        # if StockFunc.is_holiday():
        #     return 
        
        
        print("====================================")
        print("update_ticker running.......")
        print("====================================")
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        try:
            datas = asyncio.run(GetData.get_code_info_df_async())
            print("데이터 다운로드 완료!")
            print("db update 중.")
            datas = datas.to_dict("records")

            new_codes = [data["code"] for data in datas]
            existing_tickers = Ticker.objects.filter(code__in=new_codes)
            existing_tickers_dict = {ticker.code: ticker for ticker in existing_tickers} if Ticker.objects.exists() else {}

            ## 업데이트할것과 새로 생성하는것을 분리
            to_update = []
            to_create = []

            for data in datas:
                code = data["code"]
                if code in existing_tickers_dict:
                    # 존재하면
                    ticker = existing_tickers_dict[code]
                    if ticker.name != data["name"] or ticker.구분 != data["gb"]:
                        ticker.name = data["name"]
                        ticker.구분 = data["gb"]
                        to_update.append(ticker)
                else:
                    # 존재하지 않으면
                    to_create.append(
                        Ticker(code=data["code"], name=data["name"], 구분=data["gb"])
                    )

            with transaction.atomic():
                if len(to_update) > 0:
                    Ticker.objects.bulk_update(to_update, ["name", "구분"])
                    print(f"updated 완료 {len(to_update)} ")
                    print(to_update)

                if len(to_create) >0:
                    Ticker.objects.bulk_create(to_create)
                    print(f"created 완료 {len(to_create)} ")
                    print(to_create)
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} : update_ticker finished!!"  
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                print('디스코드 메세지 전송 실패')
                
            
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e}: update_ticker xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                print('디스코드 메세지 전송 실패')
                
        return datas

    def update_ohlcv(장중=None, codes:list = None, all_fdr=False, start_date = None, end_date = None):
        ''' option : , codes : '''

        print("====================================")
        print("update_ohlcv running.......")
        print("====================================")
        from datetime import time as datetime_time
        
        

        def _all_data_from_fdr():
            ## 만약 토요일이면,  전체데이터 새로 fdr로 받기.
            tickers = Ticker.objects.all()
            exist_ticker_dict = {ticker.code: ticker for ticker in tickers}
            
            start_date = pd.Timestamp.now().date() - pd.Timedelta(days=700)

            ## 데이터 모두 먼저 지우기
            if codes is not None:
                Ohlcv.objects.filter(ticker__code__in=codes).delete()
            else:
                Ohlcv.objects.all().delete()
                with connection.cursor() as cursor:
                    cursor.execute("ALTER SEQUENCE api_ohlcv_id_seq RESTART WITH 1;")
                print('ohlcv id 초기화 성공!!!!!!!!')
            
            to_create_add = []
            ticker_list = []
            for code, ticker_obj in exist_ticker_dict.items():
                if codes is not None and code not in codes:
                    continue
                if ticker_obj:
                    data = fdr.DataReader(code, start=start_date)
                    seconds = 1
                    print(f'update_ohlcv fdr작업중..{seconds}초간 정지.{ticker_obj.name}:{len(data)}개 데이터 받음. ')
                    time.sleep(seconds)
                    if len(data):
                        for date, row in data.iterrows():
                            ohlcv = Ohlcv(
                                ticker=ticker_obj,
                                Date=date,
                                Open=row["Open"],
                                High=row["High"],
                                Low=row["Low"],
                                Close=row["Close"],
                                Volume=row["Volume"],
                                Change=row["Change"],
                            )
                            to_create_add.append(ohlcv)
                            ticker_list.append(code)
                    
                if len(ticker_list) > 10: ## 10개씩 삭제 저장! 
                    ## 한 종목씩 저장하는 방식. 
                    with transaction.atomic():
                        # 새로운 데이터 일괄 삽입
                        Ohlcv.objects.bulk_create(to_create_add, batch_size=1000)
                    to_create_add = []
                    ticker_list = []
                    print('저장완료')
            print("finished!! ")
        
        # 금요일이면 _all_data_from_fdr 실행하기.
        today = pd.Timestamp.now()
        print('오늘: ',today.weekday())
        now_time = today.time()
        start_time = datetime_time(15, 40)  # 15시 40분
        end_time = datetime_time(16, 00)     # 16시 00분
        
        week_cond = today.weekday() == 5 # 토요일이면
        time_cond = start_time <= now_time <= end_time
        print("week_cond:", week_cond, "time_cond:",time_cond, "fdr:",all_fdr)
        if (week_cond and time_cond) or all_fdr :  # 토요일이면
                print("전체 데이터 fdr 작업중.....")
                _all_data_from_fdr()
                return
        
        data = Ohlcv.objects.first()
        if not data:
            print("백업파일이 없어 fdr로 전체 데이터 받기 시작합니다.")
            _all_data_from_fdr()
            return
        
        # if StockFunc.is_holiday():
        #     return
        
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        
        try:
            # 최근데이터 가져오기 . 랜덤으로 n개 마지막날짜 가져와서 가장 많은 날짜가 마지막인것으로 간주.
            # [ { 'ticker':'005940', 'last_date':datetime() } ....  ]
            last_dates = Ohlcv.objects.values("ticker").annotate(last_date=Max("Date"))
            # {'005930': date(), ....}
            last_dates = {item["ticker"]: item["last_date"] for item in last_dates}
            # 다운로드 받기 위한 일반적 최근 날짜 구함.
            counter = Counter(last_dates.values())
            last_exist_date = counter.most_common()[0][0]
            print(f"last date : {last_exist_date}")
            # 그날짜부터 오늘까지 date_list 생성 (비지니스데이)
            
            if start_date is not None: # start_date 넣을때만 작동.
                last_exist_date = pd.to_datetime(start_date)
            
            if end_date is not None:
                end_date = pd.to_datetime(start_date)
            else:
                end_date = pd.Timestamp.today().date()
                
            dates = pd.date_range(
                last_exist_date,end_date, freq="B"
            )  ## ohlcv존재하는지 아닌지 확인할때 사용하기.
            
            str_dates = [date.strftime("%Y%m%d") for date in dates]
            print(f"{str_dates} data downlaod....!")
            
            if (codes is not None) and (len(codes) <= 200):
                temp_today = pd.Timestamp.now().strftime('%Y-%m-%d')
                if not Ohlcv.objects.filter(Date__in=[temp_today]).exists(): ## 오늘날짜 없으면 전체 먼저 업데이트!
                    today_df = DBUpdater.update_ohlcv() 
                    
                    '''
                    ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Amount', 'Change','code']
                    '''
                ################### fdr 방식. ########################################
                print('fdr async 작동!')
                semaphore = asyncio.Semaphore(5) 
                async def async_fdr_datareader(semaphore, code, start_date):
                    async with semaphore:
                        result = await asyncio.to_thread(fdr.DataReader, code, start_date)
                        result['code'] = code
                        return result
                async def async_fdr_datareader_all(semaphore, codes, start_date):
                    tasks = [asyncio.create_task(async_fdr_datareader(semaphore, code, start_date)) for code in codes]
                    results = await asyncio.gather(*tasks)
                    df = pd.concat(results)
                    df.reset_index(inplace=True, names='Date')
                    return df
                concat_df = asyncio.run(async_fdr_datareader_all(semaphore, codes, str_dates[0]))  ## 장중에만 업데이트 해야함. 
                
                
            else:
                ########################### pystock #####################
                # 순환하면 데이터 가져오기.
                all_ls = [GetData.get_ohlcv_all_market(date) for date in str_dates]
                print(f"{str_dates} data downlaod complete! !")
                concat_df = pd.concat(all_ls)

            ## 새로받은데이터의 code 와 Date 정보 가져오기
            ticker_codes = concat_df["code"].unique()
            
            if len(concat_df):
                dates = concat_df["Date"].unique()
            else:
                print('concat_df', concat_df)
                return pd.DataFrame() 
        
            
            ###########################################################################
            
            ## 기존 데이터에 존재하는 ohlcv객체 검색
            existing_ohlcv = Ohlcv.objects.filter(
                ticker__code__in=ticker_codes,
                Date__in=dates,
            ).select_related("ticker")

            ## (date, code) : ticker_obj  형태로 딕셔너리 생성
            existing_ticker_dict = {
                ticker.code: ticker for ticker in Ticker.objects.all()
            }  # 존재하는 ticker

            existing_ohlcv_dict = {
                (ohlcv.Date, ohlcv.ticker): ohlcv for ohlcv in existing_ohlcv
            }  # 존재하는 날짜와 ticker에 의한 ohlcv객체

            ## code 별 최근데이터가 다른 종목들은 따로 작업해주기. 할필요있나.?
            print(f"{len(concat_df)} data setting...")
            to_create = []
            to_update = []

            for i, row in concat_df.iterrows():
                code = row["code"]
                date = row["Date"].date()
                if code in existing_ticker_dict.keys():  # ticker 객체가 존재하면.
                    ticker = existing_ticker_dict[code]
                    key = (date, ticker)

                    if key in existing_ohlcv_dict:
                        # 존재하면 update에 추가
                        ohlcv = existing_ohlcv_dict[key]
                        ohlcv.Open = row["Open"]
                        ohlcv.High = row["High"]
                        ohlcv.Low = row["Low"]
                        ohlcv.Close = row["Close"]
                        ohlcv.Volume = row["Volume"]
                        
                        if 'Change' in concat_df.columns:
                            ohlcv.Change = row["Change"]
                        if 'Amount' in concat_df.columns:
                            ohlcv.Amount = row["Amount"]

                        to_update.append(ohlcv)

                    else:
                        # 존재하지 않으면 create에 추가
                        ohlcv = Ohlcv(
                            ticker=ticker,
                            Date=date,
                            Open=row["Open"],
                            High=row["High"],
                            Low=row["Low"],
                            Close=row["Close"],
                            Volume=row["Volume"],
                            Change=row["Change"],
                        )
                        if 'Amount' in concat_df.columns:
                            ohlcv.Amount = row["Amount"] 
                        to_create.append(ohlcv)

            
            update_fileds = ["Open", "High", "Low", "Close", "Change", "Volume"]
            if 'Amount' in concat_df.columns:
                update_fileds += ['Amount']

            print("bulk_job start!")
            with transaction.atomic():
                # bulk_update
                if to_update:
                    Ohlcv.objects.bulk_update(to_update, update_fileds)
                    print(f"{len(to_update)} 개 데이터 update")
                # bulk_create
                if to_create:
                    Ohlcv.objects.bulk_create(to_create)
                    print(f"{len(to_create)} 개 데이터 create")

            print("bulk_job complete!")
            
            ## QuerySet Hint

            #### 코드 날짜로 데이터 가져오기
            ## col = ['date','open','high','low','close','volume']
            # col = [field.name for field in Ohlcv._meta.fields if not field.name in ['id','ticker']]
            # data = Ohlcv.objects.select_related('ticker').filter(
            #       ticker__code='005930', date__gt=the_date
            #   ).values(*col)
            # df = pd.DataFrame(data)

            ## ticker 에서 ohlcv데이터 가져오기
            # col = [field.name for field in Ohlcv._meta.fields if not field.name in ['id','ticker']]
            # ticker = Ticker.objects.first()
            # df = pd.DataFrame(ticker.ohlcv_set.values(*col))

            #### 특정일 (오늘) 양봉데이터만 받기.
            # the_date= pd.Timestamp().now().date()
            # the_data = Ohlcv.objects.filter(date='2024-09-27').select_related('ticker')
            concat_df = concat_df[concat_df['Date'] == concat_df['Date'].max()]
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} : update_ohlcv finished!!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                print('디스코드 메세지 전송 실패 update_ohlcv')
            return concat_df
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e} : update_ohlcv xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                print('디스코드 메세지 전송 실패 update_ohlcv')
                
        
    def update_basic_info(test_cnt: int = None, update_codes=None):

        print("====================================")
        print("update_basic_info running111111.......")
        print("====================================")
        # test_cnt = 100
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        # if StockFunc.is_holiday() and test_cnt is None:
        #     return
        total_cnt = 0
        split_cnt = 40 # 2500이라하면 대략 60개정도씩 나눠서작업함. 

        def save_data(**kwargs):
            print('kwargs',kwargs) 
            with transaction.atomic():
                # bulk_update
                for k, v in kwargs.items():
                    if k=="to_update_info":
                        if to_update_info:
                            Info.objects.bulk_update(
                                to_update_info, update_fileds_info, batch_size=1000
                            )
                            print(f"{len(to_update_info)} 개 데이터 update")
                    if k=="to_create_info":
                        # bulk_create
                        if to_create_info:
                            Info.objects.bulk_create(to_create_info, batch_size=1000)
                            print(f"{len(to_create_info)} 개 데이터 create")
                    
                    if k=="to_update_brokerinfo":
                        # BrokerTrader
                        if to_update_brokerinfo:
                            BrokerTrading.objects.bulk_update(
                                to_update_brokerinfo, update_fileds_brokertrading, batch_size=1000
                            )
                            print(f"{len(to_update_brokerinfo)} 개 데이터 broker_trading update")
                    # bulk_create
                    if k=="to_create_brokerinfo":
                        if to_create_brokerinfo:
                            BrokerTrading.objects.bulk_create(to_create_brokerinfo, batch_size=1000)
                            print(f"{len(to_create_brokerinfo)} 개 데이터 broker_trading create")

                    # Finstats
                    if k=="to_update_fin":
                        if to_update_fin:
                            Finstats.objects.bulk_update(
                                to_update_fin, update_fileds_fin, batch_size=1000
                            )
                            print(f"{len(to_update_fin)} 개 데이터 fin update")
                    # bulk_create
                    if k=="to_create_fin":
                        if to_create_fin:
                            Finstats.objects.bulk_create(to_create_fin, batch_size=1000)
                            print(f"{len(to_create_fin)} 개 데이터 fin create")

                    # changedlog_models bulk_create 구간.
                    if k=="changedlog_models":
                        if changedlog_models:
                            print(f"changedlog_models count : {len(changedlog_models)}")
                            ChangeLog.objects.bulk_create(changedlog_models)
                            print("changedlog_models bulk_create succeed!! ")
        
        try:
            if update_codes is None:
                update_codes = []
            ticker_qs = Ticker.objects.values_list("code", "name")
            if update_codes:
                ticker_qs = ticker_qs.filter(code__in=update_codes)

            if test_cnt:
                ticker_qs = random.sample(list(ticker_qs), test_cnt)
            else:
                ticker_qs = list(ticker_qs)
            print(f"test_cnt = {test_cnt}")

            ## data download
            
            split_data = Sean_func._split_data(ticker_qs, split_cnt) ## split_cnt 번 나눠서 작업
            print(split_data)
            for splited_data in split_data:
                new_datas = asyncio.run(GetData._get_info_all_async(splited_data))
                total_cnt += len(new_datas)
                
                # ################################################################
                # try:
                #     with open('./basic_info_pickle.pkl' , 'wb') as f:
                #         pickle.dump(new_datas, f, protocol=pickle.HIGHEST_PROTOCOL)
                #         print('./basic_info_pickle.pkl 로 임시저장완료')
                # except:
                #     pass
                # #################################################################

                # with open("./basic_info_pickle.pkl", "rb") as f:
                #     print('pickle 데이터로 작업 시작! ')
                #     new_datas = pickle.load(f)

                changedlog_models = []

                ## 새로운데이터에서 code 정보
                new_data_codes = [
                    infodic.get("code") for infodic, _, _ in new_datas if infodic.get("code")
                ]

                ## 존재하는 tickers 객체들
                existing_ticker_dict = {ticker.code: ticker for ticker in Ticker.objects.all()}

                ## 존재하는 Info객체들.  #########################################################################
                existing_info_dict = {
                    info.ticker.code: info
                    for info in Info.objects.filter(
                        ticker__code__in=new_data_codes
                    ).select_related("ticker")
                }
                to_create_info = []
                to_update_info = []
                update_fileds_info = [
                    field.name
                    for field in Info._meta.get_fields()
                    if not field.name in ["id", "ticker"]
                ]
                #############################################################################################

                ## 존재하는 Brokertrading.  #########################################################################
                existing_brokertrading_dict = {
                    (broker.ticker.code, broker.date, broker.broker_name): broker
                    for broker in BrokerTrading.objects.filter(
                        ticker__code__in=new_data_codes
                    ).select_related("ticker")
                }
                to_create_brokerinfo = []
                to_update_brokerinfo = []
                update_fileds_brokertrading = [
                    field.name
                    for field in BrokerTrading._meta.get_fields()
                    if not field.name in ["id", "ticker", "date", "broker_name"]
                ]
                #############################################################################################

                ## 존재하는 Finstats  #########################################################################
                existing_fin_dict = {
                    (fin.ticker.code, fin.fintype, fin.year, fin.quarter): fin
                    for fin in Finstats.objects.filter(
                        ticker__code__in=new_data_codes
                    ).select_related("ticker")
                }
                to_create_fin = []
                to_update_fin = []
                update_fileds_fin = [
                    field.name
                    for field in Finstats._meta.get_fields()
                    if not field.name in ["id", "ticker", "year", "quarter", "fintype"]
                ]
                #############################################################################################

                ## 전체데이터 순환구간.
                print("데이터베이스 작업..")

                for infodic, traderinfo, finstats in new_datas:
                    code = infodic.get("code")
                    if code:
                        ticker = existing_ticker_dict[code]

                        ## infodic 처리구간. ##############################33333333333333
                        if code in existing_info_dict:
                            ## update
                            info = existing_info_dict[code]
                            for field, new_value in infodic.items():
                                if hasattr(info, field):
                                    setattr(info, field, new_value)
                            to_update_info.append(info)

                            ## 변경사항 조회
                            changes = info.tracker.changed()
                            if changes:
                                for field, old_value in changes.items():
                                    if isinstance(old_value, (int, float)):
                                        changedlog_model = ChangeLog(
                                            ticker=ticker,
                                            change_field=field,
                                            old_value=old_value,
                                            new_value=getattr(info, field),
                                        )
                                        changedlog_models.append(
                                            changedlog_model
                                        )  ## changedlog_models 추가

                        else:
                            info = Info(
                                ticker=ticker,
                            )
                            for field, new_value in infodic.items():
                                if hasattr(info, field):
                                    setattr(info, field, new_value)
                            to_create_info.append(info)

                        # ### traderinfo 처리구간333333333333333333333333333333333333333
                        # 구분 = infodic['구분']
                        today = infodic.get("date")
                        today = pd.Timestamp.now().date() if not today else today.date()
                        if len(traderinfo):
                            for broker, new_values in traderinfo.items():
                                if not isinstance(
                                    broker, str
                                ):  ## broker 가 없는경우 nan값으로 들어와서 패싱함.
                                    continue

                                key = (code, today, broker)
                                if key in existing_brokertrading_dict:
                                    brokertrading = existing_brokertrading_dict[key]
                                    ## update
                                    for item, value in new_values.items():
                                        if hasattr(brokertrading, item):
                                            setattr(brokertrading, item, value)
                                    to_update_brokerinfo.append(brokertrading)

                                else:
                                    # create
                                    brokertrading = BrokerTrading(
                                        ticker=ticker,
                                        date=today,
                                        broker_name=broker,
                                        sell=new_values["sell"],
                                        buy=new_values["buy"],
                                    )
                                    to_create_brokerinfo.append(brokertrading)

                        # ### finstats 처리구간
                        ## 지난연도데이터를 스킵할 필요가 있음.    아니면 change 목록을 넓히고 change된것만 update로 넘기기.
                        for fintype, datas1 in finstats.items():
                            for p, data in datas1.items():
                                year = p.split("/")[0]
                                quarter = p.split("/")[-1]
                                quarter = 0 if year == quarter else int(int(quarter))
                                year = int(year)

                                key = (code, fintype, year, quarter)

                                if (
                                    key in existing_fin_dict
                                ):  # = {(fin.ticker.code, fin.fintype, fin.year, fin.quarter)
                                    # update
                                    fin = existing_fin_dict[key]
                                    for field, new_value in data.items():
                                        if hasattr(fin, field):
                                            setattr(fin, field, new_value)

                                    ## 변경사항 체크.
                                    changes = fin.tracker.changed()
                                    if changes:
                                        to_update_fin.append(fin)
                                        for field, old_value in changes.items():
                                            if isinstance(old_value, (int, float)):
                                                gb = f"{year}{quarter}"
                                                changedlog_model = ChangeLog(
                                                    ticker=ticker,
                                                    change_field=field,
                                                    gb=gb,
                                                    old_value=old_value,
                                                    new_value=getattr(fin, field),
                                                )
                                                changedlog_models.append(changedlog_model)

                                else:
                                    # create
                                    fin = Finstats(
                                        ticker=ticker,
                                        fintype=fintype,
                                        year=year,
                                        quarter=quarter,
                                    )
                                    for field, new_value in data.items():
                                        if field in update_fileds_fin:
                                            if hasattr(fin, field):
                                                setattr(fin, field, new_value)
                                    to_create_fin.append(fin)
                        
                        # if len(to_create_fin) >= split_cnt or len(to_update_fin) >= split_cnt:
                        #     total_cnt += len(to_create_fin)
                        #     total_cnt += len(to_update_fin)
                        #     print(f'현재 총 {total_cnt} 번째 데이터 저장중.')
                        #     print("bulk job start!! ")
                        #     save_data(to_create_fin=to_create_fin, to_update_fin=to_update_fin,
                        #             to_create_info=to_create_info, to_update_info=to_update_info,
                        #                 to_create_brokerinfo=to_create_brokerinfo, to_update_brokerinfo=to_update_brokerinfo,
                        #             changedlog_models=changedlog_models)
                        #     to_create_fin = []
                        #     to_update_fin = []
                        #     to_create_info = []
                        #     to_update_info = []
                        #     to_create_brokerinfo = []
                        #     to_update_brokerinfo = []
                        #     changedlog_models = []
                            
                        # if len(to_create_fin) > 0 or len(to_update_fin) > 0:
                        #     total_cnt += len(to_create_fin)
                        #     total_cnt += len(to_update_fin)
                        #     print(f'현재 총 {total_cnt} 번째 데이터 저장중.')
                        #     print('데이터 저장')
                        #     save_data(to_create_fin=to_create_fin, to_update_fin=to_update_fin,
                        #             to_create_info=to_create_info, to_update_info=to_update_info,
                        #                 to_create_brokerinfo=to_create_brokerinfo, to_update_brokerinfo=to_update_brokerinfo,
                        #             changedlog_models=changedlog_models)
                        #     print("bulk_job complete!")
                ### 저장 구간
                #
                
                
                with transaction.atomic():
                    # bulk_update
                    print(f'{total_cnt} 개째 데이터 저장중.')
                    if to_update_info:
                        Info.objects.bulk_update(
                            to_update_info, update_fileds_info, batch_size=1000
                        )
                        print(f"{len(to_update_info)} 개 데이터 update")
                    # bulk_create
                    if to_create_info:
                        Info.objects.bulk_create(to_create_info, batch_size=1000)
                        print(f"{len(to_create_info)} 개 데이터 create")

                    # BrokerTrader
                    if to_update_brokerinfo:
                        BrokerTrading.objects.bulk_update(
                            to_update_brokerinfo, update_fileds_brokertrading, batch_size=1000
                        )
                        print(f"{len(to_update_brokerinfo)} 개 데이터 broker_trading update")
                    # bulk_create
                    if to_create_brokerinfo:
                        BrokerTrading.objects.bulk_create(to_create_brokerinfo, batch_size=1000)
                        print(f"{len(to_create_brokerinfo)} 개 데이터 broker_trading create")

                    # Finstats
                    if to_update_fin:
                        Finstats.objects.bulk_update(
                            to_update_fin, update_fileds_fin, batch_size=1000
                        )
                        print(f"{len(to_update_fin)} 개 데이터 fin update")
                    # bulk_create
                    if to_create_fin:
                        Finstats.objects.bulk_create(to_create_fin, batch_size=1000)
                        print(f"{len(to_create_fin)} 개 데이터 fin create")

                    # changedlog_models bulk_create 구간.
                    print(f"changedlog_models count : {len(changedlog_models)}")
                    if changedlog_models:
                        ChangeLog.objects.bulk_create(changedlog_models)
                        print("changedlog_models bulk_create succeed!! ")
                    
                    
                    # 메모리 초기화
                    to_create_fin = []
                    to_update_fin = []
                    to_create_info = []
                    to_update_info = []
                    to_create_brokerinfo = []
                    to_update_brokerinfo = []
                    changedlog_models = []
                        
                        
            # print("bulk_job complete!")
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} : {total_cnt}개종목 update_basic_info finished!!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e}: update_basic_info xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
             
    def update_investor():
        # if StockFunc.is_holiday():
        #     return
        
        print("====================================")
        print("update_investor running.......")
        print("====================================")

        def get_etf_data(str_date=None):
            '''
            레버리지와 인버스 데이터
            '''
            if str_date is None:
                return
            new_data = []
            for code, name in [("122630",'kodex 레버리지'), ("252670",'KODEX 200선물인버스2X')]:
                df = pystock.get_etf_trading_volume_and_value(str_date, str_date, code)
                df['code'] = code
                df['종목명'] = name
                df['날짜'] = str_date
                df.index.name = '투자자'
                df = df.reset_index()
                df.columns = [''.join(col[::-1]) for col in df.columns]
                new_data.append(df)
            result_new_df = pd.concat(new_data)
            result_new_df['날짜'] = pd.to_datetime(result_new_df['날짜'])
            return result_new_df
        
        
        def csv_data_generator(file_path):
            with open(file_path, mode="r", encoding="utf-8") as file:
                reader = csv.DictReader(file)
                for row in reader:
                    yield row

        def records_to_db(records: Iterable[Dict]) -> None:
            """
            records : [ {'code':'', '종목명':'', '매도거래량': 33, ...}, .....   ]  []
            """
            tickers_dict = {ticker.code: ticker for ticker in Ticker.objects.all()}
            to_create_investor = []
            new_tickers = []
            for i, row in enumerate(records):
                code = row["code"]
                if code in tickers_dict:
                    # ticker 가져오기
                    ticker = tickers_dict.get(row["code"])
                else:
                    # ticker 새로생성
                    ticker = Ticker(
                        code=code,
                        # name=codes_in_new_datas_dict[code],
                        name=row["종목명"],
                    )
                    print(f"{code}, {row['종목명']} ticker 새로 생성")
                    new_tickers.append(ticker)
                    tickers_dict[code] = (
                        ticker  # 새로만든 ticker도 tickers_dict에 넣어줘야 위에서 다시 만들지 않는다.
                    )

                investor_obj = InvestorTrading(
                    ticker=ticker,
                    날짜=pd.to_datetime(row["날짜"]).date(),
                    투자자=row["투자자"],
                    매도거래량=row["매도거래량"],
                    매수거래량=row["매수거래량"],
                    매도거래대금=row["매도거래대금"],
                    매수거래대금=row["매수거래대금"],
                )
                to_create_investor.append(investor_obj)

                # 일정 개수 이상일 때 bulk_create()로 한 번에 저장
                bulk_cnt = 10000
                if len(to_create_investor) >= bulk_cnt:
                    print(f"{i} --{bulk_cnt}개 bulk_create중....")
                    if new_tickers:
                        print(f"새로운 ticker정보 {len(new_tickers)}개 저장!")
                        Ticker.objects.bulk_create(new_tickers)
                        new_tickers = []
                    InvestorTrading.objects.bulk_create(
                        to_create_investor, batch_size=2000
                    )
                    to_create_investor = []  # 저장 후 리스트 초기화

            # 남은 객체들도 저장
            if to_create_investor:
                print("마지막데이터 bulk_create중....")
                if new_tickers:
                    print(f"새로운 ticker정보 {len(new_tickers)}개 저장!")
                    Ticker.objects.bulk_create(new_tickers)
                    new_tickers = []
                InvestorTrading.objects.bulk_create(to_create_investor)
                to_create_investor = []
        
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        try:
            data = InvestorTrading.objects.last()
            if not data:
                print(
                    "데이터가 없어 백업파일 가져오기만 시도합니다."
                )  ## 데이터가 없기때문에 모두 create이다. 제너레이터로 bulk_create 사용하기.
                backup_file_name = "investor.csv"
                fn = Path(settings.BASE_DIR) / backup_file_name
                if os.path.exists(fn):
                    data_gen = csv_data_generator(backup_file_name)
                    records_to_db(data_gen)
                    print("데이터 복원완료!")
                    return
                else:
                    print('백업 데이터를 찾지 못함.')
            if not data:
                last_exist_date = pd.Timestamp.now() - pd.Timedelta(days=200)
                print(f'{last_exist_date} 부터 데이터 전체 다운로드')
            else:
                # update 하기
                latest_dates = (
                    InvestorTrading.objects.values("ticker_id")
                    .annotate(latest_date=Max("날짜"))
                    .order_by("?")[:10]
                )
                latest_dates_list = list(latest_dates.values_list("latest_date", flat=True))
                counter = Counter(latest_dates_list)
                last_exist_date = counter.most_common()[0][0]
            
            print(f"last date : {last_exist_date}")

            # 그날짜부터 오늘까지 date_list 생성 (비지니스데이)
            dates = pd.date_range(last_exist_date, pd.Timestamp.today().date(), freq="B")
            dates = dates[1:]  # 마지막일 제외. 어차피 확정인 자료임. 업데이트는 의미없다.

            if len(dates):
                def split_list(lst, n):
                    """리스트를 n개씩 나누는 함수"""
                    return [lst[i:i + n] for i in range(0, len(lst), n)]
                # 데이터 받기
                split_str_dates = [date.strftime("%Y%m%d") for date in dates]
                print("split_str_dates: ", split_str_dates)
                for str_dates in split_list(split_str_dates, 20): # 20 개씩 나눠서 작업. 
                    print(str_dates , '작업중..')
                    result = asyncio.run(GetData._get_investor_all_async(str_dates))
                    dates_downloaded = result["날짜"].unique()

                    etf = get_etf_data(str_dates)
                    result = pd.concat([result, etf])
                    
                    records = result.to_dict("records")
                    print(f"dates downloaded {dates_downloaded}")
                    # 저장하기.
                    records_to_db(records=records)
                    print('5초후 다음작업..')
                    time.sleep(5)

            # ## 최종적으로 특정날짜 이전 데이터 제거하기.
            n = 365 * 2
            the_date = pd.Timestamp.now().date() - pd.Timedelta(days=n)
            qs = InvestorTrading.objects.filter(날짜__lt=the_date)
            
            if qs.exists():
                print('오래된 데이터 삭제합니다.! ')
                qs.delete()
            
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} : update_investor finished!!"       
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e}: update_investor xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
            
        #### 코드 날짜로 데이터 가져오기
        # col = ['date','open','high','low','close','volume']
        # data = Ohlcv.objects.select_related('ticker').filter(
        #       ticker__code='005930', date__gt=the_date
        #   ).values(*col)
        # df = pd.DataFrame(data)

        #### 특정일 (오늘) 양봉데이터만 받기.
        # the_date= pd.Timestamp().now().date()
        # the_data = Ohlcv.objects.filter(date='2024-09-27').select_related('ticker')

    def update_issue(date_cnt=1, test=False):
        """
        추가 작업을 해야하기때문에 날짜데이터로 가져온데이터에서 어느정도 추출해야함. 
        1시간마다 실행. !
        date_cnt=1 그날 데이터만 취급
        가져온 데이터의 맨 위. 가장 최근일.
        """
        if not Iss.objects.exists():
            print("처음 데이터 받기 시작합니다.")
            date_cnt = 500
     
        print("====================================")
        print("update_issue running.......")
        print("====================================")
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        try:
            iss_df = GetData.get_iss_list()  # 전체 데이터 받기.

            valid_dates = iss_df["regdate"].unique()[
                :date_cnt
            ]  # 가져올 날짜 리스트( 최근일 또는 오늘)
            
            latest_df = iss_df.loc[
                iss_df["regdate"].isin(valid_dates)
            ]  # 최근 데이터만 추출

            latest_dict_list = latest_df.to_dict("records")

            print(f"{len(latest_dict_list)} 개 데이터 받음.")

            # 기존데이터가 있는지 확인하기. 없는 데이터만 작업하기.
            new_text = [item["hl_str"] for item in latest_dict_list]
            existing_hl_str = Iss.objects.filter(hl_str__in=new_text).values_list(
                "hl_str", flat=True
            )
            
            duplicate_urls = set(existing_hl_str) & set(new_text)
            new_unique_urls = set(new_text) - duplicate_urls

            new_dict_list = [
                item for item in latest_dict_list if item["hl_str"] in new_unique_urls
            ]


            if not new_dict_list:
                print("새로운 데이터가 없습니다.")
                return None
            print(f"{len(new_dict_list)}개의 새로운 데이터가 있습니다.")
            # # 데이터 업데이트
            if test:
                new_dict_list = new_dict_list[:1]
            for dic in new_dict_list:
                print(dic["hl_str"])
                new_dict = GetData.get_iss_from_number(dic["issn"])
                related_df = GetData.get_iss_related(dic["issn"])
                dic.update(new_dict)
                dic["ralated_codes"] = list(related_df["code"])
                time.sleep(1)

            # new_dict_list 데이터 저장하기.
            # related_codes 는 tickers.add()처리하고 나머지 데이터만 저장하기.
            for dic in new_dict_list:
                related = dic.pop("ralated_codes", [])
                iss = Iss(**dic)
                # iss = Iss(
                #     issn=dic["issn"],
                #     hl_str=dic["hl_str"],
                #     regdate=dic["regdate"],
                #     ralated_code_names=dic["ralated_code_names"],
                #     hl_cont_text=dic["hl_cont_text"],
                #     hl_cont_url=dic["hl_cont_url"],
                # )
                try:
                    iss.save()
                    print("saving..", dic["hl_str"][:10])
                    if related:
                        iss.tickers.set(related)
                        print("tickers set ok!")
                    if dic["hl_str"] : # 특정단어 포함한다면.
                        print("메세지보내기.")
                    print(dic)
                
                except Exception as e:
                    print(e, dic)
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} : update_issue finished!!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
            return latest_dict_list
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e}: update_issue xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
        
    def update_theme_upjong():
        """
        데이터 가져와서 저장하기.
        """
        print("====================================")
        print("update_theme_upjong running.......")
        print("====================================")
        
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        
        try:
            ## 실제데이터 다운로드
            
            theme_data, upjong_data = asyncio.run(GetData.get_all_upjong_theme())

            # 존재하는 ticker 객체 가져오기
            existing_tickers_dict = {ticker.code: ticker for ticker in Ticker.objects.all()}
            # 존재하는 theme 객체 가져오기.
            existing_theme_dict = {theme.name: theme for theme in Theme.objects.all()}

            theme_df = pd.DataFrame(theme_data)
            ## 새로운 테마 있으면 저장.
            new_themes = [
                Theme(name=name)
                for name in theme_df["name"].unique()
                if name not in existing_theme_dict
            ]
            if new_themes:
                Theme.objects.bulk_create(new_themes)

            ## 관계설정.
            existing_theme_dict = {
                theme.name: theme
                for theme in Theme.objects.prefetch_related("tickers").all()
            }
            codes_by_name = (
                theme_df.groupby("name")["code"]
                .apply(list)
                .reset_index()
                .to_dict("records")
            )
            for dic in codes_by_name:
                theme_name = dic["name"]
                theme_codes = dic["code"]
                theme = existing_theme_dict[theme_name]
                theme_code_obj_set = {
                    existing_tickers_dict[code]
                    for code in theme_codes
                    if code in existing_tickers_dict
                }
                ## 변경사항 추적
                pre_tickers_obj = set(theme.tickers.all())
                add_obj_set = theme_code_obj_set - pre_tickers_obj
                remove_obj_set = pre_tickers_obj - theme_code_obj_set
                if add_obj_set or remove_obj_set:
                    print("=========== 변경사항 발생 ==================")
                    print(f"{add_obj_set} 추가")
                    print(f"{remove_obj_set} 추가")
                    print("=========================================")
                    theme.tickers.set(theme_code_obj_set)

            ## ThemeDetail 저장.
            # 전체 데이터 순환하면서 존재하는 데이터 모두 업데이트하기.
            existing_details = {
                f"{detail.ticker.code}_{detail.theme.name}": detail
                for detail in ThemeDetail.objects.prefetch_related("ticker")
                .prefetch_related("theme")
                .all()
            }
            existing_theme_dict = {theme.name: theme for theme in Theme.objects.all()}

            update_theme_details = []
            create_theme_details = []
            for theme_item in theme_data:
                name = theme_item["name"]
                code = theme_item["code"]

                key_name = f"{code}_{name}"
                if key_name in existing_details:
                    # update
                    detail = existing_details.get(key_name)
                    if detail.description != theme_item["theme_text"]:
                        detail.description = theme_item["theme_text"]
                        update_theme_details.append(detail)
                else:
                    if (
                        code in existing_tickers_dict
                    ):  # 기본티커 정보가 잇어야 저장할수 있음.
                        ticker = existing_tickers_dict.get(code)
                        ## theme 가 없는 상황이라 만들어야함. ?

                        theme = Theme.objects.create(ticker=ticker, name=name)
                        detail = ThemeDetail(
                            ticker=ticker, theme=theme, description=theme["theme_text"]
                        )
                        create_theme_details.append(detail)

            # 지우고 그냥 새로 저장
            if create_theme_details:
                print(f"{len(create_theme_details)}개 create 저장")
                ThemeDetail.objects.bulk_create(create_theme_details)
            if update_theme_details:
                print(f"{len(update_theme_details)}개 update 저장")
                ThemeDetail.objects.bulk_update(update_theme_details, ["description"])

            ## 업종
            # 존재하는 ticker 객체 가져오기
            existing_tickers_dict = {ticker.code: ticker for ticker in Ticker.objects.all()}
            # 존재하는 theme 객체 가져오기.
            existing_upjong_dict = {upjong.name: upjong for upjong in Upjong.objects.all()}

            upjong_df = pd.DataFrame(upjong_data)
            ## 새로운 테마 있으면 저장.
            new_upjongs = [
                Upjong(name=name)
                for name in upjong_df["name"].unique()
                if name not in existing_upjong_dict
            ]
            if new_upjongs:
                Upjong.objects.bulk_create(new_upjongs)

            ## upjong에 속한 종목들 지정하기.
            ## 관계설정.
            existing_upjong_dict = {
                upjong.name: upjong
                for upjong in Upjong.objects.prefetch_related("tickers").all()
            }
            codes_by_name = (
                upjong_df.groupby("name")["code"]
                .apply(list)
                .reset_index()
                .to_dict("records")
            )
            for dic in codes_by_name:
                upjong_name = dic["name"]
                upjong_codes = dic["code"]
                upjong = existing_upjong_dict[upjong_name]
                upjong_code_obj_set = {
                    existing_tickers_dict[code]
                    for code in upjong_codes
                    if code in existing_tickers_dict
                }
                ## 변경사항 추적
                pre_tickers_obj = set(upjong.tickers.all())
                add_obj_set = upjong_code_obj_set - pre_tickers_obj
                remove_obj_set = pre_tickers_obj - upjong_code_obj_set
                if add_obj_set or remove_obj_set:
                    print("=========== 변경사항 발생 ==================")
                    print(f"{add_obj_set} 추가")
                    print(f"{remove_obj_set} 추가")
                    print("=========================================")
                    upjong.tickers.set(upjong_code_obj_set)
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} : update_theme_upjong finished!!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e}: update_theme_upjong xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            

    def update_stockplus_news():
        '''
        unique_together = ('title', 'date')  방식사용.
        '''
        print("====================================")
        print("update_stockplus running.......")
        
        print("====================================")
        
        start_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        dup_cnt = 0
        try:
            datas = asyncio.run(GetData._get_news_from_stockplus_today())
            ## test
            print('다운로드 데이터 : ', len(datas))
            if not datas:
                print("데이터 크롤링 실패")
                return {}
            
            for data in datas:
                # 뉴스 객체 만듬. 
                news = News(
                        no=data["no"],
                        title=data["title"],
                        createdAt=data["createdAt"],
                        writerName=data["writerName"],
                    )
                try:
                    news.save()
                    if data["relatedStocks"]:
                        news.tickers.set(data["relatedStocks"])
                    
                    if data['title'] == '특정 title':
                        ## 메세지 보내기.
                        pass
                    print(data['title'], '저장완료')
                except Exception as e:
                    dup_cnt +=1
                    
            print(f"중복된 데이터 {dup_cnt} / {len(datas)}개 ")
            
        except Exception as e:
            end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
            msg_text = f"{start_time} ~ {end_time} {e}: update_stockplus_news xxxxxx !!"
            try:
                asyncio.run(mydiscord.send_message(msg_text))
            except:
                pass
            
    def anal_all_stock(anal=True, test=False, update_codes:list = None):
        
        # if StockFunc.is_holiday() and not test:
        #     return

        try:
            asyncio.run(mydiscord.send_message(f"anal ChartValue start!!!"))
        except:
            pass
        
        start_time = pd.Timestamp.now(tz='Asia/Seoul').strftime('%Y-%m-%d %H:%M')
        today = pd.Timestamp.now(tz='Asia/Seoul')
        
        
        def convert_to_python_type(chartobjects_list):
            for obj in chartobjects_list:
                for field in obj._meta.fields:
                    value = getattr(obj, field.name)
                    
                    # numpy.bool_ -> Python bool 변환
                    if isinstance(value, np.bool_):
                        setattr(obj, field.name, bool(value))
                    # numpy 배열 처리
                    elif isinstance(value, np.ndarray):
                        if value.size == 0:
                            setattr(obj, field.name, None)
                        else:
                            try:
                                converted = value.item() if value.size == 1 else value.tolist()
                                setattr(obj, field.name, converted)
                            except:
                                setattr(obj, field.name, None)
                    # numpy.float64 -> Python float 변환
                    elif isinstance(value, np.float64):
                        if np.isnan(value):
                            setattr(obj, field.name, None)
                        else:
                            setattr(obj, field.name, float(value))
                    # numpy.int64 -> Python int 변환
                    elif isinstance(value, np.int64):
                        setattr(obj, field.name, int(value))
            return chartobjects_list

        def _create_and_update(to_create, to_update, update_fields):
            with transaction.atomic():
                if to_update:
                    to_update = convert_to_python_type(to_update)
                    ChartValue.objects.bulk_update(to_update, update_fields)
                    print(f"updated 완료 {len(to_update)} ")
                    print(to_update)

                if to_create:
                    to_create = convert_to_python_type(to_create)
                    try:                            
                        ChartValue.objects.bulk_create(to_create)
                        print(f"created 완료 {len(to_create)} ")
                        print(to_create)
                    except Exception as e:
                        print(e)
                        print(to_create)
                        print("bulk_create 실패")
            print(f"updated : {len(to_update)} created : {len(to_create)}")
        
        # 전체 분석해서 저장하기. Chartvalues()
        '''codes ['code','code',...]'''
        from api.utils.chart import Chart
        if not test:
            today_df = DBUpdater.update_ohlcv()
        
        anal_err_count = 0 
        stock_err_count = 0
        
        check_y1, check_y2 = ElseInfo.check_y_future
        check_q = ElseInfo.check_q_current[-1]
        all_cnt = 0
        exist_qs_dict = {item.ticker.code : item for item in ChartValue.objects.all()}
        to_create=[]
        to_update=[]

        update_fields = [field.name for field in ChartValue._meta.get_fields() if not isinstance(field, models.OneToOneField) ]
        update_fields = [field for field in update_fields if field !='id']
        
        codes = DBUpdater.update_ticker()
        print(f"{len(codes)} 개 작업중! ")
        if test:
            ## 특정종목 이후부터 다시 작업할때 ..
            # 종목명 = '라닉스'
            # index = next((i for i, item in enumerate(codes) if item['name'] == 종목명),None)
            # codes = codes[index:]
            
            # 몇개만 랜덤으로 테스트할때. 
            test_cnt = 10
            codes = random.sample(codes, test_cnt)
        if update_codes is not None:
            codes = [item for item in codes if item['code'] in update_codes]
        
        for item in codes:
            try:
                stock = Stock(item['code'], anal=anal)
                print(f"{stock.ticker.name} 작업중..")
            except Exception as e:
                print(e, item['name'])
                stock_err_count += 1
                continue
            if len(stock.chart_d.df) < 10:
                stock_err_count += 1
                continue
                
            
            
            info_dic = {}
            try:
                info_dic['ticker'] = stock.ticker
                info_dic['date'] = today
                info_dic['cur_close'] = stock.chart_d.df.Close.iloc[-1]
                info_dic['cur_open'] = stock.chart_d.df.Open.iloc[-1]
                try:
                    info_dic['pre_close'] = stock.chart_d.df.Close.iloc[-2]
                    info_dic['pre_open'] = stock.chart_d.df.Open.iloc[-2]
                except:
                    info_dic['pre_close'] = 0
                    info_dic['pre_open'] = 0

                info_dic['유보율'] = stock.유보율
                info_dic['부채비율'] = stock.부채비율
                info_dic['액면가'] = stock.액면가
                info_dic['cash_value'] = stock.현금가
                info_dic['EPS'] = stock.info.EPS
                info_dic['상장주식수'] = stock.상장주식수
                info_dic['유동주식수'] = stock.유동주식수
                info_dic['매물대1'] = stock.chart_d.pricelevel.first
                info_dic['매물대2'] = stock.chart_d.pricelevel.second
                info_dic['신규상장'] = stock.is_new_listing()
                try:
                    info_dic['cur_vol'] = stock.chart_d.volume.data.iloc[-1]
                except:
                    info_dic['cur_vol'] = None
                try:
                    info_dic['pre_vol'] = stock.chart_d.volume.data.iloc[-2]
                except:
                    info_dic['pre_vol'] = None
                try:
                    info_dic['vol20'] = stock.chart_d.volume.ma_vol.iloc[-1]
                except:
                    info_dic['vol20'] = None
                
                info_dic['reasons'] = stock.reasons
                info_dic['reasons_30'] = stock.reasons_30
                info_dic['good_buy'] = stock.is_good_buy()
                if isinstance(stock.fin_df, pd.DataFrame):
                    df_y = stock.fin_df.set_index('year')
                    info_dic["growth_y1"] = df_y.loc[int(check_y1), 'growth'] if int(check_y1) in df_y.index else None 
                    info_dic['growth_y2'] = df_y.loc[int(check_y2), 'growth'] if int(check_y2) in df_y.index else None 
                if isinstance(stock.fin_df_q, pd.DataFrame):
                    df_q = stock.fin_df_q
                    info_dic['growth_q'] = df_q.loc[check_q, 'yoy'] if check_q in df_q.index else None 

                bb_texts = ['bb60','bb240']
                for chart_name in ['chart_d','chart_30','chart_5']:
                    try:
                        if hasattr(stock, chart_name):
                            chart : Chart = getattr(stock, chart_name)
                            if hasattr(chart, 'volume'):
                                volume = getattr(chart, 'volume')
                                try:
                                    info_dic[f'{chart_name}_vol20'] = volume.ma_vol.iloc[-1]
                                except:
                                    info_dic[f'{chart_name}_vol20'] = None
                                
                            for bb_text in bb_texts:
                                if hasattr(chart, bb_text):
                                    bb = getattr(chart, bb_text)
                                    info_dic[f"{chart_name}_{bb_text}_upper20"] = bb.upper_inclination20 if hasattr(bb, "upper_inclination20") else None
                                    info_dic[f"{chart_name}_{bb_text}_upper10"] = bb.upper_inclination10 if hasattr(bb, "upper_inclination10") else None
                                    info_dic[f"{chart_name}_{bb_text}_upper"] = bb.cur_upper_value if hasattr(bb, "cur_upper_value") else None
                                    info_dic[f"{chart_name}_{bb_text}_width"] = bb.cur_width if hasattr(bb, "cur_width") else None

                            if hasattr(chart, 'sun'):
                                sun = getattr(chart, 'sun')
                                info_dic[f"{chart_name}_sun_width"] = chart.sun.width if hasattr(sun, 'width') else None
                                info_dic[f"{chart_name}_sun_max"] = chart.sun.cur_max_value if hasattr(sun, 'cur_max_value') else None
                            info_dic[f"{chart_name}_new_phase"] = chart.is_new_phase()
                            info_dic[f"{chart_name}_ab"] = chart.is_ab(ma=20) if hasattr(chart, f'ma{20}') else None
                            info_dic[f"{chart_name}_ab_v"] = chart.is_ab_volume()
                            info_dic[f"{chart_name}_good_array"] = chart.is_good_array()
                            info_dic[f"{chart_name}_bad_array"] = chart.is_bad_array()
                            
                            
                    except Exception as e:
                        anal_err_count += 1
                        try:
                            asyncio.run(mydiscord.send_message(f"{stock.ticker.name} 분석오류!  {e}"))
                        except:
                            pass
                        continue

                    
                    

                if item['code'] in exist_qs_dict:
                    
                    chartvalue = exist_qs_dict.get(item['code'])
                    for field in update_fields:
                        setattr(chartvalue, f"{field}", info_dic.get(f"{field}"))
                    to_update.append(chartvalue)
                else:
                    chartvalue = ChartValue(**info_dic)
                    print('create에 추가합니다.')
                    to_create.append(chartvalue)
            except Exception as e:
                anal_err_count += 1
                print(f"{stock.ticker.name} 분석오류 객체오류!  {e}")
            

            if (len(to_create) + len(to_update)) > 50:
                _create_and_update(to_create, to_update, update_fields)
                to_create=[]
                to_update=[]
                
        if (len(to_create) + len(to_update)) > 0:
            _create_and_update(to_create, to_update, update_fields)
        
        print('정보수집종목개수: ',  len(to_create))
        
            
        end_time = pd.Timestamp.now().strftime('%Y-%m-%d %H:%M')
        msg_text = f"{start_time} ~ {end_time} : anal ChartValue finished!! 분석오류:{anal_err_count} 객체오류:{stock_err_count}"
        try:
            asyncio.run(mydiscord.send_message(msg_text))
        except:
            pass
        
        
        return to_create, to_update
        

    def update_ai_opinion(test_cnt=None):
        '''
        일단 test_cnt 15개로 제한.  api 요금 문제.
        '''
        # test_cnt = 15
        params = {"change_min":2,
                  "change_max":10,
                  "consen":20,
                  "turnarround":True,
                  "good_buy":True,
                  "newbra":True,
                  "realtime":True,
                  "array_exclude":True,
                  "ab":True,
                  "abv":True,
        }
        
        data : pd.DataFrame = Api.choice_for_api(**params)
        if test_cnt:
            data = data.sample(test_cnt)
        result = asyncio.run(get_opinion_by_ticker_async_many(list(data['code'])))
        # print(result)
        #  [{'opinion': '보류',
        # 'reason': '최근 주가가 급등하고 높은 변동성에 있어 단기 투자에는 다소 불안정한 상황입니다. 또한, 거래량도 상당히 변동성이 강한 상태이며 투자자들의 매매 동향이 일정하지 않습니다. 종목의 실적이 개선되지 않고 있으며, 예상 수익도 부정적이어서 추가적인 상승을 기대하기는 어려운 상황입니다. 따라서 현재로서는 관망이 필요합니다.',
        # 'ticker': <Ticker: Ticker[원익홀딩스(030530)]>,
        # 'ai_method': 'openai',
        # 'close': 4805},]
        
        ## 분석후 자동매수 추가하기. 
        if len(result):
            from .mykis import KIS
            kis = KIS()
            for item in result:
                name = item['ticker'].name
                code = item['ticker'].code
                opinion = item['opinion']
                reason = item['reason']
                close = item['close']
                ai_method = item['ai_method']
                if opinion == '매수' and close >= 5000: # 매수신호이고 5000이상일때 주문하기. 
                    kis.buy_stock(code)
                    print('매수', name, code, close, ai_method)
        return result
    

    def take_profit():
        '''
        수익실현하기. 20분마다 실행. 
        '''
        from .mykis import KIS
        kis = KIS()
        kis.take_profit()
        
        
    

class GetData:

    async def get_code_info_df_async():
        """
        code_df 가져오기
        """
        all_ls = []

        async def _fetch(url):
            async with aiohttp.ClientSession() as session:
                async with session.get(url=url) as response:
                    if response.status == 200:
                        content_type = response.headers.get("Content-Type", "")
                        if "application/json" in content_type:
                            data = await response.json()
                        else:
                            data = await response.text()
            return data

        # ## 레버리지, 인버스 추가.
        dic = {
            "cd": ["A122630", "A252670"],
            "nm": ["KODEX 레버리지", "KODEX 200선물인버스2X"],
            "gb": ["ETF", "ETF"],
        }
        all_ls.append(pd.DataFrame(dic))

        urls = [
            f"http://comp.fnguide.com/SVO2/common/lookup_data.asp?mkt_gb={mkt_gb}&comp_gb=1"
            for mkt_gb in [2, 3]
        ]
        tasks = [_fetch(url) for url in urls]
        datas = await asyncio.gather(*tasks)
        datas = [json.loads(data) for data in datas]  ##  text to json
        datas = sum(datas, [])  # 평탄화. 2차원 리스트 -> 1차원
        all_ls.append(pd.DataFrame(datas))

        df = pd.concat(all_ls)
        df = df.reset_index(drop=True)
        # df = df[df["nm"].str.contains("스팩") == False]  # 스팩 제외
        df = df[~df["nm"].str.contains("스팩")]  # 스팩 제외

        ## 관리종목 거래정지종목 제외하기
        try:
            urls1 = [
                "https://finance.naver.com/sise/trading_halt.naver",  # 거래정지
                "https://finance.naver.com/sise/management.naver",  # 관리종목
            ]
            tasks1 = [_fetch(url) for url in urls1]
            datas1 = await asyncio.gather(*tasks1)
            거래정지_resp, 관리종목_resp = datas1

            거래정지 = pd.read_html(StringIO(거래정지_resp), encoding="cp949")[
                0
            ].dropna()
            거래정지 = 거래정지.filter(regex=r"^(?!.*Unname.*)")

            관리종목 = pd.read_html(StringIO(관리종목_resp), encoding="cp949")[
                0
            ].dropna()
            관리종목 = 관리종목.filter(regex=r"^(?!.*Unname.*)")

            stop_ls = list(관리종목["종목명"]) + list(
                거래정지["종목명"]
            )  # 관리종목 정지종목 리스트

            df = df[~df["nm"].isin(stop_ls)]  ## 제외하기.
        except Exception as e:
            print(f"err {e}")
        df = df.reset_index(drop=True)

        df["cd"] = df["cd"].apply(lambda x: x[1:])
        df = df.filter(regex="cd|nm|^gb")
        df = df.rename(columns={"cd": "code", "nm": "name"})
        return df

    def _get_info_all(code_list: List[Tuple], temp_cnt=None) -> List[Dict]:
        code_list = list(code_list)
        return asyncio.run(GetData._get_info_all_async(code_list))

    async def _get_info_all_async(code_list: List[Tuple], temp_cnt=None) -> List[Dict]:
        """ """

        async def fetch_with_semaphore(
            code, name, semaphore: asyncio.Semaphore, session: aiohttp.ClientSession
        ):
            async with semaphore:
                dic, traderinfo, finstats = await GetData._get_info_async(
                    code, name, session
                )
                dic["name"] = name
                print(f"{name}({code})")
                return dic, traderinfo, finstats

        semaphore = asyncio.Semaphore(5)  # 동시에 최대 10개의 요청을 처리하도록 제한

        if temp_cnt:
            code_list = random.sample(code_list, temp_cnt)

        async with aiohttp.ClientSession() as session:
            tasks = []
            # for idx, row in code_df.iterrows():
            for code, name in code_list:
                tasks.append(
                    asyncio.create_task(
                        fetch_with_semaphore(code, name, semaphore, session)
                    )
                )

            responses = await asyncio.gather(*tasks)

            return responses

    async def _get_info_async(
        code, name, session: aiohttp.ClientSession = None
    ) -> Tuple[Dict]:
        """
        한종목데이터 받기
        """
        if session:
            tasks = [
                GetData._get_naver_info_async(code, name, session),
                GetData._get_fnguide_info_async(code, name, session),
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
        else:
            print("session 생성함 _get_info_async")
            async with aiohttp.ClientSession() as session:
                tasks = [
                    GetData._get_naver_info_async(code, name, session),
                    GetData._get_fnguide_info_async(code, name, session),
                ]
                results = await asyncio.gather(*tasks, return_exceptions=True)

        dic = {}
        for result in results:
            if isinstance(result, dict):
                dic.update(result)
        dic = {
            k: v if not (type(v) == float and pd.isna(v)) else None
            for k, v in dic.items()
        }  ## np.나 값이 있다면 None으로 대체하기.
        dic["code"] = code
        dic["name"] = name
        traderinfo = dic.pop("traderinfo") if "traderinfo" in dic.keys() else {}
        finstats = dic.pop("finstats") if "finstats" in dic.keys() else {}

        return dic, traderinfo, finstats

    async def _get_naver_info_async(
        code: str,
        name: str,
        session: aiohttp.ClientSession = None,
    ):
        """
        basic info 가져오기
        data_base_name = 'naver'
        table_name = "basic1"  03.collection 에서 처리.
        """
        code_url = f"https://finance.naver.com/item/main.naver?code={code}"
        headers = {
            "user_agent": ua.random,
            "referer": "https://finance.naver.com",
        }
        # async with aiohttp.ClientSession() as session:
        if session:
            async with session.get(url=code_url, headers=headers) as response:
                if response.status == 200:
                    html = await response.text()
                else:
                    print("response.status: ", response.status)
                    return {}
        else:
            async with aiohttp.ClientSession() as session:
                async with session.get(url=code_url, headers=headers) as response:
                    if response.status == 200:
                        html = await response.text()
                    else:
                        print("response.status: ", response.status)
                        return {}

        soup = BeautifulSoup(html, "html.parser")
        dfs = pd.read_html(StringIO(str(soup)))

        ##################################################################################

        selector = "#time > em"
        date_text = soup.select_one(selector).text
        # print(date_text) ## (장중)

        extract_date_text = re.findall(r"[0-9.:]+", date_text)
        # print(extract_date_text) ## (장중)   기대.

        today = pd.to_datetime(extract_date_text[0])
        # print(f'date: {today}')
        # now = pd.to_datetime(' '.join(extract_date_text))

        ################################################################################

        all_dic = {}

        for df in dfs:
            # 시가총액 시가총액순위 상장주식수 액면가
            if Text_mining._contains_text(
                df.to_string(), "+시가총액 +시가총액순위 +상장주식수 +액면가"
            ):
                x = StockFunc.remove_nomean_index_col(df)
                x.columns = [col.split("l")[0] for col in x.columns]
                dic = x.to_dict("records")[0]
                for k, v in dic.items():
                    dic[k] = StockFunc.to_number(v)
                all_dic.update(dic)

            ## 외국인한도주식수 외국인소진율
            elif Text_mining._contains_text(
                df.to_string(), "+외국인한도주식수 +외국인소진율"
            ):
                x = StockFunc.remove_nomean_index_col(df)
                sub_pattern = re.compile(r"\(.+\)")
                x.columns = [sub_pattern.sub("", col) for col in x.columns]
                dic = x.to_dict("records")[0]
                for k, v in dic.items():
                    dic[k] = StockFunc.to_number(v)
                all_dic.update(dic)

            ## 배당수익율 추정PER
            elif Text_mining._contains_text(df.to_string(), "+배당수익 +추정PER"):
                x = df.transpose()
                x.columns = x.iloc[0]
                x = x.drop(x.index[0])
                dic = {
                    "배당수익율": StockFunc.to_number(
                        x.filter(regex="배당수익").iloc[0, 0]
                    )
                }
                all_dic.update(dic)

            # 동일업종 종목명 -> roe, per pbr ep(주당순이익) - > 동일업종 저per주 정보
            elif Text_mining._contains_text(
                df.to_string(), f"+시가총액 +종목명 +당기순이익 +매출액 +{code}"
            ):
                try:
                    x = df.set_index(df.columns[0])
                    x = x.transpose()
                    x = x.filter(regex="ROE|PER|PBR|주당순이익")
                    
                    # 정보가져오기
                    x = x.loc[x.index.str.contains(f"{code}")]
                    dic = x.to_dict("records")[0]
                    # dic["동일업종저per_name"] = low_per_name
                    # dic["동일업종저per_code"] = low_per_code
                    all_dic.update(dic)
                except Exception as e:
                    print(e)

            elif Text_mining._contains_text(df.to_string(), "+매도상위 +매수상위"):
                ## 데이터 처리하기.
                df = df.iloc[1:]
                df1 = df.iloc[:, :2].copy()
                df2 = df.iloc[:, 2:].copy()
                df1.columns = ["매도상위", "거래량"]
                df2.columns = ["매수상위", "거래량"]

                temp_text = df1["매도상위"].iat[-1]
                df2["매수상위"].iat[-1] = temp_text
                df1.columns = ["거래원", "매도거래량"]
                df2.columns = ["거래원", "매수거래량"]
                df1 = df1.set_index("거래원")
                df2 = df2.set_index("거래원")

                result_df = pd.concat([df1, df2], axis=1, join="outer")
                result_df = result_df.rename(
                    columns={
                        "매수거래량": "buy",
                        "매도거래량": "sell",
                    }
                )
                # result_df = result_df.replace({np.na: None})
                result_df.replace({np.nan: None}, inplace=True)
                
                trader_infodict = {}
                trader_infodict["date"] = today
                trader_infodict["traderinfo"] = result_df.to_dict("index")
                all_dic.update(trader_infodict)

        return all_dic

    async def _get_fnguide_info_async(
        code: str, name: str, session: aiohttp.ClientSession = None
    ):
        """
        return : dict
        """
        url = f"https://comp.fnguide.com/SVO2/ASP/SVD_Main.asp?pGB=1&gicode=A{code}"
        headers = {
            "user_agent": ua.random,
        }
        if session:
            async with session.get(url=url, headers=headers) as response:
                if response.status == 200:
                    html = await response.text()
                else:
                    return
        else:
            async with aiohttp.ClientSession() as session:
                async with session.get(url=url, headers=headers) as response:
                    if response.status == 200:
                        html = await response.text()
                    else:
                        return

        soup = BeautifulSoup(html, "html.parser")
        dfs = pd.read_html(StringIO(str(soup)))
        ########################################################################

        all_dic = {}
        all_dic["code"] = code
        all_dic["name"] = name

        finstats_dic = {}

        # 상단 선행per 저보 가져오기.
        selector = "#corp_group2 > dl > dd"
        tags = soup.select(selector)
        tags = [StockFunc.to_number(tag.text) for tag in tags]
        all_dic["PER"], all_dic["PER_12M"], _, all_dic["PBR"], all_dic["배당수익률"] = (
            tags
        )

        selector = "#compBody > div.section.ul_corpinfo > div.corp_group1 > p > span"
        tags = soup.select(selector)
        tags = [tag.text for tag in tags]

        try:
            all_dic["구분"] = tags[1].split(" ")[0]
        except:
            all_dic["구분"] = ""
        try:
            all_dic["업종"] = tags[1].split(" ")[1]
        except:
            all_dic["업종"] = ""
        try:
            all_dic["FICS"] = tags[3].split(" ")[2]
        except:
            all_dic["FICS"] = ""

        #####################################################################
        def modify_finstats_df(df):
            renamed_index_name = "항목"
            x = df.copy()
            if "Annual" in x.to_string():  # 연도데이터이면
                sub_pattern = re.compile(r"\(.+\)")
                x.columns = [sub_pattern.sub("", col[1]) for col in x.columns]
                x.columns = [col.split("/")[0].strip() for col in x.columns]
            elif "Quarter" in x.to_string():  # 분기데이터이면
                sub_pattern = re.compile(r"\(.+\)")
                x.columns = [sub_pattern.sub("", col[1]) for col in x.columns]
            x = x.rename(columns={"IFRS": renamed_index_name})
            x = x.set_index(renamed_index_name)
            x.index = [re.sub(r"\(원\)|\(|\)", "", idx) for idx in x.index]
            x = x.dropna(axis=1, how="all")
            # x = x.fillna(value=None)  ## na 값을 None으로 ( 데이터베이스 저장시 필요함.)
            # x = x.where(pd.notna(x), None)
            x = x.loc[:, ~x.columns.duplicated(keep='last')]  ## 2023/06 과 2023/12 의 데이터 있을때 연도경우 2023 데이터가 2개 생성되서 중복있다면 마지막데이터만 남기기. 
            for col in x.columns:
                x[col] = pd.to_numeric(x[col], errors="coerce")
            x = x.replace({np.nan: None})
            return x

        ######################################################################

        query_text_dict = {
            "연결연도": "+연결 +Annual -Quarter",
            "연결분기": "+연결 -Annual +Quarter",
            "별도연도": "+별도 +Annual -Quarter",
            "별도분기": "+별도 -Annual +Quarter",
        }

        for df in dfs:
            query_text = "+액면가 +유동주식수 +시가총액 +발행주식수"
            temp_io = StringIO(str(soup))
            if Text_mining._contains_text(df.to_string(), query_text):
                string = Text_mining._extract_table(
                    temp_io,
                    query_text,
                    "발행주식수",
                    col_match=-3,
                )
                all_dic["보통발행주식수"], all_dic["우선발행주식수"] = [
                    StockFunc.to_number(s.strip()) for s in string.split("/")
                ]

                ##################################################
                string = Text_mining._extract_table(
                    temp_io,
                    query_text,
                    "외국인 보유비중",
                    col_match=-1,
                )
                all_dic["외국인보유비중"] = StockFunc.to_number(str(string).strip())

                ####################################################
                string = Text_mining._extract_table(
                    temp_io,
                    query_text,
                    "액면가",
                    col_match=-1,
                )
                all_dic["액면가"] = StockFunc.to_number(str(string).strip())

                ####################################################
                string = Text_mining._extract_table(
                    temp_io,
                    query_text,
                    "유동주식수",
                    col_match=-1,
                )
                all_dic["유동주식수"], all_dic["유동비율"] = [
                    StockFunc.to_number(s.strip()) for s in string.split("/")
                ]
                ####################################################

            ####################################### 재무제표 #################################

            if Text_mining._contains_text(df.to_string(), query_text_dict["연결연도"]):
                x = modify_finstats_df(df)
                finstats_dic["연결연도"] = x.to_dict()

            if Text_mining._contains_text(df.to_string(), query_text_dict["연결분기"]):
                x = modify_finstats_df(df)
                finstats_dic["연결분기"] = x.to_dict()

            if Text_mining._contains_text(df.to_string(), query_text_dict["별도연도"]):
                x = modify_finstats_df(df)
                finstats_dic["별도연도"] = x.to_dict()

            if Text_mining._contains_text(df.to_string(), query_text_dict["별도분기"]):
                x = modify_finstats_df(df)
                finstats_dic["별도분기"] = x.to_dict()

        if finstats_dic:
            all_dic["finstats"] = finstats_dic
        return all_dic

    async def _get_investor_async(
        semaphore: asyncio.Semaphore, investor, str_date=None
    ):
        """
        investor : '외국인'
        개별데이터 받기
        """

        if str_date == None:
            str_date = pd.Timestamp.now().date()
            str_date = str_date.strftime("%Y%m%d")
        else:
            str_date = pd.to_datetime(str_date).strftime("%Y%m%d")

        async with semaphore:
            # logger.info(f'{str_date} {investor} download.... ' )
            result_df = await asyncio.to_thread(
                functools.partial(
                    pystock.get_market_net_purchases_of_equities,
                    str_date,
                    str_date,
                    "ALL",
                    investor,
                )
            )
            result_df["투자자"] = investor
            result_df["날짜"] = str_date
        return result_df

    async def _get_investor_all_async(date: List = None):
        """
        date 의 투자자 전체 데이터.
        """

        if date is None:
            date = pd.Timestamp.now().date()
        dates = [date] if not isinstance(date, list) else date
        str_dates = [pd.to_datetime(date).strftime("%Y%m%d") for date in dates]

        text = "개인/외국인/기관합계/금융투자/투신/연기금/보험/사모/은행/기타금융/기타법인/기타외국인"

        semaphore = asyncio.Semaphore(5)
        try:
            investor_ls = text.split("/")
            tasks = [
                asyncio.create_task(
                    GetData._get_investor_async(
                        semaphore=semaphore, investor=investor, str_date=str_date
                    )
                )
                for investor in investor_ls
                for str_date in str_dates
            ]
            result = await asyncio.gather(*tasks)
            result_df = pd.concat(result)
            result_df = result_df.reset_index(drop=True)
            if len(result_df):
                result_df = result_df.rename(columns={"티커": "code"})
                result_df["날짜"] = pd.to_datetime(result_df["날짜"])
            else:
                pass
        except:
            # logger.error(f"{date} 데이터가 존재하지 않습니다.")
            return pd.DataFrame()
        return result_df

    ## ISSUE
    def get_iss_list():
        # 최근이슈리스트 가져오기.
        url = "https://api.thinkpool.com/analysis/issue/recentIssueList"
        params = {
            "user_agent": ua.random,
            "referer": "https://www.thinkpool.com/",
        }
        resp = requests.get(url, params=params)
        js = resp.json()

        ## 데이터 정리
        all_ls = []
        for item in js:
            temp_dic = {}
            temp_dic["issn"] = item["issn"]
            temp_dic["iss_str"] = item["is_str"]
            temp_dic["hl_str"] = item["hl_str"]
            temp_dic["regdate"] = item["regdate"]
            temp_dic["ralated_codes"] = ",".join(
                [dic["code"] for dic in item["ralatedItemList"]]
            )
            temp_dic["ralated_code_names"] = ",".join(
                [dic["codeName"] for dic in item["ralatedItemList"]]
            )
            all_ls.append(temp_dic)

        ## 데이터가공
        iss_df = pd.DataFrame(all_ls)
        iss_df["regdate"] = iss_df["regdate"].str.split(" ", expand=True)[0]
        # pd.to_datetime(iss_df['regdate1'])
        iss_df["regdate"] = iss_df["regdate"].str.replace("/", "")
        return iss_df

    def get_iss_from_number(issn):
        """
        이슈넘버로 이슈헤드라인 가져오기.
        """
        url = f"https://api.thinkpool.com/analysis/issue/headline?issn={issn}"
        params = {
            "user_agent": ua.random,
            "referer": "https://www.thinkpool.com/",
        }
        resp = requests.get(url, params=params)
        js = resp.json()

        try:
            js["regdate"] = pd.to_datetime(js["hl_date"]).date()
        except:
            js["regdate"] = js["hl_date"]
        try:
            js["hl_cont_text"] = re.findall(".+(?=<[aA] href=)", js["hl_cont"])[0]
        except:
            js["hl_cont_text"] = js["hl_cont"]
        try:
            js["hl_cont_url"] = re.findall(
                '(?<=<[aA] href=").+(?=" *target)', js["hl_cont"]
            )[0]
        except:
            js["hl_cont_url"] = ""

        # 필요없는 데이터 제거
        del_result1 = js.pop(
            "hl_cont", "not_found"
        )  # 'country' 키가 없으면 'Not Found' 반환
        del_result2 = js.pop(
            "hl_date", "not_found"
        )  # 'country' 키가 없으면 'Not Found' 반환

        return js

    # 이슈연관 종목정보.
    def get_iss_related(issn):
        """
        이슈의 관련주정보 가져오기.
        """
        all_ls = []
        params = {
            "user_agent": ua.random,
            "referer": "https://www.thinkpool.com/",
        }
        # issn = 207
        url = f"https://api.thinkpool.com/analysis/issue/ralatedItemSummaryList?issn={issn}&pno=1"
        resp = requests.get(url, params=params)
        js = resp.json()

        totalcnt = js["totalCount"]
        ls = js["list"]  ## 최초자료.
        all_ls += ls

        try:
            loop_cnt = (
                ((totalcnt - 1) - 10) // 10
            ) + 1  ## 최초를 제외하고 몇번을 더 받아야하믐지 계산.
            if totalcnt > len(ls):
                for pno in range(2, 2 + loop_cnt):
                    url = f"https://api.thinkpool.com/analysis/issue/ralatedItemSummaryList?issn={issn}&pno={pno}"
                    resp = requests.get(url, params=params)
                    js = resp.json()
                    ls = js["list"]
                    all_ls += ls
        except Exception as e:
            pass
        new_all_ls = []
        for dic in all_ls:
            dic["otherIssueListName"] = ",".join(
                [dic1["is_str"] for dic1 in dic["otherIssueList"]]
            )
            dic["otherIssueList"] = ",".join(
                [str(dic1["issn"]) for dic1 in dic["otherIssueList"]]
            )
            new_all_ls.append(dic)
        result = pd.DataFrame(new_all_ls)
        return result

    async def _get_group_list_acync(group="theme"):
        """
        theme 또는 upjong 별로 관련 url 가져오기
        """
        url = f"https://finance.naver.com/sise/sise_group.naver?type={group}"
        r = await asyncio.to_thread(functools.partial(requests.get, url))

        if r.status_code == 200:
            try:
                soup = BeautifulSoup(r.text, "html5lib")
            except:
                soup = BeautifulSoup(r.text, "html.parser")

            selector = "#contentarea_left > table >  tr > td>  a"  ### 변경 주의.
            tags = soup.select(selector)
            if not len(tags):
                selector = "#contentarea_left > table > tbody >  tr > td>  a"
                tags = soup.select(selector)

            if not len(tags):
                return []

            basic_url = "https://finance.naver.com"
            ls = []
            for tag in tags:
                detail_url = basic_url + tag["href"]
                ls.append((tag.text, detail_url))
            return ls
        else:
            return []

    async def _get_theme_codelist_from_theme_async(name, url_theme):
        """
        input : theme(upjong), url
        return : list (dict) theme(upjong)name , code, code_name
        """
        r = await asyncio.to_thread(functools.partial(requests.get, url_theme))
        # r = requests.get(url_theme)
        if r.status == 200:
            print(f"{name}_succeed!")
        try:
            soup = BeautifulSoup(r.text, "html5lib")
        except:
            soup = BeautifulSoup(r.text, "html.parser")

        selector = "#contentarea > div:nth-child(5) > table > tbody > tr"
        table_tag = soup.select(selector)

        ls = []
        for tag in table_tag:
            dic = {}
            try:
                code_name = tag.select("td.name > div > a")[0].text
                code = tag.select("td.name > div > a")[0]["href"].split("=")[-1]
                try:
                    theme_text = tag.select("p.info_txt")[0].text
                except:
                    pass
                dic["name"] = name
                dic["code"] = code
                dic["code_name"] = code_name
                try:
                    dic["theme_text"] = theme_text
                except:
                    pass
                ls.append(dic)
            except:
                pass
        return ls

    async def get_all_upjong_theme(temp_cnt: int = 0):
        """
        네이버 theme upjong 전체데이터 가져오기
        return : theme_data, upjong_data
        """

        tasks1 = [
            GetData._get_group_list_acync("theme"),
            GetData._get_group_list_acync("upjong"),
        ]
        result1 = await asyncio.gather(*tasks1)
        theme_ls, upjong_ls = result1

        if temp_cnt:
            theme_ls = theme_ls[:temp_cnt]
            upjong_ls = upjong_ls[:temp_cnt]

        # #theme_ls 작업
        tasks_ls = []
        n = 20
        # task 분할.
        for i in range(0, len(theme_ls), n):
            tasks = [
                GetData._get_theme_codelist_from_theme_async(name, url)
                for name, url in theme_ls[i : i + n]
            ]
            tasks_ls.append(tasks)
        # 분할된 task 작업
        result_task = []
        for task in tasks_ls:
            result = await asyncio.gather(*task)
            result_task.append(result)
        # # 결과 취합.
        # theme_result_df = pd.DataFrame(
        #     [data for result in result_task for datas in result for data in datas]
        # )
        theme_data = [
            data for result in result_task for datas in result for data in datas
        ]

        # #upjong_ls 작업
        tasks_ls = []
        # task 분할.
        for i in range(0, len(upjong_ls), n):
            tasks = [
                GetData._get_theme_codelist_from_theme_async(name, url)
                for name, url in upjong_ls[i : i + n]
            ]
            tasks_ls.append(tasks)
        # 분할된 task 작업
        result_task = []
        for task in tasks_ls:
            result = await asyncio.gather(*task)
            result_task.append(result)
        # 결과 취합.
        # upjong_result_df = pd.DataFrame(
        #     [data for result in result_task for datas in result for data in datas]
        # )
        upjong_data = [
            data for result in result_task for datas in result for data in datas
        ]

        return theme_data, upjong_data

    def get_ohlcv_all_market(date):

        try:
            date = pd.to_datetime(date).strftime("%Y%m%d")
        except Exception as e:
            return pd.DataFrame()

        # df = pystock.get_market_ohlcv(date, market="ALL")  ##이 데이터는  konex 포함되어있다.
        try:
            all_data = [
                pystock.get_market_ohlcv(date, market=market)
                for market in ["KOSPI", "KOSDAQ"]
            ]
            df = pd.concat(all_data)
            rename_col = {
                "티커": "code",
                "시가": "Open",
                "고가": "High",
                "저가": "Low",
                "종가": "Close",
                "거래량": "Volume",
                "거래대금": "Amount",
                "등락률": "Change",
            }
            df1 = df.reset_index()
            df1["Date"] = date

            df1 = df1.rename(columns=rename_col)
            df1["Date"] = pd.to_datetime(df1["Date"])

            ## 전처리
            df1 = df1.loc[df1["Volume"] != 0]
            col = [
                "Date",
                "Open",
                "High",
                "Low",
                "Close",
                "Volume",
                "Amount",
                "Change",
                "code",
            ]
            df1 = df1[col]
            return df1
        except Exception as e:
            return pd.DataFrame()

    def get_ohlcv_all_market_from_fdr(codes):
        '''
        오늘 날짜의 데이터만 가져오는것임. 빈 df 를 반환할수도 있다.
        '''
        
        semaphore = asyncio.Semaphore(5) 
        async def async_fdr_datareader(semaphore, code, today):
            async with semaphore:
                result = await asyncio.to_thread(fdr.DataReader, code, today)
                result['code'] = code
                return result
            
        async def async_fdr_datareader_all(semaphore, codes):
            today = pd.Timestamp.now().date()
            tasks = [asyncio.create_task(async_fdr_datareader(semaphore, code, today)) for code in codes]
            results = await asyncio.gather(*tasks)
            df = pd.concat(results)
            df.reset_index(inplace=True)
            return df            
        
        result_df = asyncio.run(async_fdr_datareader_all(semaphore, codes))
        return result_df
        
    async def _get_news_from_stockplus_today():
        """
        news
        """
        url = "https://mweb-api.stockplus.com/api/news_items/all_news.json?scope=popular&limit=1000"
        params = {
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        }

        async with aiohttp.ClientSession() as session:
            # async with session.get(url=url, headers=headers, params=params) as response:
            async with session.get(url=url, params=params) as response:
                if response.status == 200:
                    # js = await response.json(content_type='text/html') # 이건 실행안됨.
                    js = await response.json()
                else:
                    return

        datas = js["newsItems"]
        for data in datas:
            data["relatedStocks"] = [
                item["shortCode"][1:] for item in data["relatedStocks"]
            ]

        ## 시간 처리 field 처리위해 df 변환
        df = pd.DataFrame(datas)
        df["createdAt"] = pd.to_datetime(df["createdAt"]).dt.tz_convert("Asia/Seoul")
        df = df.sort_values(by="createdAt")

        col = ["id", "title", "createdAt", "writerName", "relatedStocks"]
        df = df[col]
        df = df.rename(columns={"id": "no"})

        # url = 'https://news.stockplus.com/m?news_id={id}'  #  url은 생성하면 된다. 저장해야하나.?

        df["createdAt"] = pd.to_datetime(df["createdAt"]).dt.tz_convert("Asia/Seoul")
        # df["createdAt"] = df["createdAt"].apply(lambda x: x.tz_localize(None))
        df = df.sort_values(by="createdAt")

        return df.to_dict("records")

    def get_ohlcv_min(code, data_type, limit=480):
        option_dic = {
            "월봉": "months",
            "주봉": "weeks",
            "일봉": "days",
            "60분봉": "60/minutes",
            "30분봉": "30/minutes",
            "15분봉": "15/minutes",
            "5분봉": "5/minutes",
        }
        acode = "A" + code
        str_option = option_dic[data_type]
        url = f"http://finance.daum.net/api/charts/{acode}/{str_option}"
        params = {"limit": f"{limit}", "adjusted": "true"}
        headers = {
            "referer": "https://finance.daum.net/chart/",
            "user-agent": "Mozilla/5.0",
        }

        # async with aiohttp.ClientSession() as session:
        #     async with session.get(url=url, headers=headers, params=params) as response:
        #         if response.status == 200:
        #             data = await response.json()
        #         else:
        #             return pd.DataFrame()

        data = requests.get(url=url, headers=headers, params=params)
        if data.status == 200:
            data = data.json()
        else:
            return pd.DataFrame()

        data = data["data"]
        df = pd.DataFrame(data)
        chage_col = {
            "candleTime": "Date",
            "tradePrice": "Close",
            "openingPrice": "Open",
            "highPrice": "High",
            "lowPrice": "Low",
            "candleAccTradePrice": "TradePrice",
            "candleAccTradeVolume": "Volume",
        }
        columns = ["Date", "Open", "High", "Low", "Close", "Volume", "TradePrice"]
        df["candleTime"] = pd.to_datetime(df["candleTime"])
        df.rename(columns=chage_col, inplace=True)
        df = df[columns].set_index("Date")
        return df

    async def fetch(url,headers):
        async with aiohttp.ClientSession() as session:
            async with session.get(url,headers=headers) as response:
                return await response.text()
        
    async def get_data_from_naver(change_min=-30, change_max=30):
        '''
        rise, steady, fall 요청이 서로 다름. 
        등락률범위에 따라 요청횟수 달라짐. 
        '''
        import requests
        headers = {
            "user_agent": ua.random,
        }
        rise_url1 = 'https://finance.naver.com/sise/sise_rise.naver'
        rise_url2 = 'https://finance.naver.com/sise/sise_rise.naver?sosok=1'
        steady_url1 = 'https://finance.naver.com/sise/sise_steady.naver'
        steady_url2 = 'https://finance.naver.com/sise/sise_steady.naver?sosok=1'
        fall_url1 = 'https://finance.naver.com/sise/sise_fall.naver'
        fall_url2 = 'https://finance.naver.com/sise/sise_fall.naver?sosok=1'

        urls = []
        if change_min > 0 and change_max > 0:
            urls.append(rise_url1)
            urls.append(rise_url2)
        if change_min ==0 and change_max > 0:
            urls.append(rise_url1)
            urls.append(rise_url2)
            urls.append(steady_url1)
            urls.append(steady_url2)
        if change_min < 0 and change_max ==0:
            urls.append(fall_url1)
            urls.append(fall_url2)
            urls.append(steady_url1)
            urls.append(steady_url2)
        
        if change_min < 0 and change_max < 0:
            urls.append(fall_url1)
            urls.append(fall_url2)
        if change_min < 0 and change_max > 0:
            urls.append(fall_url1)
            urls.append(fall_url2)
            urls.append(steady_url1)
            urls.append(steady_url2)
            urls.append(rise_url1)
            urls.append(rise_url2)
            
        tasks = [GetData.fetch(url,headers=headers) for url in urls]
        results = await asyncio.gather(*tasks)
                
        results = [pd.read_html(StringIO(result))[-1] for result in results]
        df = pd.concat(results)
        need_fields = '종목명|등락률|현재가|거래량|매수총잔량|매도총잔량'
        
        df = df.filter(regex=need_fields)
        df = df.dropna()
        df['등락률'] = df['등락률'].str.replace(r'[+%]', '', regex=True)
        df['등락률'] = df['등락률'].astype(float)
        
        df = df.sort_values('등락률', ascending=False)
        df = df.loc[df['거래량'] != 0]
    
        return df
           
    def get_realtime_data(change_min:float=None, change_max:float=None):
        '''
        naver 실시간 시세가져오기.
        등락율에 따라 요청이 달라지기때문에 값을 가져오고 등락률에 필터링함. 
        '''
        df = asyncio.run(GetData.get_data_from_naver(change_min=change_min, change_max=change_max))
        if change_min is not None:
            df = df.loc[df['등락률'] >= change_min]
        if change_max is not None:
            df = df.loc[df['등락률'] <= change_max]
        df = df.reset_index(drop=True)
            
        return df


class Api:
    
    def get_df_real_from_db(change_min=None, change_max=None):
        
        data = Ohlcv.objects.select_related('ticker')
        last_datas = data.order_by('ticker_id','-Date').distinct('ticker_id')
        if change_min:
            last_datas = last_datas.filter(Change__gte=change_min)
            pass
        if change_max:
            pass
            last_datas = last_datas.filter(Change__lte=change_max)
            
        data = last_datas.values('ticker__name','Close','Volume','Change')
        df = pd.DataFrame(data)
        new_name_dic = {'ticker__name' : '종목명', 'Close':'현재가','Change':'등락률','Volume':'거래량'}
        df.rename(columns = new_name_dic, inplace = True)
        df = df[['종목명','현재가','등락률','거래량']]
        return df
    
    def get_df_real_from_fdr():
            df_real = fdr.StockListing('krx')
            new_name_dic = {'Name' : '종목명', 'Close':'현재가','ChagesRatio':'등락률','Volume':'거래량'}
            df_real.rename(columns = new_name_dic, inplace = True)
            df_real = df_real[['종목명','현재가','등락률','거래량']]
            return df_real
    
        
# change_min=2&
# change_max=10&
# consen=20&
# turnarround=true&
# good_buy=true&
# newbra=true&
# realtime=true&
# sun_ac=30&
# coke_up=55&
# sun_gcv=true&
# coke_gcv=true&
# array=true&
# array_exclude=true&
# ab=true&
# abv=true&
# goodwave=true&
# ac=true&
# new_listing=true&
# rsi=true&
# exp=true


    # def choice_for_api2(newbra=None,turnarround=None,good_buy=None,consen=None, 
    #                    realtime=None,change_min=None, change_max=None, 
    #                    ac=None, array=None, goodwave=None,  ab=None, abv=None, 
    #                    sun_gcv=None, coke_gcv=None, sun_ac=None, coke_up=None,
    #                    good_cash=None, w3=None,search=None,endprice=None,exp=None,
    #                    array_exclude=None, new_listing=None,rsi=None,favorites=None,
    #                    buy_prices=False, today_ai=None,
    #                    **kwargs,
    #                    ):
    #     ''' api용 추천종목 선택하기. 
    #     값을 받아오는 param : consen , sun_ac, sun_ac_value, bb_ac : coke_up_value
    #     change_min, change_max, sun_ac, coke_up, new_bra, turnarround, sun_gcv, coke_gcv
        
    #     실제 요청값들.
    #     ab: 1 abv:  1 array :  1 change_max :  8 change_min :  3 
    #     coke_gcv :  1 coke_up :  50 consen :  50 good_buy :  1 
    #     newbra :  1 realtime :  1 sun_ac :  50 sun_gcv :  1 turnarround :  1
         
    #     적자 = -10000, 턴어라운드 = -1000
        
    #     df_real : 종목명, 현재가, 등락률, 거래량
        
    #     '''
    #     if kwargs:
    #         print("===========불필요한 데이터 요청됨 ===============")
    #         print(kwargs)
    #         print("=========================================")
        
        
    #     if change_min is None:
    #         change_min = -30
    #     if change_max is None:
    #         change_max = 30
    #     ############################  df_real  ##############################     
    #     if search is not None:
    #         search = search.strip()
    #         ## 일단 약간 지연데이터로 처리
    #         search_q = Q(ticker__code__contains=search) | Q(ticker__name__contains=search)
    #         chartvalues = ChartValue.objects.select_related('ticker').filter(search_q)
    #         searched_names = chartvalues.values_list('ticker__name',flat=True)
    #         df_real = Api.get_df_real_from_fdr() 
    #         df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
    #         df_real['현재가'] = pd.to_numeric(df_real['현재가'], errors='coerce')
    #         df_real['매수총잔량'] = 0
    #         df_real['매도총잔량'] = 0
    #     elif favorites:
    #         user = User.objects.get(username=favorites) # user가져옴.
    #         tickers = [ticker.ticker for ticker in user.favorites.all()]
    #         buy_prices = {item.ticker.code:item.buy_price for item in user.favorites.all()}    
    #         print(buy_prices, 'buy_prices', type(buy_prices)) 
    #         # {code:buy_price, code:buy_price, ...}
    #         if buy_prices:
    #             chartvalues = ChartValue.objects.filter(ticker__in=buy_prices.keys())
    #         else:
    #             return pd.DataFrame()
                
    #         searched_names = chartvalues.values_list('ticker__name',flat=True)
    #         change_min, change_max = -30, 30
    #         df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
    #         df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
    #         if len(df_real) == 0:
    #             df_real = Api.get_df_real_from_fdr() 
    #             df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
    #             df_real['현재가'] = df_real['현재가'].astype(float)
    #             df_real['매수총잔량'] = 0
    #             df_real['매도총잔량'] = 0
        
    #     elif today_ai:
    #         change_min, change_max = -30, 30
    #         df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
    #         chartvalues = ChartValue.objects.select_related('ticker').all()
    #         # q = AiOpinionForStock.get_today_data()
    #         q = AiOpinionForStock.get_nth_latest_data(n=4)
    #         today_tickers = [item.ticker for item in q]
    #         chartvalues = chartvalues.filter(ticker__in=today_tickers)

    #     elif new_listing:
    #         change_min, change_max = -30, 30
    #         df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)

    #     else:
    #         try:
    #             df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
    #         except:
    #             df_real = Api.get_df_real_from_db(change_min=change_min, change_max=change_max)
        
    #         chartvalues = ChartValue.objects.select_related('ticker').all()
    #     ######################################################################
        
    #     ############################ chartvalues  ##############################
    #     # chartvalues = ChartValue.objects.select_related('ticker').all()
    #     ######### query 필터링 ##########
    #     all_Q = Q()
    #     ## 그룹1  
    #     group1_Q = Q()
    #     if newbra:
    #         new_phase_d_q = Q(chart_d_new_phase=True)
    #         group1_Q |= new_phase_d_q
    #     if turnarround:
    #         turnarround1_q = Q(growth_y1=-1000)
    #         group1_Q |= turnarround1_q
    #     if good_buy:
    #         good_buy_q = Q(good_buy__gt=0)
    #         group1_Q |= good_buy_q
    #     if consen:
    #         growth_rate = int(consen)
    #         growth_y1_q = Q(growth_y1__gte=growth_rate)
    #         group1_Q |= growth_y1_q
    #     # groun1  완료
    #     all_Q  &= group1_Q
        
    #     # 그룹3 
    #     group3_Q = Q() ## ac 만. realtime 과종가매수는 다르게 처리해야함.
    #     if rsi:
    #         rsi_q = Q(reasons__contains='rsi')
            
    #         group3_Q &= rsi_q
            
    #     if array:
    #         good_array_q = Q(chart_d_good_array=True)
    #         group3_Q &= good_array_q
        
        
    #     if array_exclude: # 역배열제외. chart_d_bad_array 가 False 인것. 
    #         bad_array_q = Q(chart_d_bad_array=False)
    #         group3_Q &= bad_array_q
        
        
    #     if goodwave:
    #         w20_3w_q = Q(reasons__contains="is_w20_3w")
    #         group3_Q &= w20_3w_q
        
    #     if ab:
    #         ab_d_q = Q(chart_d_ab=True)
    #         group3_Q &= ab_d_q
            
    #     if abv:
    #         ab_v_d_q = Q(chart_d_ab_v=True)
    #         group3_Q &= ab_v_d_q
        
    #     if coke_up:
    #         coke_width_cond = Q(chart_d_bb240_width__lte=coke_up)
    #         group3_Q &= coke_width_cond
    #     if sun_ac:
    #         sun_width_cond = Q(chart_d_sun_width__lte=sun_ac)
    #         group3_Q &= sun_width_cond
        
    #     '''
    #     보완점. sun_gcv, coke_gcv, 도 값을 받아와도 될것같음.
    #     '''
    #     if sun_gcv:
    #         sun_gcv_q = Q(reasons__icontains='sun_gcv')  ############## 수정필요함.  icontains contains 차이.
    #         group3_Q &= sun_gcv_q
            
    #     # all_list = list(chartvalues.values_list('reasons', flat=True))
    #     # all_list = [item for item in all_list if item!=""]
    #     # all_list= list(set([item for items in all_list for item in items.split()]))
    #     # 존재하는 이유들. 
        
    #     # ['is_sun_ac','is_w20_3w','is_coke_ac','is_coke_gcv240','is_coke_gcv60',
    #     #  'is_new_phase','is_w3_ac','is_rsi','is_multi_through']
        
        
    #     if coke_gcv:
    #         coke_gcv_q = Q(reasons__contains='is_coke_gcv')
    #         group3_Q &= coke_gcv_q
        
    #     # if good_cash:           ################################# -- 체크박스 추가 값으로 받아와야함.
    #     #     value = int(good_cash)
    #     #     good_cash_q = Q(유보율__gte=value)
    #     #     group3_Q &= good_cash_q

    #     if w3:
    #         w3_q = Q(reasons__contains='w3') | Q(reasons__contains='3w')         ### 체크박스에 추가해야마. 대기도 포함 해야함. 
    #         group3_Q &= w3_q

    #     # group3 완료
    #     all_Q &= group3_Q
        
    #     # 종가매수 조건 추가하기.   종가매수 체크해야함. 어떤거 해야하나. 단봉 추가. 
    #     # if endprice:
    #     #     print('endprice 적용함. ') 
    #     #     # endprice_cond_q = Q(reasons__isnull=False)
    #     #     all_Q &= endprice_cond_q
        
    #     ## 실험실 조건 추가
    #     if exp:
    #         exp_cond_q = Q(chart_d_bb240_upper20__gte=0.1)
    #         all_Q &= exp_cond_q
    #     ################  여기까지 all_Q #####################
        
        
    #     if new_listing: # 신규상장.  신규상장이 True 인것. 
    #         new_listing_q = Q(신규상장=True)
    #         chartvalues = ChartValue.objects.select_related('ticker').all()
    #         chartvalues = chartvalues.filter(new_listing_q)
    #     else:
    #         chartvalues = chartvalues.filter(all_Q)

    #     ##### query 필터링 처리 후 데이터프레임 만들기. 
    #     if search is not None: # 검색어가 있을때 필터링 처리.
    #         종목명리스트 = df_real['종목명'].tolist()
    #         chartvalues = chartvalues.filter(ticker__name__in(종목명리스트))
        
    #     else:   
    #         chartvalues = chartvalues.filter(all_Q)
        
    #     # ## 즐겨찾기면 chartvalues 완전 다르게 가져오기.############################
    #     # if favorites:
    #     #     # user = User.objects.get(username=favorites) # user가져옴.
            
    #     #     # tickers = [ticker.ticker for ticker in user.favorites.all()]
    #     #     # chartvalues = ChartValue.objects.filter(ticker__in(tickers))
    #     #     if buy_prices:
    #     #         chartvalues = ChartValue.objects.filter(ticker__in=buy_prices.keys())
    #     #     else:
    #     #         return pd.DataFrame()
        
    #     ## 필요한 데이터만 추출
    #     if len(chartvalues) == 0:
    #         return pd.DataFrame()
    #     print('필터된 데이터 개수 :::: ', chartvalues.count())
    #     ## bb240_upper20 활용해서 추세 찾을수 있을듯. 
    #     need_fields = [ 'date','cur_open','cur_close','pre_close','pre_vol','cur_vol','vol20', 
    #                    'chart_5_vol20','chart_30_vol20','chart_d_vol20',
    #                    'growth_y1','growth_y2','EPS','growth_q','good_buy',
    #                     '매물대1','매물대2','상장주식수','유동주식수','유보율','부채비율','액면가',
    #                     'chart_5_bb240_upper', 'chart_30_bb240_upper', 'chart_d_bb240_upper', 'chart_d_bb240_width',
    #                     'chart_d_bb60_upper', 'chart_d_bb60_width',
    #                     'chart_d_sun_width','chart_d_sun_max','chart_d_bb240_upper10','chart_d_bb240_upper20',
    #                     ]
        
    #     chart_fields = [field.name for field in ChartValue._meta.get_fields()
    #                     if field.name in need_fields]
        
    #     data = []
    #     for value in chartvalues:
    #         record = {field :getattr(value, field) for field in chart_fields}
    #         record['code'] = value.ticker.code
    #         record['name'] = value.ticker.name
    #         data.append(record)
        
    #     df_stats = pd.DataFrame(data) ## filter된 데이터 필요한 필드만 받아오기.
    #     ################################################################################
        
    #     ################## 공통 데이터 df 로 만들기. ##################
    #     ## 합치기 공집합
    #     df = pd.merge(df_real, df_stats, left_on('종목명'), right_on('name'), how='inner')
    #     print('합친데이터 개수 :::: ', len(df))
    #     # 시가 추정.
    #     df['시가'] = df['현재가'] / ( 1 + df['등락률'] /100)
        
    #     ## buy_price 추가하기. 
    #     if buy_prices is not None:
    #         try:
    #             df['buy_price'] = df['code'].map(buy_prices)
    #         except:
    #             pass
                    
    #     ## df 가지고 장중인지 아닌지 확인하기. 
    #     time_rate = StockFunc.get_progress_percentage() # 시간에 따른 비율.  실시간이 아니면 1로 특히 휴일인경우 처리해야한다. ## 수정필요함.
    #     time_rate = time_rate if time_rate is not None else 1
    #     print("time_rate :::: ", time_rate)
    #     if sum(df['현재가'] == df['cur_close']) == len(df): # 데이터 전체를 보고 장중이 아닌경우는 장마감기준으로 처리하기. 
    #         print('장중이 아님.')
    #         전일종가 = 'pre_close'
    #         전일거래량 = 'pre_vol'
    #         time_rate = 1
    #     else:
    #         전일종가 = 'cur_close'
    #         전일거래량 = 'cur_vol'
            
    #         # pre_close 가 전일종가임. 
    #         # df['pre_vol'] 이 전일 거래량임. 
    #         # df['pre_vol'] 이 전일 거래량임. 
            
            
    #     if search is not None: # 검색어가 있을때 그냥 리턴.
    #         return df
    #     if favorites: # favorite 일땐 그냥 리턴.
    #         return df
    #     if today_ai: # today_ai 일땐 그냥 리턴.
    #         return df
    #     if new_listing:
    #         return df
        

    #     ############ realtime 에서 이조건도 넣어야할까? 아직 안넣음. 고민해보자! ##############
    #     # sun_width_d_q = Q(chart_d_sun_width__lte=30)
    #     # sun_width_30_q = Q(chart_30_sun_width__lte=15)
    #     # sun_width_5_q = Q(chart_5_sun_width__lte=7)
    #     # bb240_width_d_q = chartvalues.filter(chart_d_bb240_width__lte=50)
    #     # bb240_width_30_q = chartvalues.filter(chart_30_bb240_width__lte=20)
    #     # bb240_width_5 = chartvalues.filter(chart_5_bb240_width__lte=14)

    #     ## 추가로 조건 생성 .... cur_close 와 pre_close 가 상황에 따라 달라짐. 
    #     # 5 돌파조건. 
    #     cond5_1 = (df['시가'] <= df['chart_5_bb240_upper']) & (df['현재가'] > df['chart_5_bb240_upper'])
    #     cond5_2 = (df[전일종가] <= df['chart_5_bb240_upper']) & (df['현재가'] > df['chart_5_bb240_upper'])
    #     # 30 돌파조건. 
    #     cond30_1 = (df['시가'] <= df['chart_30_bb240_upper']) & (df['현재가'] > df['chart_30_bb240_upper'])
    #     cond30_2 = (df[전일종가] <= df['chart_30_bb240_upper']) & (df['현재가'] > df['chart_30_bb240_upper'])
    #     # 일 돌파조건.  ### 요게 장중일때와 아닐때가 달라. ..........
    #     try:
    #         condd_1 = (df['시가'] <= df['chart_d_bb240_upper']) & (df['현재가'] > df['chart_d_bb240_upper'])
    #     except:
    #         condd_1 = False
    #     try:
    #         condd_2 = (df[전일종가] <= df['chart_d_bb240_upper']) & (df['현재가'] > df['chart_d_bb240_upper'])
    #     except:
    #         condd_2 = False
    #     #realtime 조건.
    #     cond_real = (cond5_1 | cond5_2) | (cond30_1 | cond30_2) | (condd_1 | condd_2)
    #     # df = df.loc[cond_real]
        
    #     # ac 조건. 
       
    #     cond_ac_vol1 = df['거래량'] >= df[전일거래량]  * 2 * time_rate
    #     cond_ac_vol2 = df['거래량'] >= df['cur_vol'] * 2 * time_rate
    #     cond_ac_vol3 = df['거래량'] >= df['vol20'] * 2 * time_rate
    #     cond_ac_vol = cond_ac_vol1 | cond_ac_vol2 | cond_ac_vol3
    #     cond_ac = cond_ac_vol & (df['등락률'] >=3) & (df['등락률']<=30 )
    #     # sun_ac 조건.  ## 
    #     cond_sun1 = (df['시가'] <= df['chart_d_sun_max']) & (df['현재가'] > df['chart_d_sun_max'])
    #     cond_sun2 = (df[전일종가] <= df['chart_d_sun_max']) & (df['현재가'] > df['chart_d_sun_max'])
    #     sun_ac_cond = (cond_sun1 | cond_sun2) & cond_ac_vol
    #     # coke_up 조건.
    #     cond_coke = (condd_1 | condd_2) & cond_ac_vol
        
    #     # 거래량 줄은 조건
    #     low_volume_cond =(df['거래량'] >= df['vol20'] * time_rate) & (df['거래량'] >= df['cur_vol']* time_rate)
    #     # 단봉조건 
    #     short_candle_cond = (df['등락률'] >= -2) & (df['등락률'] <= 3) # 단봉조건은 종목마다 기준이 다를수 있음. 
        
    #     # realtime 조건. 
    #     only_realtime_cond = cond_real
    #     if ac:
    #         only_realtime_cond = cond_ac & only_realtime_cond
    #     if sun_ac:
    #         ## 너비 조건 추가해야함. 
    #         sun_width = sun_ac
    #         only_realtime_cond = only_realtime_cond & sun_ac_cond
    #     if coke_up:
    #         # 너비 추가해야함. 
    #         coke_width = coke_up
            
    #         only_realtime_cond = only_realtime_cond & cond_coke
        
    #     # 종가매수조건 
    #     only_endprice_cond = low_volume_cond & short_candle_cond  # 종가매수조건은 추가로 해야한다. 위 상태에서 쿼리추가해야함. 
            
    #     if realtime : # 둘다. 
    #         df = df.loc[only_realtime_cond]
    #     elif endprice : # 실시간만.
    #         df = df.loc[only_endprice_cond]
    #     print(f"{len(df)}개의 데이터가 조회되었습니다.")
    #     return df
    
    
    def choice_for_api3(newbra=None,turnarround=None,good_buy=None,consen=None, 
                       realtime=None,change_min=None, change_max=None, 
                       ac=None, array=None, goodwave=None,  ab=None, abv=None, 
                       sun_gcv=None, coke_gcv=None, sun_ac=None, coke_up=None,
                       good_cash=None, w3=None,search=None,endprice=None,exp=None,
                       array_exclude=None, new_listing=None,rsi=None,favorites=None,
                       buy_prices=False, today_ai=None,
                       **kwargs, 
                       ):
        '''
        api용 추천종목 선택하기. 
        # ...existing code...
        '''
        
        # ...existing code...

        # if favorites:
        #     user = User.objects.get(username=favorites) # user가져옴.
        #     tickers = [ticker.ticker for ticker in user.favorites.all()]
        #     buy_prices = {item.ticker.code:item.buy_price for item in user.favorites.all()}    
        #     print(buy_prices, 'buy_prices', type(buy_prices)) 
        #     # {code:buy_price, code:buy_price, ...}
        #     if buy_prices:
        #         chartvalues = ChartValue.objects.filter(ticker__code__in=buy_prices.keys())
        #     else:
        #         # 빈 DataFrame 반환
        #         return pd.DataFrame()
                
        #     searched_names = chartvalues.values_list('ticker__name',flat=True)
        #     change_min, change_max = -30, 30
        #     df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
        #     df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
        #     if len(df_real) == 0:
        #         df_real = Api.get_df_real_from_fdr() 
        #         df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
        #         df_real['현재가'] = df_real['현재가'].astype(float)
        #         df_real['매수총잔량'] = 0
        #         df_real['매도총잔량'] = 0

        # if favorites:
        #     if buy_prices:
        #         # 명시적으로 DataFrame 반환 확인
        #         df = pd.merge(df_real, df_stats, left_on='종목명', right_on='name', how='inner')
                
        #         try:
        #             df['buy_price'] = df['code'].map(buy_prices)
        #         except Exception as e:
        #             print(f"매수가격 매핑 오류: {e}")
                
        #         print(f"즐겨찾기 반환 데이터: {type(df)}")
        #         if not isinstance(df, pd.DataFrame):
        #             return pd.DataFrame()
                
        #         return df
        #     else:
        #         return pd.DataFrame()

        
        if change_min is None:
            change_min = -30
        if change_max is None:
            change_max = 30
        ############################  df_real  ##############################     
        if search is not None:
            search = search.strip()
            ## 일단 약간 지연데이터로 처리
            search_q = Q(ticker__code__contains=search) | Q(ticker__name__contains=search)
            chartvalues = ChartValue.objects.select_related('ticker').filter(search_q)
            searched_names = chartvalues.values_list('ticker__name',flat=True)
            df_real = Api.get_df_real_from_fdr() 
            df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
            df_real['현재가'] = pd.to_numeric(df_real['현재가'], errors='coerce')
            df_real['매수총잔량'] = 0
            df_real['매도총잔량'] = 0
        elif favorites:
            user = User.objects.get(username=favorites) # user가져옴.
            # tickers = [ticker.ticker for ticker in user.favorites.all()]
            buy_prices = {item.ticker.code:item.buy_price for item in user.favorites.all()}    
            print(buy_prices, 'buy_prices', type(buy_prices)) 
            # {code:buy_price, code:buy_price, ...}
            if buy_prices:
                chartvalues = ChartValue.objects.filter(ticker__in=buy_prices.keys())
            else:
                return pd.DataFrame()
                
            searched_names = chartvalues.values_list('ticker__name',flat=True)
            change_min, change_max = -30, 30
            df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
            chartvalues = ChartValue.objects.select_related('ticker').all()
            if len(df_real) == 0:
                df_real = Api.get_df_real_from_fdr() 
                df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
                df_real['현재가'] = df_real['현재가'].astype(float)
                df_real['매수총잔량'] = 0
                df_real['매도총잔량'] = 0
            
        
        elif today_ai:
            change_min, change_max = -30, 30
            df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            chartvalues = ChartValue.objects.select_related('ticker').all()
            # q = AiOpinionForStock.get_today_data()
            q = AiOpinionForStock.get_nth_latest_data(n=4)
            today_tickers = [item.ticker for item in q]
            chartvalues = chartvalues.filter(ticker__in=today_tickers)

        elif new_listing:
            change_min, change_max = -30, 30
            df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)

        else:
            try:
                df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            except:
                df_real = Api.get_df_real_from_db(change_min=change_min, change_max=change_max)
        
            chartvalues = ChartValue.objects.select_related('ticker').all()
        ######################################################################
        
        ############################ chartvalues  ##############################
        # chartvalues = ChartValue.objects.select_related('ticker').all()
        ######### query 필터링 ##########
        all_Q = Q()
        ## 그룹1  
        group1_Q = Q()
        if newbra:
            new_phase_d_q = Q(chart_d_new_phase=True)
            group1_Q |= new_phase_d_q
        if turnarround:
            turnarround1_q = Q(growth_y1=-1000)
            group1_Q |= turnarround1_q
        if good_buy:
            good_buy_q = Q(good_buy__gt=0)
            group1_Q |= good_buy_q
        if consen:
            growth_rate = int(consen)
            growth_y1_q = Q(growth_y1__gte=growth_rate)
            group1_Q |= growth_y1_q
        # groun1  완료
        all_Q  &= group1_Q
        
        # 그룹3 
        group3_Q = Q() ## ac 만. realtime 과종가매수는 다르게 처리해야함.
        if rsi:
            rsi_q = Q(reasons__contains='rsi')
            
            group3_Q &= rsi_q
            
        if array:
            good_array_q = Q(chart_d_good_array=True)
            group3_Q &= good_array_q
        
        
        if array_exclude: # 역배열제외. chart_d_bad_array 가 False 인것. 
            bad_array_q = Q(chart_d_bad_array=False)
            group3_Q &= bad_array_q
        
        
        if goodwave:
            w20_3w_q = Q(reasons__contains="is_w20_3w")
            group3_Q &= w20_3w_q
        
        if ab:
            ab_d_q = Q(chart_d_ab=True)
            group3_Q &= ab_d_q
            
        if abv:
            ab_v_d_q = Q(chart_d_ab_v=True)
            group3_Q &= ab_v_d_q
        
        if coke_up:
            coke_width_cond = Q(chart_d_bb240_width__lte=coke_up)
            group3_Q &= coke_width_cond
        if sun_ac:
            sun_width_cond = Q(chart_d_sun_width__lte=sun_ac)
            group3_Q &= sun_width_cond
        
        '''
        보완점. sun_gcv, coke_gcv, 도 값을 받아와도 될것같음.
        '''
        if sun_gcv:
            sun_gcv_q = Q(reasons__icontains='sun_gcv')  ############## 수정필요함.  icontains contains 차이.
            group3_Q &= sun_gcv_q
            
        # all_list = list(chartvalues.values_list('reasons', flat=True))
        # all_list = [item for item in all_list if item!=""]
        # all_list= list(set([item for items in all_list for item in items.split()]))
        # 존재하는 이유들. 
        
        # ['is_sun_ac','is_w20_3w','is_coke_ac','is_coke_gcv240','is_coke_gcv60',
        #  'is_new_phase','is_w3_ac','is_rsi','is_multi_through']
        
        
        if coke_gcv:
            coke_gcv_q = Q(reasons__contains='is_coke_gcv')
            group3_Q &= coke_gcv_q
        
        # if good_cash:           ################################# -- 체크박스 추가 값으로 받아와야함.
        #     value = int(good_cash)
        #     good_cash_q = Q(유보율__gte=value)
        #     group3_Q &= good_cash_q

        if w3:
            w3_q = Q(reasons__contains='w3') | Q(reasons__contains='3w')         ### 체크박스에 추가해야마. 대기도 포함 해야함. 
            group3_Q &= w3_q

        # group3 완료
        all_Q &= group3_Q
        
        # 종가매수 조건 추가하기.   종가매수 체크해야함. 어떤거 해야하나. 단봉 추가. 
        # if endprice:
        #     print('endprice 적용함. ') 
        #     # endprice_cond_q = Q(reasons__isnull=False)
        #     all_Q &= endprice_cond_q
        
        ## 실험실 조건 추가
        if exp:
            exp_cond_q = Q(chart_d_bb240_upper20__gte=float(exp))
            all_Q &= exp_cond_q
        ################  여기까지 all_Q #####################
        
        
        if new_listing: # 신규상장.  신규상장이 True 인것. 
            new_listing_q = Q(신규상장=True)
            chartvalues = ChartValue.objects.select_related('ticker').all()
            chartvalues = chartvalues.filter(new_listing_q)
        else:
            chartvalues = chartvalues.filter(all_Q)

        ##### query 필터링 처리 후 데이터프레임 만들기. 
        if search is not None: # 검색어가 있을때 필터링 처리.
            종목명리스트 = df_real['종목명'].tolist()
            chartvalues = chartvalues.filter(ticker__name__in=종목명리스트)
        
        else:   
            chartvalues = chartvalues.filter(all_Q)

        
        ## 필요한 데이터만 추출
        if len(chartvalues) == 0:
            return pd.DataFrame()
        print('필터된 데이터 개수 :::: ', chartvalues.count())
        ## bb240_upper20 활용해서 추세 찾을수 있을듯. 
        need_fields = [ 'date','cur_open','cur_close','pre_close','pre_vol','cur_vol','vol20', 
                       'chart_5_vol20','chart_30_vol20','chart_d_vol20',
                       'growth_y1','growth_y2','EPS','growth_q','good_buy',
                        '매물대1','매물대2','상장주식수','유동주식수','유보율','부채비율','액면가',
                        'chart_5_bb240_upper', 'chart_30_bb240_upper', 'chart_d_bb240_upper', 'chart_d_bb240_width',
                        'chart_d_bb60_upper', 'chart_d_bb60_width',
                        'chart_d_sun_width','chart_d_sun_max','chart_d_bb240_upper10','chart_d_bb240_upper20',
                        ]
        
        chart_fields = [field.name for field in ChartValue._meta.get_fields()
                        if field.name in need_fields]
        
        data = []
        for value in chartvalues:
            record = {field :getattr(value, field) for field in chart_fields}
            record['code'] = value.ticker.code
            record['name'] = value.ticker.name
            data.append(record)
        
        df_stats = pd.DataFrame(data) ## filter된 데이터 필요한 필드만 받아오기.
        ################################################################################
        
        ################## 공통 데이터 df 로 만들기. ##################
        ## 합치기 공집합
        df = pd.merge(df_real, df_stats, left_on='종목명', right_on='name', how='inner')
        print('합친데이터 개수 :::: ', len(df))
        # 시가 추정.
        df['시가'] = df['현재가'] / ( 1 + df['등락률'] /100)
        
        ## buy_price 추가하기. 
        if buy_prices is not None:
            try:
                df['buy_price'] = df['code'].map(buy_prices)
            except:
                pass
                    
        ## df 가지고 장중인지 아닌지 확인하기. 
        time_rate = StockFunc.get_progress_percentage() # 시간에 따른 비율.  실시간이 아니면 1로 특히 휴일인경우 처리해야한다. ## 수정필요함.
        time_rate = time_rate if time_rate is not None else 1
        print("time_rate :::: ", time_rate)
        if sum(df['현재가'] == df['cur_close']) == len(df): # 데이터 전체를 보고 장중이 아닌경우는 장마감기준으로 처리하기. 
            print('장중이 아님.')
            전일종가 = 'pre_close'
            전일거래량 = 'pre_vol'
            time_rate = 1
        else:
            전일종가 = 'cur_close'
            전일거래량 = 'cur_vol'
            
            # pre_close 가 전일종가임. 
            # df['pre_vol'] 이 전일 거래량임. 
            # df['pre_vol'] 이 전일 거래량임. 
            
            
        if search is not None: # 검색어가 있을때 그냥 리턴.
            return df
        if favorites: # favorite 일땐 그냥 리턴.
            return df
        if today_ai: # today_ai 일땐 그냥 리턴.
            return df
        if new_listing:
            return df
        

        ############ realtime 에서 이조건도 넣어야할까? 아직 안넣음. 고민해보자! ##############
        # sun_width_d_q = Q(chart_d_sun_width__lte=30)
        # sun_width_30_q = Q(chart_30_sun_width__lte=15)
        # sun_width_5_q = Q(chart_5_sun_width__lte=7)
        # bb240_width_d_q = chartvalues.filter(chart_d_bb240_width__lte=50)
        # bb240_width_30_q = chartvalues.filter(chart_30_bb240_width__lte=20)
        # bb240_width_5 = chartvalues.filter(chart_5_bb240_width__lte=14)

        ## 추가로 조건 생성 .... cur_close 와 pre_close 가 상황에 따라 달라짐. 
        # 5 돌파조건. 
        cond5_1 = (df['시가'] <= df['chart_5_bb240_upper']) & (df['현재가'] > df['chart_5_bb240_upper'])
        cond5_2 = (df[전일종가] <= df['chart_5_bb240_upper']) & (df['현재가'] > df['chart_5_bb240_upper'])
        # 30 돌파조건. 
        cond30_1 = (df['시가'] <= df['chart_30_bb240_upper']) & (df['현재가'] > df['chart_30_bb240_upper'])
        cond30_2 = (df[전일종가] <= df['chart_30_bb240_upper']) & (df['현재가'] > df['chart_30_bb240_upper'])
        # 일 돌파조건.  ### 요게 장중일때와 아닐때가 달라. ..........
        try:
            condd_1 = (df['시가'] <= df['chart_d_bb240_upper']) & (df['현재가'] > df['chart_d_bb240_upper'])
        except:
            condd_1 = False
        try:
            condd_2 = (df[전일종가] <= df['chart_d_bb240_upper']) & (df['현재가'] > df['chart_d_bb240_upper'])
        except:
            condd_2 = False
        #realtime 조건.
        cond_real = (cond5_1 | cond5_2) | (cond30_1 | cond30_2) | (condd_1 | condd_2)
        # df = df.loc[cond_real]
        
        # ac 조건. 
       
        cond_ac_vol1 = df['거래량'] >= df[전일거래량]  * 2 * time_rate
        cond_ac_vol2 = df['거래량'] >= df['cur_vol'] * 2 * time_rate
        cond_ac_vol3 = df['거래량'] >= df['vol20'] * 2 * time_rate
        cond_ac_vol = cond_ac_vol1 | cond_ac_vol2 | cond_ac_vol3
        cond_ac = cond_ac_vol & (df['등락률'] >=3) & (df['등락률']<=30 )
        # sun_ac 조건.  ## 
        cond_sun1 = (df['시가'] <= df['chart_d_sun_max']) & (df['현재가'] > df['chart_d_sun_max'])
        cond_sun2 = (df[전일종가] <= df['chart_d_sun_max']) & (df['현재가'] > df['chart_d_sun_max'])
        sun_ac_cond = (cond_sun1 | cond_sun2) & cond_ac_vol
        # coke_up 조건.
        cond_coke = (condd_1 | condd_2) & cond_ac_vol
        
        # 거래량 줄은 조건
        low_volume_cond =(df['거래량'] >= df['vol20'] * time_rate) & (df['거래량'] >= df['cur_vol']* time_rate)
        # 단봉조건 
        short_candle_cond = (df['등락률'] >= -2) & (df['등락률'] <= 3) # 단봉조건은 종목마다 기준이 다를수 있음. 
        
        # realtime 조건. 
        only_realtime_cond = cond_real
        if ac:
            only_realtime_cond = cond_ac & only_realtime_cond
        if sun_ac:
            ## 너비 조건 추가해야함. 
            sun_width = sun_ac
            only_realtime_cond = only_realtime_cond & sun_ac_cond
        if coke_up:
            # 너비 추가해야함. 
            coke_width = coke_up
            
            only_realtime_cond = only_realtime_cond & cond_coke
        
        # 종가매수조건 
        only_endprice_cond = low_volume_cond & short_candle_cond  # 종가매수조건은 추가로 해야한다. 위 상태에서 쿼리추가해야함. 
            
        if realtime : # 둘다. 
            df = df.loc[only_realtime_cond]
        elif endprice : # 실시간만.
            df = df.loc[only_endprice_cond]
        print(f"{len(df)}개의 데이터가 조회되었습니다.")
        return df
    
    
    def choice_for_api(newbra=None,turnarround=None,good_buy=None,consen=None, 
                       realtime=None,change_min=None, change_max=None, 
                       ac=None, array=None, goodwave=None,  ab=None, abv=None, 
                       sun_gcv=None, coke_gcv=None, sun_ac=None, coke_up=None,
                       good_cash=None, w3=None,search=None,endprice=None,exp=None,
                       array_exclude=None, new_listing=None,rsi=None,favorites=None,
                       buy_prices=False, today_ai=None,
                       **kwargs, 
                       ):
        ''' api용 추천종목 선택하기. 
        값을 받아오는 param : consen , sun_ac, sun_ac_value, bb_ac : coke_up_value
        change_min, change_max, sun_ac, coke_up, new_bra, turnarround, sun_gcv, coke_gcv
        
        실제 요청값들.
        ab: 1 abv:  1 array :  1 change_max :  8 change_min :  3 
        coke_gcv :  1 coke_up :  50 consen :  50 good_buy :  1 
        newbra :  1 realtime :  1 sun_ac :  50 sun_gcv :  1 turnarround :  1
         
        적자 = -10000, 턴어라운드 = -1000
        
        df_real : 종목명, 현재가, 등락률, 거래량
        
        # exp 값으로 가져오기 good_cash도 값으로 가져오기. 
        # new_listing은 2구룹으로 
        # realtime, endprice 추가해서 그룹 2무시하기. 그룹1을 항상 적용하게 하기.
        # 1-2, 1-3 만 적용하게 됨.
        
        '''
        print('파라미터 값들')
        print(newbra,turnarround,good_buy,consen, 
                realtime,change_min, change_max, 
                ac, array, goodwave,  ab, abv, 
                sun_gcv, coke_gcv, sun_ac, coke_up,
                good_cash, w3,search,endprice,exp,
                array_exclude, new_listing,rsi,favorites,
                buy_prices, today_ai)
        
        
        
        if kwargs:
            print("===========불필요한 데이터 요청됨 ===============")
            print(kwargs)
            print("=========================================")

        if change_min is None:
            change_min = -30
        if change_max is None:
            change_max = 30
        ############################  df_real  ##############################     
        if search is not None:
            search = search.strip()
            ## 일단 약간 지연데이터로 처리
            search_q = Q(ticker__code__contains=search) | Q(ticker__name__contains=search)
            chartvalues = ChartValue.objects.select_related('ticker').filter(search_q)
            searched_names = chartvalues.values_list('ticker__name',flat=True)
            # df_real = Api.get_df_real_from_fdr() 
            df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
            
            if len(df_real) == 0:
                df_real = Api.get_df_real_from_fdr() 
                df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
                df_real['현재가'] = df_real['현재가'].astype(float)
                df_real['매수총잔량'] = 0
                df_real['매도총잔량'] = 0

            df_real['현재가'] = pd.to_numeric(df_real['현재가'], errors='coerce')
            df_real['매수총잔량'] = 0
            df_real['매도총잔량'] = 0
        elif favorites is not None:
            user = User.objects.get(username=favorites) # user가져옴.
            buy_prices = {item.ticker.code:item.buy_price for item in user.favorites.all()}    
            print(buy_prices, 'buy_prices', type(buy_prices)) 
            # {code:buy_price, code:buy_price, ...}
            if buy_prices:
                chartvalues = ChartValue.objects.filter(ticker__in=buy_prices.keys())
            else:
                return pd.DataFrame()
                
            searched_names = chartvalues.values_list('ticker__name',flat=True)
            change_min, change_max = -30, 30
            df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
            if len(df_real) == 0:
                df_real = Api.get_df_real_from_fdr() 
                df_real = df_real.loc[df_real['종목명'].isin(searched_names)]
                df_real['현재가'] = df_real['현재가'].astype(float)
                df_real['매수총잔량'] = 0
                df_real['매도총잔량'] = 0
        
        elif today_ai:
            '''
            today_ai 도 숫자로 값을 받음.   
            '''
            change_min, change_max = -30, 30
            df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            chartvalues = ChartValue.objects.select_related('ticker').all()
            # q = AiOpinionForStock.get_today_data()
            q = AiOpinionForStock.get_nth_latest_data(n=int(today_ai))
            today_tickers = [item.ticker for item in q]
            chartvalues = chartvalues.filter(ticker__in=today_tickers)

        # elif new_listing:
        #     change_min, change_max = -30, 30
        #     chartvalues = ChartValue.objects.select_related('ticker').all()
        #     df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)

        else:
            try:
                df_real = GetData.get_realtime_data(change_min=change_min, change_max=change_max)
            except:
                df_real = Api.get_df_real_from_db(change_min=change_min, change_max=change_max)
            chartvalues = ChartValue.objects.select_related('ticker').all()

        # 모든 필드를 필터링하여 chart_fields 생성
        chart_fields = [field.name for field in ChartValue._meta.get_fields()]

        # 조건에 따라 필터링 (예: 필드 이름이 '필드1', '필드2' 포함)
        # filtered_fields = [field for field in chart_fields if field in need_fields]
        filtered_fields = [field for field in chart_fields]

        # chartvalues에서 데이터 수집
        data = [
            {
                **{field: getattr(value, field) for field in filtered_fields},  # 필터링된 필드 값
                'code': value.ticker.code,  # ticker의 code 추가
                'name': value.ticker.name    # ticker의 name 추가
            }
            for value in chartvalues
        ]

        '''
        ['종목명', '현재가', '등락률', '거래량', '매수총잔량', '매도총잔량', 'id', 'ticker', 'date',
       'cur_close', 'cur_open', 'pre_close', 'pre_open', 'growth_y1',
       'growth_y2', 'growth_q', 'good_buy', 'chart_d_bb60_upper20',
       'chart_d_bb60_upper10', 'chart_d_bb60_upper', 'chart_d_bb60_width',
       'chart_d_bb240_upper20', 'chart_d_bb240_upper10', 'chart_d_bb240_upper',
       'chart_d_bb240_width', 'chart_d_sun_width', 'chart_d_sun_max',
       'chart_d_new_phase', 'chart_d_ab', 'chart_d_ab_v', 'chart_d_good_array',
       'chart_d_bad_array', 'cur_vol', 'pre_vol', 'chart_d_vol20', 'vol20',
       'reasons', 'reasons_30', 'chart_30_bb60_upper20',
       'chart_30_bb60_upper10', 'chart_30_bb60_upper', 'chart_30_bb60_width',
       'chart_30_bb240_upper20', 'chart_30_bb240_upper10',
       'chart_30_bb240_upper', 'chart_30_bb240_width', 'chart_30_sun_width',
       'chart_30_sun_max', 'chart_30_new_phase', 'chart_30_ab',
       'chart_30_ab_v', 'chart_30_good_array', 'chart_30_bad_array',
       'chart_30_vol20', 'chart_5_bb60_upper20', 'chart_5_bb60_upper10',
       'chart_5_bb60_upper', 'chart_5_bb60_width', 'chart_5_bb240_upper20',
       'chart_5_bb240_upper10', 'chart_5_bb240_upper', 'chart_5_bb240_width',
       'chart_5_sun_width', 'chart_5_sun_max', 'chart_5_new_phase',
       'chart_5_ab', 'chart_5_ab_v', 'chart_5_good_array', 'chart_5_bad_array',
       'chart_5_vol20', '유보율', '부채비율', '액면가', 'cash_value', 'EPS', '상장주식수',
       '유동주식수', '매물대1', '매물대2', '신규상장', 'code', 'name', '시가'],
        '''
        
        df_stats = pd.DataFrame(data) ## filter된 데이터 필요한 필드만 받아오기.

        df = pd.merge(df_real, df_stats, left_on='종목명', right_on='name', how='inner')
        print('합친데이터 개수 :::: ', len(df))
        # 시가 추정.
        df['시가'] = df['현재가'] / ( 1 + df['등락률'] /100)


        ## df 가지고 장중인지 아닌지 확인하기. 
        time_rate = StockFunc.get_progress_percentage() # 시간에 따른 비율.  실시간이 아니면 1로 특히 휴일인경우 처리해야한다. ## 수정필요함.
        time_rate = time_rate if time_rate is not None else 1
        print("time_rate :::: ", time_rate)
        if sum(df['현재가'] == df['cur_close']) == len(df): # 데이터 전체를 보고 장중이 아닌경우는 장마감기준으로 처리하기. 
            print('장중이 아님.')
            전일종가 = 'pre_close'
            전일거래량 = 'pre_vol'
            time_rate = 1
        else:
            전일종가 = 'cur_close'
            전일거래량 = 'cur_vol'
            
            # pre_close 가 전일종가임. 
            # df['pre_vol'] 이 전일 거래량임. 
            # df['pre_vol'] 이 전일 거래량임. 


        try:
            df['buy_price'] = df['code'].map(buy_prices)
        except:
           pass
           
           
        if today_ai:
            return df
        
        if favorites:
            if buy_prices:
                df = df.loc[df['code'].isin(buy_prices.keys())]
                return df
            else:
                return pd.DataFrame()
            
        
        
        # group1 cond = 
        row_cond = pd.Series([False] * len(df))
        if newbra:
            new_bra_cond = df['chart_d_new_phase'] == True
            row_cond = row_cond | new_bra_cond
            print('newbra 적용.')
        if turnarround:
            turnarround_cond = df['growth_y1'] == -1000
            row_cond = row_cond | turnarround_cond
            print('ta 적용.')
        if good_buy:
            good_buy_cond = df['good_buy'] > 0
            row_cond = row_cond | good_buy_cond
            print('good_buy 적용.')
        if consen:
            consen_cond = df['growth_y1'] >= consen
            row_cond = row_cond | consen_cond
            print('consen 적용.')
            
            
        if good_cash:
            good_cash_cond = df['유보율'] >= int(good_cash)
            df = df.loc[good_cash_cond]
            print('good_cash 적용.')
        
        if rsi:
            rsi_cond = df['reasons'].str.contains('rsi')
            df = df.loc[rsi_cond]
            print('rsi 적용.')
        if array:
            array_cond = df['chart_d_good_array'] == True
            df = df.loc[array_cond]
            print('array 적용.')
        if array_exclude:
            array_exclude_cond = df['chart_d_bad_array'] == False
            df = df.loc[array_exclude_cond]
            print('array_exclude 적용.')
        
        if goodwave:
            goodwave_cond = df['reasons'].str.contains('is_w20_3w')
            df = df.loc[goodwave_cond]
            print('goodwave 적용.')
          # pre_close 가 전일종가임. 
            # df['pre_vol'] 이 전일 거래량임. 
            # df['pre_vol'] 이 전일 거래량임. 
        if ac:
            ac_cond = (df['등락률'] >=2) & (df['등락률'] <=8)
            ac_vol_cond = (df['거래량'] >= df['pre_vol']  * 2 * time_rate) 
            df = df.loc[ac_cond & ac_vol_cond]
            print('ac 적용.')
        if coke_up:
            coke_cond = df['chart_d_bb240_width'] <= coke_up
            up_cond = (df['시가'] < df['chart_d_bb240_upper']) & (df['chart_d_bb240_upper'] < df['현재가'])    
            df = df.loc[coke_cond & up_cond]
            print('coke_up 적용.')
        
        if sun_ac:
            sun_cond = df['chart_d_sun_width'] <= sun_ac    
            up_cond = (df['시가'] < df['chart_d_sun_max']) & (df['chart_d_sun_max'] < df['현재가'])
            df = df.loc[sun_cond & up_cond]
            print('sun_ac 적용.')

        if ab:
            ab_cond = df['chart_d_ab'] == True
            df = df.loc[ab_cond]
            print('ab 적용.')
        if abv:
            abv_cond = df['chart_d_ab_v'] == True
            df = df.loc[abv_cond]
            print('abv 적용.')
        
        
        if sun_gcv:
            cond_ac_vol1 = df['거래량'] >= df[전일거래량]  * 2 * time_rate
            cond_ac_vol2 = df['거래량'] >= df['cur_vol'] * 2 * time_rate
            cond_ac_vol3 = df['거래량'] >= df['vol20'] * 2 * time_rate
            cond_ac_vol = cond_ac_vol1 | cond_ac_vol2 | cond_ac_vol3
            cond_ac = cond_ac_vol & (df['등락률'] >=3) & (df['등락률']<=30 )
            df = df.loc[cond_ac]
            print('sun_gcv 적용.')
            
        if exp:
            # '''exp 값으로 받아오기.'''
            exp_cond10 = df['chart_d_bb240_upper10'] >= float(exp)
            exp_cond20 = df['chart_d_bb240_upper20'] >= float(exp)
            df = df.loc[exp_cond10 & exp_cond20]
            print('exp 적용.')
        
        if new_listing:
            new_listing_cond = df['신규상장'] == True
            df = df.loc[new_listing_cond]
            print('new_listing 적용.')
        
        if search is not None:
            cond1 = df['종목명'].str.contains(search)
            cond2 = df['code'].str.contains(search)
            df = df.loc[cond1 | cond2]
            print('search 적용.')
            return df
        
        
        if endprice:
            # 거래량 줄은 조건
            low_volume_cond =(df['거래량'] >= df['vol20'] * time_rate) & (df['거래량'] >= df['cur_vol']* time_rate)
            # 단봉조건 
            short_candle_cond = (df['등락률'] >= -2) & (df['등락률'] <= 3) # 단봉조건은 종목마다 기준이 다를수 있음. 
            
            w20_3w_cond = df['reasons'].str.contains('is_w20_3w')
            gcv_cond = df['reasons'].str.contains('sun_gcv|coke_gcv')
            
            good_status_cond = w20_3w_cond | gcv_cond
            df = df.loc[low_volume_cond & short_candle_cond & good_status_cond]
            print('endprice 적용.')

        if realtime:
            cond5_1 = (df['시가'] <= df['chart_5_bb240_upper']) & (df['현재가'] > df['chart_5_bb240_upper'])
            cond5_2 = (df[전일종가] <= df['chart_5_bb240_upper']) & (df['현재가'] > df['chart_5_bb240_upper'])
            # 30 돌파조건. 
            cond30_1 = (df['시가'] <= df['chart_30_bb240_upper']) & (df['현재가'] > df['chart_30_bb240_upper'])
            cond30_2 = (df[전일종가] <= df['chart_30_bb240_upper']) & (df['현재가'] > df['chart_30_bb240_upper'])
            # 일 돌파조건.  ### 요게 장중일때와 아닐때가 달라. ..........
            try:
                condd_1 = (df['시가'] <= df['chart_d_bb240_upper']) & (df['현재가'] > df['chart_d_bb240_upper'])
            except:
                condd_1 = False
            try:
                condd_2 = (df[전일종가] <= df['chart_d_bb240_upper']) & (df['현재가'] > df['chart_d_bb240_upper'])
            except:
                condd_2 = False
            #realtime 조건.
            df = df.loc[(cond5_1 | cond5_2) | (cond30_1 | cond30_2) | (condd_1 | condd_2)]


            w20_3w_cond = df['reasons'].str.contains('is_w20_3w')
            gcv_cond = df['reasons'].str.contains('sun_gcv|coke_gcv')
            w3_cond = df['reasons'].str.contains('w3|3w')
            common_cond = w20_3w_cond | gcv_cond | w3_cond
            df = df.loc[common_cond]
            print('realtime 적용.')
            
            
        
        return df
    
        
        # ['is_sun_ac','is_w20_3w','is_coke_ac','is_coke_gcv240','is_coke_gcv60',
        #  'is_new_phase','is_w3_ac','is_rsi','is_multi_through']
        
   
        
        
        ## 필요한 데이터만 추출
        if len(chartvalues) == 0:
            return pd.DataFrame()
        print('필터된 데이터 개수 :::: ', chartvalues.count())
        ## bb240_upper20 활용해서 추세 찾을수 있을듯. 
        need_fields = [ 'date','cur_open','cur_close','pre_close','pre_vol','cur_vol','vol20', 
                       'chart_5_vol20','chart_30_vol20','chart_d_vol20',
                       'growth_y1','growth_y2','EPS','growth_q','good_buy',
                        '매물대1','매물대2','상장주식수','유동주식수','유보율','부채비율','액면가',
                        'chart_5_bb240_upper', 'chart_30_bb240_upper', 'chart_d_bb240_upper', 'chart_d_bb240_width',
                        'chart_d_bb60_upper', 'chart_d_bb60_width',
                        'chart_d_sun_width','chart_d_sun_max','chart_d_bb240_upper10','chart_d_bb240_upper20',
                        ]
        
        chart_fields = [field.name for field in ChartValue._meta.get_fields()
                        if field.name in need_fields]
        
        data = []
        for value in chartvalues:
            record = {field :getattr(value, field) for field in chart_fields}
            record['code'] = value.ticker.code
            record['name'] = value.ticker.name
            data.append(record)
        
        df_stats = pd.DataFrame(data) ## filter된 데이터 필요한 필드만 받아오기.
        ################################################################################
        
        ################## 공통 데이터 df 로 만들기. ##################
        ## 합치기 공집합
        df = pd.merge(df_real, df_stats, left_on='종목명', right_on='name', how='inner')
        print('합친데이터 개수 :::: ', len(df))
        # 시가 추정.
        df['시가'] = df['현재가'] / ( 1 + df['등락률'] /100)
        

        ############ realtime 에서 이조건도 넣어야할까? 아직 안넣음. 고민해보자! ##############
        # sun_width_d_q = Q(chart_d_sun_width__lte=30)
        # sun_width_30_q = Q(chart_30_sun_width__lte=15)
        # sun_width_5_q = Q(chart_5_sun_width__lte=7)
        # bb240_width_d_q = chartvalues.filter(chart_d_bb240_width__lte=50)
        # bb240_width_30_q = chartvalues.filter(chart_30_bb240_width__lte=20)
        # bb240_width_5 = chartvalues.filter(chart_5_bb240_width__lte=14)

        ## 추가로 조건 생성 .... cur_close 와 pre_close 가 상황에 따라 달라짐. 
        # 5 돌파조건. 
        
    

if __name__ == "__main__":
    DBUpdater.update_ticker()


# ac
# goodwave
# sun_ac
# coke_up
# exp
# search = '삼성전자' 작동안함. 
# sun_gcv 는 없음. 
# coke_gcv 는 없음.
