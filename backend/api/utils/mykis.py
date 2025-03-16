import os
import pandas as pd
import mojito


output_dict1 = {
'output1':'응답상세1',	#Object Array	Y		Array
'pdno':'상품번호',	#String	Y	12	종목번호(뒷 6자리)
'prdt_name':'상품명',	#String	Y	60	종목명
'trad_dvsn_name':'매매구분명',	#String	Y	60	매수매도구분
'bfdy_buy_qty':'전일매수수량',	#String	Y	10	
'bfdy_sll_qty':'전일매도수량',	#String	Y	10	
'thdt_buyqty':'금일매수수량',	#String	Y	10	
'thdt_sll_qty':'금일매도수량',	#String	Y	10	
'hldg_qty':'보유수량',	#String	Y	19	
'ord_psbl_qty':'주문가능수량',	#String	Y	10	
'pchs_avg_pric':'매입평균가격',	#String	Y	22	매입금액 / 보유수량
'pchs_amt':'매입금액',	#String	Y	19	
'prpr':'현재가',	#String	Y	19	
'evlu_amt':'평가금액',	#String	Y	19	
'evlu_pfls_amt':'평가손익금액',	#String	Y	19	평가금액 - 매입금액
'evlu_pfls_rt':'평가손익율',	#String	Y	9	
'evlu_erng_rt':'평가수익율',	#String	Y	31	미사용항목(0으로 출력)
'loan_dt':'대출일자',	#String	Y	8	INQR_DVSN(조회구분)을 01(대출일별)로 설정해야 값이 나옴
'loan_amt':'대출금액',	#String	Y	19	
'stln_slng_chgs':'대주매각대금',	#String	Y	19	
'expd_dt':'만기일자',	#String	Y	8	
'fltt_rt':'등락율',	#String	Y	31	
'bfdy_cprs_icdc':'전일대비증감',	#String	Y	19	
'item_mgna_rt_name':'종목증거금율명',	#String	Y	20	
'grta_rt_name':'보증금율명',	#String	Y	20	
'sbst_pric':'대용가격',	#String	Y	19	증권매매의 위탁보증금으로서 현금 대신에 사용되는 유가증권 가격
'stck_loan_unpr':'주식대출단가',	#String	Y	22	
}
output_dict2 = {
'output2':'응답상세2',	#Object Array	Y		Array
'dnca_tot_amt':'예수금총금액',	#String	Y	19	예수금
'nxdy_excc_amt':'익일정산금액',	#String	Y	19	D+1 예수금
'prvs_rcdl_excc_amt':'가수도정산금액',	#String	Y	19	D+2 예수금
'cma_evlu_amt':'CMA평가금액',	#String	Y	19	
'bfdy_buy_amt':'전일매수금액',	#String	Y	19	
'thdt_buy_amt':'금일매수금액',	#String	Y	19	
'nxdy_auto_rdpt_amt':'익일자동상환금액',	#String	Y	19	
'bfdy_sll_amt':'전일매도금액',	#String	Y	19	
'thdt_sll_amt':'금일매도금액',	#String	Y	19	
'd2_auto_rdpt_amt':'D+2자동상환금액',	#String	Y	19	
'bfdy_tlex_amt':'전일제비용금액',	#String	Y	19	
'thdt_tlex_amt':'금일제비용금액',	#String	Y	19	
'tot_loan_amt':'총대출금액',	#String	Y	19	
'scts_evlu_amt':'유가평가금액',	#String	Y	19	
'tot_evlu_amt':'총평가금액',	#String	Y	19	유가증권 평가금액 합계금액 + D+2 예수금
'nass_amt':'순자산금액',	#String	Y	19	
'fncg_gld_auto_rdpt_yn':'융자금자동상환여부',	#String	Y	1	보유현금에 대한 융자금만 차감여부신용융자 매수체결 시점에서는 융자비율을 매매대금 100%로 계산 하였다가 수도결제일에 보증금에 해당하는 금액을 고객의 현금으로 충당하여 융자금을 감소시키는 업무
'pchs_amt_smtl_amt':'매입금액합계금액',	#String	Y	19	
'evlu_amt_smtl_amt':'평가금액합계금액',	#String	Y	19	유가증권 평가금액 합계금액
'evlu_pfls_smtl_amt':'평가손익합계금액',	#String	Y	19	
'tot_stln_slng_chgs':'총대주매각대금',	#String	Y	19	
'bfdy_tot_asst_evlu_amt':'전일총자산평가금액',	#String	Y	19	
'asst_icdc_amt':'자산증감액',	#String	Y	19	
'asst_icdc_erng_rt':'자산증감수익율',	#String	Y	31	데이터 미제공
}


