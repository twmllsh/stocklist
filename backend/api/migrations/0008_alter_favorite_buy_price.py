# Generated by Django 5.1.1 on 2025-02-25 20:36

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_favorite_buy_price'),
    ]

    operations = [
        migrations.AlterField(
            model_name='favorite',
            name='buy_price',
            field=models.FloatField(blank=True, default=0, null=True),
        ),
    ]
