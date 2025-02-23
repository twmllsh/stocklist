from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    MEMBERSHIP_CHOICES = (
        ('REGULAR', '정회원'),
        ('ASSOCIATE', '준회원'),
    )
    
    membership = models.CharField(
        max_length=10,
        choices=MEMBERSHIP_CHOICES,
        default='ASSOCIATE',
        verbose_name='회원등급'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '사용자'
        verbose_name_plural = '사용자 목록'

    def __str__(self):
        return f"{self.username})"

