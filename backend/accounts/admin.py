from django.contrib import admin

# Register your models here.
from .models import User
from django.contrib import messages
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'membership', 'created_at', 'updated_at','last_login')
    search_fields = ('username', 'name', '구분')
    list_filter = ('username','membership','created_at','updated_at')
    actions = ['upgrade_to_regular']
    
    def upgrade_to_regular(self, request, queryset):
        updated = queryset.update(membership='REGULAR')
        self.message_user(
            request,
            f'{updated}명의 회원이 정회원으로 승격되었습니다.',
            messages.SUCCESS
        )
    upgrade_to_regular.short_description = '선택된 회원을 정회원으로 승격'
    
admin.site.register(User, UserAdmin)