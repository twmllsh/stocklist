from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken  # 추가
from django.utils import timezone
from django.contrib.auth import get_user_model
from .serializers import UserSerializer, CustomTokenObtainPairSerializer
import pytz

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            # 로그인 성공 시 last_login을 한국 시간으로 업데이트
            seoul_tz = pytz.timezone('Asia/Seoul')
            user = User.objects.get(username=request.data.get('username'))
            user.last_login = timezone.now().astimezone(seoul_tz)
            user.save(update_fields=['last_login'])
        return response
    
    
    
    
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        # 회원가입 시 준회원으로 시작
        user.membership = 'ASSOCIATE'
        user.save()
        
        # JWT 토큰 생성
        token = CustomTokenObtainPairSerializer.get_token(user)
        
        return Response({
            'access': str(token.access_token),
            'refresh': str(token),
            'user': {
                'username': user.username,
                'email': user.email,
                'membership': user.membership
            }
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response(
            {'detail': '로그아웃 되었습니다.'}, 
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {'detail': str(e)}, 
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upgrade_membership(request):
    user = request.user
    if user.membership == 'ASSOCIATE':
        user.membership = 'REGULAR'
        user.save()
        return Response({'detail': '정회원으로 승격되었습니다.'})
    return Response({'detail': '이미 정회원입니다.'})
