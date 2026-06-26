from django.urls import path
from . import views

urlpatterns = [
    path('personas/', views.persona_list_create, name='persona-list-create'),
    path('personas/sync/', views.sync_local_to_cloud, name='persona-sync'),
    path('personas/<int:pk>/', views.persona_detail, name='persona-detail'),
]