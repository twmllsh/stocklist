from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    MEMBERSHIP_CHOICES = (
        ('SPECIAL', '특별회원'),
        ('REGULAR', '정회원'),
        ('ASSOCIATE', '준회원'),
    )
    
    membership = models.CharField(
        max_length=10,
        choices=MEMBERSHIP_CHOICES,
        default='ASSOCIATE',  # 기본값은 준회원
        verbose_name='회원등급'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.username})"

