import pickle
import pandas as pd
from api.models import Iss, News
with open('news.pkl', 'rb') as f:
    news_data = pickle.load(f)

pre_news_data = News.objects.all()
pre_df = pd.DataFrame(list(pre_news_data.values()))



    