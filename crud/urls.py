from django.urls import path
from . import views

urlpatterns = [
    path('personas/', views.persona_list_create, name='persona-list-create'),
    path('personas/<int:pk>/', views.persona_detail, name='persona-detail'),
]