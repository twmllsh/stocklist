from django.contrib import admin
from .models import Ticker

class TickerAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', '구분')
    search_fields = ('code', 'name', '구분')
    list_filter = ('구분',)

admin.site.register(Ticker, TickerAdmin)