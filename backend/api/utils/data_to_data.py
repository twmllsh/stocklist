from api.models import *

from django.db import transaction


def data_to_data():

    source_tickers = Ticker.objects.using('product').all()
    source_news = News.objects.using('product').all()
    
    with transaction.atomic(using='default'):
        for ticker in source_tickers:
            new_ticker_data = {}
            for field in Ticker._meta.fields:
                new_ticker_data[field.name] = getattr(ticker, field.name)
            new_ticker = Ticker(**new_ticker_data)
            
            new_ticker.save(using='default')
            
            
        
        for news in source_news.all():
            new_news_data = {}
            try:
                for field in News._meta.fields:
                    new_news_data[field.name] = getattr(news, field.name)
                new_news = News(**new_news_data)
                
                new_news.save(using='default')
            except:
                continue
            # 다대다 관계설정
            for ticker in news.tickers.all():
                new_ticker, _ = Ticker.objects.using('default').get_or_create(id=ticker.id)
                new_news.tickers.add(new_ticker)
        
        
            