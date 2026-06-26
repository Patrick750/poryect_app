from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import OperationalError, InterfaceError
from .models import Persona
from .serializers import PersonaSerializer

@api_view(['GET', 'POST'])
def persona_list_create(request):
    if request.method == 'GET':
        try:
            # 1. Intentar obtener de NeonDB (default)
            personas = Persona.objects.using('default').all()
            serializer = PersonaSerializer(personas, many=True)
            data = serializer.data 
            
            # --- SINCRONIZACIÓN DE ESPEJO (CLOUD -> LOCAL) ---
            try:
                # Borramos la data antigua local
                Persona.objects.using('sqlite').all().delete()
                # Insertamos la copia exacta desde NeonDB (preservando IDs)
                copias = [
                    Persona(
                        id=p.id,
                        tipo_documento=p.tipo_documento,
                        numero_documento=p.numero_documento,
                        nombres=p.nombres,
                        correo=p.correo,
                        telefono=p.telefono
                    ) for p in personas
                ]
                Persona.objects.using('sqlite').bulk_create(copias)
            except Exception as sync_err:
                print("Error sincronizando a SQLite (GET):", sync_err)
            # --------------------------------------------------

            return Response(data)
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
                
                # --- SINCRONIZACIÓN WRITE-THROUGH (CLOUD -> LOCAL) ---
                try:
                    Persona.objects.using('sqlite').create(
                        id=persona.id, # Forzamos el mismo ID que nos dio NeonDB
                        tipo_documento=persona.tipo_documento,
                        numero_documento=persona.numero_documento,
                        nombres=persona.nombres,
                        correo=persona.correo,
                        telefono=persona.telefono
                    )
                except Exception as sync_err:
                    print("Error sincronizando a SQLite (POST):", sync_err)
                # -----------------------------------------------------
                
                return Response({'id': persona.id, 'status': 'created (NeonDB + Sync Local)'}, status=status.HTTP_201_CREATED)
            except (OperationalError, InterfaceError, Exception) as e:
                # 2. Fallback: Guardar SOLO en SQLite
                validated_data = serializer.validated_data
                phone = validated_data.pop('phone', None)
                persona_local = Persona.objects.using('sqlite').create(**validated_data)
                if phone:
                    persona_local.telefono = [phone]
                    persona_local.save(using='sqlite')
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
                
                # --- SINCRONIZACIÓN WRITE-THROUGH (CLOUD -> LOCAL) ---
                try:
                    p_local = Persona.objects.using('sqlite').get(pk=pk)
                    p_local.tipo_documento = persona_actualizada.tipo_documento
                    p_local.numero_documento = persona_actualizada.numero_documento
                    p_local.nombres = persona_actualizada.nombres
                    p_local.correo = persona_actualizada.correo
                    p_local.telefono = persona_actualizada.telefono
                    p_local.save(using='sqlite')
                except Exception as sync_err:
                    print("Error sincronizando a SQLite (PATCH):", sync_err)
                # -----------------------------------------------------
                
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
                    persona_local.save(using='sqlite')
                    return Response({'id': persona_local.id, 'status': 'updated (offline in SQLite)'})
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite fallback'}, status=status.HTTP_404_NOT_FOUND)
            
    elif request.method == 'DELETE':
        # 1. Intentar eliminar de NeonDB
        try:
            persona = Persona.objects.using('default').get(pk=pk)
            persona.delete(using='default')
            
            # --- SINCRONIZACIÓN WRITE-THROUGH (CLOUD -> LOCAL) ---
            try:
                Persona.objects.using('sqlite').filter(pk=pk).delete()
            except Exception as sync_err:
                print("Error sincronizando a SQLite (DELETE):", sync_err)
            # -----------------------------------------------------
            
            return Response({'status': 'deleted (NeonDB + Sync Local)'}, status=status.HTTP_204_NO_CONTENT)
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Eliminar SOLO en SQLite
            try:
                persona_local = Persona.objects.using('sqlite').get(pk=pk)
                persona_local.delete(using='sqlite')
                return Response({'status': 'deleted (offline in SQLite)'}, status=status.HTTP_204_NO_CONTENT)
            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite'}, status=status.HTTP_404_NOT_FOUND)
@api_view(['POST'])
def sync_local_to_cloud(request):
    try:
        # Check connection to NeonDB first
        Persona.objects.using('default').exists()
        
        # Obtenemos todos los registros locales
        personas_locales = Persona.objects.using('sqlite').all()
        
        sync_count = 0
        
        for local in personas_locales:
            # Buscamos en NeonDB por número de documento
            nube_qs = Persona.objects.using('default').filter(numero_documento=local.numero_documento)
            
            if nube_qs.exists():
                # Si existe, lo actualizamos (porque local podría estar editado offline)
                nube = nube_qs.first()
                nube.tipo_documento = local.tipo_documento
                nube.nombres = local.nombres
                nube.correo = local.correo
                nube.telefono = local.telefono
                nube.save(using='default')
                sync_count += 1
            else:
                # Si no existe, es uno nuevo creado offline. Lo subimos.
                Persona.objects.using('default').create(
                    tipo_documento=local.tipo_documento,
                    numero_documento=local.numero_documento,
                    nombres=local.nombres,
                    correo=local.correo,
                    telefono=local.telefono
                )
                sync_count += 1
                
        # Una vez sincronizado, volvemos a hacer un espejo limpio (NeonDB -> SQLite) para corregir los IDs localmente
        nube_todos = Persona.objects.using('default').all()
        Persona.objects.using('sqlite').all().delete()
        copias = [
            Persona(
                id=p.id,
                tipo_documento=p.tipo_documento,
                numero_documento=p.numero_documento,
                nombres=p.nombres,
                correo=p.correo,
                telefono=p.telefono
            ) for p in nube_todos
        ]
        Persona.objects.using('sqlite').bulk_create(copias)
        
        return Response({'status': 'sincronizacion exitosa', 'registros_sincronizados': sync_count}, status=status.HTTP_200_OK)
        
    except (OperationalError, InterfaceError, Exception) as e:
        # Si NeonDB no responde, seguimos sin internet
        return Response({'error': 'No se pudo conectar con la base de datos en la nube. Verifica tu internet.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
