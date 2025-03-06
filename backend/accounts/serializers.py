from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        data['membership'] = self.user.membership
        return data

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password', 'membership')
        read_only_fields = ('membership',)

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

    def validate_email(self, value):
        email_validator = EmailValidator(message='이메일을 정확하게 입력해주세요.')
        try:
            email_validator(value)
        except ValidationError as e:
            raise serializers.ValidationError(str(e))

        # 이메일 중복 체크
        if self.Meta.model.objects.filter(email=value).exists():
            raise serializers.ValidationError('이미 등록된 이메일입니다.')
        
        return value
