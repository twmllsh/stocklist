# Generated by Django 5.1.1 on 2025-03-12 03:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_dartbonusissue_rcept_no_dartcontract_rcept_no_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='aiopinionforstock',
            name='close',
            field=models.FloatField(null=True),
        ),
    ]