class KIS:
    
    def __init__(self):
        '''
        mystock_cnt: 보유종목 개수 에 따라서 비율로 주문하기. 
        
        '''
        self.총보유예정개수 = 3
        api_key = os.getenv("KIS_APP_KEY")
        api_secret = os.getenv("KIS_APP_SECRET")
        acc_no = os.getenv("KIS_ACC_NO")
        user_id = os.getenv("KIS_USER_ID")
        self.broker = mojito.KoreaInvestment(
            api_key=api_key,
            api_secret=api_secret,
            acc_no=acc_no
        )
        self.mystock = self.get_mystock_codes()
        
    def get_balace(self):
        balance = self.broker.fetch_balance()
        output1 = balance['output1']
        output2 = balance['output2']
        mystock = pd.DataFrame(output1)
        self.mystock = mystock.rename(columns=output_dict1)
        mybalance = pd.DataFrame(output2)
        self.mybalance = mybalance.rename(columns=output_dict2)
        
        self.총평가금액 = int(self.mybalance['총평가금액'].values[0])
        return self.mystock, self.mybalance
    
    def get_mystock_codes(self):
        self.get_balace()
        self.mystock = self.mystock[['상품번호','상품명','평가손익율','평가손익금액','주문가능수량']].to_dict('records')
        self.mystock_cnt =  len(self.mystock)
        return self.mystock    
    
    def sell_stock(self, stock_code, percent= 100):
        the_list = [item for item in self.mystock if item['상품번호'] == stock_code]
        if not the_list:
            print('해당 종목을 보유하고 있지 않습니다.')
            return
        the_dict = the_list[0]
        
        보유수량 = int(the_dict['주문가능수량'])
        if 보유수량 == 0:
            print('주문가능수량이 없습니다.')
            return
        QUANTITY = int(보유수량 * percent / 100)
        if QUANTITY == 0:
            QUANTITY = 보유수량
        # price = self.broker.fetch_price(symbol=stock_code)
        # curr_price = price['output']['stck_prpr']
        
        resp = self.broker.create_market_sell_order(
        symbol=stock_code,
        quantity=QUANTITY,
)
        if resp['rt_cd'] == '0':
            print(f'{stock_code} {QUANTITY}주 매도 완료')
            self.mystock = self.get_mystock_codes()
        else:
            print(f'{stock_code} {QUANTITY}주 매도 실패')
            print("요청 실패 메세지", resp['msg1'])
    
    def buy_stock(self, stock_code):
        
        예수금 = int(self.mybalance['예수금총금액'].values[0])
        price = self.broker.fetch_price(symbol=stock_code)
        curr_price = int(price['output']['stck_prpr'])
        if curr_price >= 예수금:
            print('예수금이 부족합니다.')
            return
        if self.mystock_cnt >= self.총보유예정개수:
            print('보유종목이 3개 이상입니다.')
            return
        else:
            buyprice = 1 / self.총보유예정개수 *  self.총평가금액
            
        QUANTITY = int(buyprice / curr_price * 0.995)
        if QUANTITY > 0:
            resp = self.broker.create_market_buy_order(
            symbol=stock_code,
            quantity=QUANTITY,
            )
            if resp['rt_cd'] == '0':
                print(f'{stock_code} {QUANTITY}주 매수 완료')
                self.mystock = self.get_mystock_codes()
                
            else:
                print(f'{stock_code} {QUANTITY}주 매수 실패')
                print(resp['msg1']) 
    
    def take_profit(self):
        '''
        수익실현 자동 매도
        '''
        
        for stock in self.mystock:
            if float(stock['평가손익율']) >= 15:
                self.sell_stock(stock['상품번호'], percent=50)
                print(f"{stock['상품명']} 15% 이상 수익실현 성공")
                self.mystock = self.get_mystock_codes()
            else:
                print(f"{stock['상품명']} 현재 {stock['평가손익율']}% 수익실현 실패")