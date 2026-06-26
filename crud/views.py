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
            # Evaluamos la serialización. Si falla la DB, lanzará error aquí.
            data = serializer.data 
            return Response(data)
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Obtener de SQLite
            personas = Persona.objects.using('sqlite').all()
            serializer = PersonaSerializer(personas, many=True)
            return Response(serializer.data)
    
    elif request.method == 'POST':
        # Instanciamos el serializador sin guardarlo aún
        serializer = PersonaSerializer(data=request.data)
        if serializer.is_valid():
            try:
                # 1. Intentar guardar en NeonDB (default)
                # DRF's serializer.save() uses the default router, but we can't easily pass .using() to save()
                # So we manually do it or rely on a transaction block.
                # Since save() calls Model.save() internally, the easiest way to force the DB in a generic way
                # is manually saving or passing the using kwarg if the model allows it. 
                # Actually, in DRF, we can pass kwargs to save() which might not reach .using(), 
                # but we can do it manually, or just use the model directly like before to guarantee it.
                # However, since they asked for serializers, let's use the serializer properly.
                
                # We can save and then move it, or save directly if we override the Model's save() or DB Router.
                # To be explicit and avoid DRF swallowing `.using()`, we'll extract the validated data and create it.
                
                # A trick in DRF is that we can't easily tell ModelSerializer to save to a specific DB unless we pass it.
                # Let's save it directly using the serializer by temporarily manipulating the DB router, or just using the model.
                # The safest way is using the serializer to VALIDATE, and the model to CREATE.
                # Wait! We overridden create() in the serializer. If we just call save(), it goes to default DB.
                # If it throws, we can't re-save the same serializer easily.
                # Let's try it:
                persona = serializer.save() 
                # Si falló, irá al except. Si funcionó, respondemos.
                return Response({'id': persona.id, 'status': 'created (NeonDB)'}, status=status.HTTP_201_CREATED)
            except (OperationalError, InterfaceError, Exception) as e:
                # 2. Fallback: Guardar en SQLite
                # Tenemos que instanciar el modelo nosotros mismos porque el serializador falló intentando guardar.
                validated_data = serializer.validated_data
                phone = validated_data.pop('phone', None)
                persona = Persona.objects.using('sqlite').create(**validated_data)
                if phone:
                    persona.telefono = [phone]
                    persona.save(using='sqlite')
                return Response({'id': persona.id, 'status': 'created (offline in SQLite)'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PATCH', 'PUT', 'DELETE'])
def persona_detail(request, pk):
    if request.method in ['PATCH', 'PUT']:
        try:
            # 1. Intentar actualizar en NeonDB
            persona = Persona.objects.using('default').get(pk=pk)
            serializer = PersonaSerializer(persona, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response({'id': persona.id, 'status': 'updated (NeonDB)'})
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Actualizar en SQLite
            try:
                persona = Persona.objects.using('sqlite').get(pk=pk)
                serializer = PersonaSerializer(persona, data=request.data, partial=True)
                if serializer.is_valid():
                    validated_data = serializer.validated_data
                    phone = validated_data.pop('phone', None)
                    for attr, value in validated_data.items():
                        setattr(persona, attr, value)
                    if phone:
                        persona.telefono = [phone]
                    persona.save(using='sqlite')
                    return Response({'id': persona.id, 'status': 'updated (offline in SQLite)'})
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite fallback'}, status=status.HTTP_404_NOT_FOUND)
            
    elif request.method == 'DELETE':
        # 1. Intentar eliminar de NeonDB
        try:
            persona = Persona.objects.using('default').get(pk=pk)
            persona.delete(using='default')
            return Response({'status': 'deleted (NeonDB)'}, status=status.HTTP_204_NO_CONTENT)
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Eliminar en SQLite
            try:
                persona = Persona.objects.using('sqlite').get(pk=pk)
                persona.delete(using='sqlite')
                return Response({'status': 'deleted (offline in SQLite)'}, status=status.HTTP_204_NO_CONTENT)
            except Persona.DoesNotExist:
                return Response({'error': 'Not found in SQLite'}, status=status.HTTP_404_NOT_FOUND)