import re
from rest_framework import serializers
from .models import Persona

class PersonaSerializer(serializers.ModelSerializer):
    # Mapeo para que el frontend siga funcionando sin cambios
    documentType = serializers.CharField(source='tipo_documento', required=False)
    documentNumber = serializers.CharField(source='numero_documento', required=False)
    names = serializers.CharField(source='nombres', required=False)
    email = serializers.EmailField(source='correo', required=False)
    phone = serializers.CharField(write_only=True, required=False)
    
    # Campo personalizado para enviar el primer teléfono al frontend
    phone_display = serializers.SerializerMethodField(method_name='get_phone_display')

    class Meta:
        model = Persona
        fields = ['id', 'documentType', 'documentNumber', 'names', 'email', 'phone', 'phone_display', 'is_synced']

    def validate_documentNumber(self, value):
        # Limpiar el campo: eliminar espacios, letras y todo lo que no sea dígito
        cleaned_value = re.sub(r'\D', '', str(value))
        
        if not cleaned_value:
            raise serializers.ValidationError("El número de documento debe contener dígitos válidos.")
            
        instance_id = self.instance.id if self.instance else None

        # Validar unicidad en la base de datos principal (NeonDB)
        try:
            qs = Persona.objects.using('default').filter(numero_documento=cleaned_value)
            if instance_id:
                qs = qs.exclude(id=instance_id)
            if qs.exists():
                raise serializers.ValidationError("Ya existe un usuario registrado con este número de documento.")
        except Exception:
            # Si NeonDB falla, validar unicidad en la base de datos de respaldo (SQLite)
            qs = Persona.objects.using('sqlite').filter(numero_documento=cleaned_value)
            if instance_id:
                qs = qs.exclude(id=instance_id)
            if qs.exists():
                raise serializers.ValidationError("Ya existe un usuario registrado con este número de documento (Local).")
                
        return cleaned_value

    def get_phone_display(self, obj):
        # El frontend espera 'phone' en el JSON de respuesta.
        # Para engañar al SerializerMethodField, le llamaremos 'phone' en la representación final.
        if obj.telefono and isinstance(obj.telefono, list) and len(obj.telefono) > 0:
            return obj.telefono[0]
        return ""

    def to_representation(self, instance):
        # Renombramos 'phone_display' a 'phone' en la salida para el frontend
        representation = super().to_representation(instance)
        representation['phone'] = representation.pop('phone_display')
        return representation

    def create(self, validated_data):
        # Extraemos el teléfono que vino del frontend y lo guardamos como arreglo JSON
        phone = validated_data.pop('phone', None)
        persona = super().create(validated_data)
        if phone:
            persona.telefono = [phone]
            persona.save()
        return persona

    def update(self, instance, validated_data):
        phone = validated_data.pop('phone', None)
        instance = super().update(instance, validated_data)
        if phone:
            instance.telefono = [phone]
            instance.save()
        return instance
