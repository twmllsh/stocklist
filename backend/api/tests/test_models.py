from django.test import TestCase
from api.models import *

class MyModelTests(TestCase):
    def test_my_model_creation(self):
        my_object = Ticker.objects.create(code='000000', name="test")
        self.assertEqual(my_object.name, "test")

