# from rest_framework.test import APITestCase
# from rest_framework import status
# from django.urls import reverse
# from accounts.models import User
# from api.models import AiOpinion

# class AiOpinionAPITest(APITestCase):
#     def setUp(self):
#         # 테스트 사용자 생성
#         self.user = User.objects.create_user(
#             username='testuser',
#             password='testpass123',
#             membership='REGULAR'
#         )
        
#         # 테스트용 AI 의견 생성
#         self.ai_opinion = AiOpinion.objects.create(
#             opinion="매수",
#             reason="테스트용 매수 이유",
#             ai_method="GPT-4"
#         )
        
#         # 인증 설정
#         self.client.force_authenticate(user=self.user)
        
#         # API URL 설정
#         self.list_url = reverse('api:aiopinion-list')
#         self.detail_url = reverse('api:aiopinion-detail', kwargs={'pk': self.ai_opinion.pk})

#     def test_get_ai_opinions(self):
#         """AI 의견 목록 조회 테스트"""
#         response = self.client.get(self.list_url)
        
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(len(response.data), 1)
#         self.assertEqual(response.data[0]['opinion'], "매수")
#         self.assertEqual(response.data[0]['ai_method'], "GPT-4")

#     def test_create_ai_opinion(self):
#         """새로운 AI 의견 생성 테스트"""
#         data = {
#             'opinion': "매도",
#             'reason': "테스트용 매도 이유",
#             'ai_method': "GPT-4"
#         }
        
#         response = self.client.post(self.list_url, data)
        
#         self.assertEqual(response.status_code, status.HTTP_201_CREATED)
#         self.assertEqual(AiOpinion.objects.count(), 2)
#         self.assertEqual(response.data['opinion'], "매도")

#     def test_get_ai_opinion_detail(self):
#         """특정 AI 의견 상세 조회 테스트"""
#         response = self.client.get(self.detail_url)
        
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['opinion'], "매수")
#         self.assertEqual(response.data['ai_method'], "GPT-4")

#     def test_update_ai_opinion(self):
#         """AI 의견 수정 테스트"""
#         data = {
#             'opinion': "매도",
#             'reason': "수정된 매도 이유",
#             'ai_method': "GPT-4"
#         }
        
#         response = self.client.put(self.detail_url, data)
        
#         self.assertEqual(response.status_code, status.HTTP_200_OK)
#         self.assertEqual(response.data['opinion'], "매도")
#         self.assertEqual(response.data['reason'], "수정된 매도 이유")

#     def test_delete_ai_opinion(self):
#         """AI 의견 삭제 테스트"""
#         response = self.client.delete(self.detail_url)
        
#         self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
#         self.assertEqual(AiOpinion.objects.count(), 0)

#     def test_unauthorized_access(self):
#         """비인증 사용자 접근 테스트"""
#         self.client.force_authenticate(user=None)
#         response = self.client.get(self.list_url)
        
#         print("응답 상태:", response.status_code)  # 디버깅용
#         print("응답 데이터:", getattr(response, 'data', None))  # 디버깅용
        
#         self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        
#     def test_associate_member_access(self):
#         """준회원 접근 테스트"""
#         associate_user = User.objects.create_user(
#             username='associate',
#             password='pass123',
#             membership='ASSOCIATE'
#         )
#         self.client.force_authenticate(user=associate_user)
        
#         response = self.client.get(self.list_url)
#         self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)