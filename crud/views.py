import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import OperationalError, InterfaceError
from .models import Persona

def map_db_to_frontend(db_record):
    """Mapea el modelo de Django a las llaves que espera el frontend"""
    return {
        'id': db_record.id,
        'documentType': db_record.tipo_documento,
        'documentNumber': db_record.numero_documento,
        'names': db_record.nombres,
        'email': db_record.correo,
        'phone': db_record.telefono[0] if db_record.telefono else ''
    }

@csrf_exempt
def persona_list_create(request):
    if request.method == 'GET':
        try:
            # 1. Intentar obtener de NeonDB (default)
            personas = Persona.objects.using('default').all()
            # Forzamos la evaluación para que tire error si no hay conexión
            data = [map_db_to_frontend(p) for p in personas] 
            return JsonResponse(data, safe=False)
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Obtener de SQLite
            personas = Persona.objects.using('sqlite').all()
            data = [map_db_to_frontend(p) for p in personas]
            return JsonResponse(data, safe=False)
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            # 1. Intentar guardar en NeonDB (default)
            try:
                persona = Persona.objects.using('default').create(
                    tipo_documento=data.get('documentType', 'DNI'),
                    numero_documento=data.get('documentNumber', ''),
                    nombres=data.get('names', ''),
                    correo=data.get('email', ''),
                    telefono=[data.get('phone')]
                )
                return JsonResponse({'id': persona.id, 'status': 'created (NeonDB)'}, status=201)
            except (OperationalError, InterfaceError, Exception) as inner_e:
                # 2. Fallback: Guardar en SQLite
                persona = Persona.objects.using('sqlite').create(
                    tipo_documento=data.get('documentType', 'DNI'),
                    numero_documento=data.get('documentNumber', ''),
                    nombres=data.get('names', ''),
                    correo=data.get('email', ''),
                    telefono=[data.get('phone')]
                )
                return JsonResponse({'id': persona.id, 'status': f'created (offline in SQLite)'}, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
def persona_detail(request, pk):
    if request.method == 'PATCH' or request.method == 'PUT':
        try:
            data = json.loads(request.body)
            # 1. Intentar actualizar en NeonDB
            try:
                persona = Persona.objects.using('default').get(pk=pk)
                if 'documentType' in data: persona.tipo_documento = data['documentType']
                if 'documentNumber' in data: persona.numero_documento = data['documentNumber']
                if 'names' in data: persona.nombres = data['names']
                if 'email' in data: persona.correo = data['email']
                if 'phone' in data: persona.telefono = [data['phone']]
                persona.save(using='default')
                return JsonResponse({'id': persona.id, 'status': 'updated (NeonDB)'})
            except (OperationalError, InterfaceError, Exception):
                # 2. Fallback: Actualizar en SQLite
                try:
                    persona = Persona.objects.using('sqlite').get(pk=pk)
                    if 'documentType' in data: persona.tipo_documento = data['documentType']
                    if 'documentNumber' in data: persona.numero_documento = data['documentNumber']
                    if 'names' in data: persona.nombres = data['names']
                    if 'email' in data: persona.correo = data['email']
                    if 'phone' in data: persona.telefono = [data['phone']]
                    persona.save(using='sqlite')
                    return JsonResponse({'id': persona.id, 'status': 'updated (offline in SQLite)'})
                except Persona.DoesNotExist:
                    return JsonResponse({'error': 'Not found in SQLite fallback'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
            
    elif request.method == 'DELETE':
        # 1. Intentar eliminar de NeonDB
        try:
            persona = Persona.objects.using('default').get(pk=pk)
            persona.delete(using='default')
            return JsonResponse({'status': 'deleted (NeonDB)'})
        except (OperationalError, InterfaceError, Exception):
            # 2. Fallback: Eliminar en SQLite
            try:
                persona = Persona.objects.using('sqlite').get(pk=pk)
                persona.delete(using='sqlite')
                return JsonResponse({'status': 'deleted (offline in SQLite)'})
            except Persona.DoesNotExist:
                return JsonResponse({'error': 'Not found in SQLite'}, status=404)