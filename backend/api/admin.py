from django.contrib import admin
from django.utils.html import format_html
from .models import *

@admin.register(Ticker)
class TickerAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', '구분') # 
    search_fields = ('code', 'name', '구분')
    list_filter = ('구분',)

@admin.register(Info)
class InfoAdmin(admin.ModelAdmin):
    list_display = ('ticker', '업종', '액면가','외국인소진율', '외국인보유비중',
                    '상장주식수', '유동주식수','유동비율','EPS','PER','PBR','배당수익률')
    search_fields = ('ticker', )
    # list_filter = ('외국인소진율',)
    ordering = ('ticker','외국인소진율')

@admin.register(ChangeLog)
class ChangeLogAdmin(admin.ModelAdmin):
    list_display = ('ticker', 'change_date', 'change_field', 'gb',
                    'old_value', 'new_value')
    search_fields = ('ticker',)
    list_filter = ('change_date',)

@admin.register(Iss)
class IssAdmin(admin.ModelAdmin):
    list_display = ( 'issn', 'iss_str', 'link_to_detail', 'regdate', )
    search_fields = ('issn','iss_str')
    list_filter = ('regdate',)
    
    def link_to_detail(self, obj):
        return format_html('<a href="{}" target="_blank">{}</a>', obj.hl_cont_url, obj.hl_str)

@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = ('link_to_detail', 'createdAt', 'writerName', )
    search_fields = ('link_to_detail',)
    list_filter = ('createdAt',)
    
    def link_to_detail(self, obj):
        link_add = f"https://news.stockplus.com/m?news_id={obj.no}"
        return format_html('<a href="{}" target="_blank">{}</a>', link_add, obj.title)


@admin.register(ChartValue)
class ChartValueAdmin(admin.ModelAdmin):
    list_display = ('ticker', 'growth_y1', 'growth_y2', 'growth_q', 'good_buy',
                    'chart_d_bb240_upper20', 'chart_d_bb240_upper10', 'chart_d_bb240_upper', 
                    'chart_d_bb240_width', 'chart_d_sun_width','chart_d_sun_max', 
                    'chart_d_new_phase', 'chart_d_ab', 'chart_d_ab_v', 'reasons',
                    '신규상장', '매물대1','매물대2','cur_close', 'date',)
    search_fields = ('ticker', )
    list_filter = ('date','growth_y1','chart_d_bb240_upper20', 'chart_d_bb240_upper10', 'chart_d_bb240_upper', 
                    'chart_d_bb240_width', 'chart_d_sun_width','chart_d_sun_max','신규상장')


@admin.register(DartContract)
class DartContractAdmin(admin.ModelAdmin):
    list_display = ('ticker', '계약내용', '계약금액','매출액대비', '계약상대방', '공급지역', 
                    '계약기간_시작', '계약기간_종료', '계약기간일', '계약일', )
    search_fields = ('ticker', '계약내용', '계약상대방', '공급지역', )
    list_filter = ('계약일', )

@admin.register(DartRightsIssue)
class DartRightsIssueAdmin(admin.ModelAdmin):
    list_display = ('ticker', '증자방식', '신주의수', '신주비율', '발행가액', '제3자배정대상자',
                    '자금조달목적', '상장예정일', '제3자배정대상자관계',"name" )
    search_fields = ('ticker', '제3자배정대상자', 'name', 'stock_code', 'issue_date', 'issue_type', 'issue_reason')
    list_filter = ('상장예정일', 'rcept_dt', )


@admin.register(DartConvertibleBond)     
class DartConvertibleBondAdmin(admin.ModelAdmin):
    list_display = ('ticker', '전환사채총액', '자금조달목적', '표면이자율', '만기이자율', '전환가액',
                    '전환청구시작일', '전환청구종료일', '발행주식수', '주식총수대비비율', 'name')
    search_fields = ('ticker', 'name', )
    list_filter = ('전환청구시작일', 'rcept_dt', ) 

@admin.register(DartBonusIssue)
class DartBonusIssueAdmin(admin.ModelAdmin):
    list_display = ('ticker', '신주의수', '주당배정주식수', '배당기산일', '상장예정일', 'rcept_dt','name',)
    search_fields = ('ticker', 'name', '주당배정주식수', )
    list_filter = ('상장예정일', )
    