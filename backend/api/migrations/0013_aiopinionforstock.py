# Generated by Django 5.1.1 on 2025-03-01 12:35

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_aiopinion_ai_method'),
    ]

    operations = [
        migrations.CreateModel(
            name='AiOpinionForStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('opinion', models.CharField(max_length=4)),
                ('reason', models.TextField()),
                ('ai_method', models.CharField(max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('ticker', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='api.ticker')),
            ],
        ),
    ]
