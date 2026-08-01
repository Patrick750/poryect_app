from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import OperationalError, InterfaceError
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
        try:
            # 1. Intentar obtener de NeonDB (default)
            # EVALUAMOS INMEDIATAMENTE con list() para que si falla el internet, salte al except ANTES de tocar SQLite
            personas_nube = list(Persona.objects.using('default').all())
            
            # --- CONSERVACIÓN INTELIGENTE (OFFLINE CACHE) ---
            try:
                # Rescatamos a los creados offline que no han subido a la nube aún
                offline_locales = list(Persona.objects.using('sqlite').filter(is_synced=False))
            except Exception:
                offline_locales = []
                
            try:
                # AHORA SÍ, si llegamos aquí es porque NeonDB está vivo. Borramos la data antigua local.
                Persona.objects.using('sqlite').all().delete()
                
                # Preparamos las copias oficiales
                copias = [
                    Persona(
                        id=p.id,
                        tipo_documento=p.tipo_documento,
                        numero_documento=p.numero_documento,
                        nombres=p.nombres,
                        correo=p.correo,
                        telefono=p.telefono,
                        is_synced=True
                    ) for p in personas_nube
                ]
                Persona.objects.using('sqlite').bulk_create(copias)
                
                # Reinsertamos a los "huérfanos" offline dejando que SQLite les asigne IDs frescos 
                # para que no colisionen con los de NeonDB
                for p in offline_locales:
                    p.id = None
                    p.is_synced = False
                if offline_locales:
                    Persona.objects.using('sqlite').bulk_create(offline_locales)
            except Exception as sync_err:
                print("Error en sincronización (GET):", sync_err)
            
            # AHORA LEEMOS TODO DIRECTAMENTE DESDE SQLITE PARA QUE TENGAN SUS IDS REALES!
            todos = Persona.objects.using('sqlite').all()
            serializer = PersonaSerializer(todos, many=True)
            return Response(serializer.data)
            
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Obtener de SQLite
            personas = Persona.objects.using('sqlite').all()
            serializer = PersonaSerializer(personas, many=True)
            return Response(serializer.data)
    
    elif request.method == 'POST':
        serializer = PersonaSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 1. Intentar guardar en NeonDB (default)
                persona = serializer.save() 
                persona.is_synced = True
                persona.save(using='default')
                
                # --- WRITE-THROUGH SYNC ---
                try:
                    Persona.objects.using('sqlite').create(
                        id=persona.id,
                        tipo_documento=persona.tipo_documento,
                        numero_documento=persona.numero_documento,
                        nombres=persona.nombres,
                        correo=persona.correo,
                        telefono=persona.telefono,
                        is_synced=True
                    )
                except Exception:
                    pass
                notify_websocket_clients('REFRESH')
                return Response({'id': persona.id, 'status': 'created (NeonDB + Sync Local)'}, status=status.HTTP_201_CREATED)
            except (OperationalError, InterfaceError, Exception) as e:
                # 2. Fallback: Guardar SOLO en SQLite (Marcado como no sincronizado)
                phone = request.data.get('phone')
                persona_local = Persona.objects.using('sqlite').create(
                    tipo_documento=serializer.validated_data.get('tipo_documento'),
                    numero_documento=serializer.validated_data.get('numero_documento'),
                    nombres=serializer.validated_data.get('nombres'),
                    correo=serializer.validated_data.get('correo'),
                    is_synced=False
                )
                if phone:
                    persona_local.telefono = [phone]
                    persona_local.save(using='sqlite')
                notify_websocket_clients('REFRESH')
                return Response({'id': persona_local.id, 'status': 'created (offline in SQLite)'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH', 'PUT', 'DELETE'])
def persona_detail(request, pk):
    if request.method in ['PATCH', 'PUT']:
        try:
            # 1. Intentar actualizar en NeonDB
            persona = Persona.objects.using('default').get(pk=pk)
            serializer = PersonaSerializer(persona, data=request.data, partial=True)
            if serializer.is_valid():
                persona_actualizada = serializer.save()
                persona_actualizada.is_synced = True
                persona_actualizada.save(using='default')
                
                try:
                    p_local = Persona.objects.using('sqlite').get(numero_documento=persona_actualizada.numero_documento)
                    p_local.tipo_documento = persona_actualizada.tipo_documento
                    p_local.numero_documento = persona_actualizada.numero_documento
                    p_local.nombres = persona_actualizada.nombres
                    p_local.correo = persona_actualizada.correo
                    p_local.telefono = persona_actualizada.telefono
                    p_local.is_synced = True
                    p_local.save(using='sqlite')
                except Exception:
                    pass
                notify_websocket_clients('REFRESH')
                return Response({'id': persona_actualizada.id, 'status': 'updated (NeonDB + Sync Local)'})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Actualizar en SQLite
            try:
                persona_local = Persona.objects.using('sqlite').get(pk=pk)
                serializer = PersonaSerializer(persona_local, data=request.data, partial=True)
                if serializer.is_valid():
                    validated_data = serializer.validated_data
                    phone = validated_data.pop('phone', None)
                    for attr, value in validated_data.items():
                        setattr(persona_local, attr, value)
                    if phone:
                        persona_local.telefono = [phone]
                    # Si editamos offline, lo marcamos como desincronizado
                    persona_local.is_synced = False 
                    persona_local.save(using='sqlite')
                    notify_websocket_clients('REFRESH')
                    return Response({'id': persona_local.id, 'status': 'updated (offline in SQLite)'})
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite fallback'}, status=status.HTTP_404_NOT_FOUND)
            
    elif request.method == 'DELETE':
        try:
            persona = Persona.objects.using('default').get(pk=pk)
            doc_num = persona.numero_documento
            persona.delete(using='default')
            try:
                Persona.objects.using('sqlite').filter(numero_documento=doc_num).delete()
            except Exception:
                pass
            notify_websocket_clients('REFRESH')
            return Response({'status': 'deleted (NeonDB + Sync Local)'}, status=status.HTTP_204_NO_CONTENT)
        except (OperationalError, InterfaceError, Exception):
            try:
                persona_local = Persona.objects.using('sqlite').get(pk=pk)
                persona_local.delete(using='sqlite')
                notify_websocket_clients('REFRESH')
                return Response({'status': 'deleted (offline in SQLite)'}, status=status.HTTP_204_NO_CONTENT)
            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite'}, status=status.HTTP_404_NOT_FOUND)

            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
def sync_local_to_cloud(request):
    try:
        # Check connection to NeonDB
        Persona.objects.using('default').exists()
        
        # Filtramos SÓLO los que NO han sido sincronizados (is_synced=False)
        personas_offline = Persona.objects.using('sqlite').filter(is_synced=False)
        sync_count = 0
        
        for local in personas_offline:
            nube_qs = Persona.objects.using('default').filter(numero_documento=local.numero_documento)
            
            if nube_qs.exists():
                nube = nube_qs.first()
                nube.tipo_documento = local.tipo_documento
                nube.nombres = local.nombres
                nube.correo = local.correo
                
                # Combinar teléfonos (JSONB)
                telefonos_nube = nube.telefono if isinstance(nube.telefono, list) else []
                telefonos_locales = local.telefono if isinstance(local.telefono, list) else []
                
                # Agregar teléfonos locales que no estén en la nube
                for tel in telefonos_locales:
                    if tel not in telefonos_nube:
                        telefonos_nube.append(tel)
                        
                nube.telefono = telefonos_nube
                nube.is_synced = True
                nube.save(using='default')
            else:
                Persona.objects.using('default').create(
                    tipo_documento=local.tipo_documento,
                    numero_documento=local.numero_documento,
                    nombres=local.nombres,
                    correo=local.correo,
                    telefono=local.telefono,
                    is_synced=True
                )
            sync_count += 1
                
        # Reparamos la base local importando los IDs oficiales
        nube_todos = list(Persona.objects.using('default').all())
        Persona.objects.using('sqlite').all().delete()
        copias = [
            Persona(
                id=p.id, tipo_documento=p.tipo_documento, numero_documento=p.numero_documento,
                nombres=p.nombres, correo=p.correo, telefono=p.telefono, is_synced=True
            ) for p in nube_todos
        ]
        Persona.objects.using('sqlite').bulk_create(copias)
        
        return Response({'status': 'sincronizacion exitosa', 'registros_sincronizados': sync_count}, status=status.HTTP_200_OK)
        
    except (OperationalError, InterfaceError, Exception) as e:
        return Response({'error': 'No se pudo conectar con la base de datos en la nube. Verifica tu internet.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
