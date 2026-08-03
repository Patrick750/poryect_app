from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Persona
from .serializers import PersonaSerializer

def notify_websocket_clients(action_type, data=None):
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "personas_group",
                {
                    "type": "persona_update",
                    "data": {
                        "action": action_type,
                        "data": data
                    }
                }
            )
    except Exception as e:
        print("WebSocket notify error:", e)


@api_view(['GET', 'POST'])
def persona_list_create(request):
    if request.method == 'GET':
        personas = Persona.objects.all()
        serializer = PersonaSerializer(personas, many=True)
        return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = PersonaSerializer(data=request.data)
        if serializer.is_valid():
            persona = serializer.save()
            notify_websocket_clients('REFRESH')
            return Response({'id': persona.id, 'status': 'created'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH', 'PUT', 'DELETE'])
def persona_detail(request, pk):
    try:
        persona = Persona.objects.get(pk=pk)
    except Persona.DoesNotExist:
        return Response({'error': 'Registro no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    if request.method in ['PATCH', 'PUT']:
        serializer = PersonaSerializer(persona, data=request.data, partial=True)
        if serializer.is_valid():
            persona_actualizada = serializer.save()
            notify_websocket_clients('REFRESH')
            return Response({'id': persona_actualizada.id, 'status': 'updated'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    elif request.method == 'DELETE':
        persona.delete()
        notify_websocket_clients('REFRESH')
        return Response({'status': 'deleted'}, status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
def sync_local_to_cloud(request):
    # En esta ruta se pueden recibir elementos enviados desde aplicaciones clientes
    notify_websocket_clients('REFRESH')
    return Response({'status': 'sincronizacion exitosa'}, status=status.HTTP_200_OK)

