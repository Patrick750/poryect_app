import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from .models import Persona

API_URL = 'https://ep-mute-bread-adwqwewu.apirest.c-2.us-east-1.aws.neon.tech/neondb/rest/v1/app'

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
        # 1. Intentar conectar a la Nube (NeonDB)
        try:
            response = requests.get(API_URL, timeout=3)
            if response.status_code == 200:
                return JsonResponse(response.json(), safe=False)
            raise requests.exceptions.RequestException("NeonDB error or invalid URL")
        except requests.exceptions.RequestException:
            # 2. Fallback: Conectar a base de datos SQLite local
            personas = Persona.objects.all()
            data = [map_db_to_frontend(p) for p in personas]
            return JsonResponse(data, safe=False)
    
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            # 1. Intentar guardar en la Nube (NeonDB)
            try:
                response = requests.post(API_URL, json=data, timeout=3)
                if response.status_code in [200, 201]:
                    return JsonResponse(response.json() if response.text else {'status': 'created'}, status=201)
                raise requests.exceptions.RequestException("NeonDB rejection")
            except requests.exceptions.RequestException:
                # 2. Fallback: Guardar en SQLite local
                persona = Persona.objects.create(
                    tipo_documento=data.get('documentType', 'DNI'),
                    numero_documento=data.get('documentNumber', ''),
                    nombres=data.get('names', ''),
                    correo=data.get('email', ''),
                    telefono=[data.get('phone')]
                )
                return JsonResponse({'id': persona.id, 'status': 'created (offline in SQLite)'}, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
def persona_detail(request, pk):
    if request.method == 'PATCH' or request.method == 'PUT':
        try:
            data = json.loads(request.body)
            # 1. Intentar actualizar en la Nube
            try:
                # PostgREST syntax for updating by id
                response = requests.patch(f"{API_URL}?id=eq.{pk}", json=data, timeout=3)
                if response.status_code in [200, 204]:
                    return JsonResponse({'id': pk, 'status': 'updated'})
                raise requests.exceptions.RequestException("NeonDB error")
            except requests.exceptions.RequestException:
                # 2. Fallback: Actualizar en SQLite local
                persona = Persona.objects.get(pk=pk)
                if 'documentType' in data: persona.tipo_documento = data['documentType']
                if 'documentNumber' in data: persona.numero_documento = data['documentNumber']
                if 'names' in data: persona.nombres = data['names']
                if 'email' in data: persona.correo = data['email']
                if 'phone' in data: persona.telefono = [data['phone']]
                persona.save()
                return JsonResponse({'id': persona.id, 'status': 'updated (offline in SQLite)'})
        except Persona.DoesNotExist:
            return JsonResponse({'error': 'Not found in SQLite fallback'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
            
    elif request.method == 'DELETE':
        # 1. Intentar eliminar de la Nube
        try:
            response = requests.delete(f"{API_URL}?id=eq.{pk}", timeout=3)
            if response.status_code in [200, 204]:
                return JsonResponse({'status': 'deleted'})
            raise requests.exceptions.RequestException("NeonDB error")
        except requests.exceptions.RequestException:
            # 2. Fallback: Eliminar en SQLite local
            try:
                persona = Persona.objects.get(pk=pk)
                persona.delete()
                return JsonResponse({'status': 'deleted (offline in SQLite)'})
            except Persona.DoesNotExist:
                return JsonResponse({'error': 'Not found in SQLite'}, status=404)