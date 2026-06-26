from django.db import models

class Persona(models.Model):
    TIPO_DOC_CHOICES = [
        ('DNI', 'DNI'),
        ('PASAPORTE', 'Pasaporte'),
        ('CE', 'Carné de Extranjería'),
    ]

    tipo_documento = models.CharField(max_length=20, choices=TIPO_DOC_CHOICES, default='DNI')
    numero_documento = models.CharField(max_length=20, unique=True)
    nombres = models.CharField(max_length=150)
    correo = models.EmailField(unique=True)
    # Usamos JSONField para almacenar múltiples números de teléfono (ej. ["+51987654321", "+51123456789"])
    telefono = models.JSONField(default=list, help_text="Almacena una lista de números de teléfono en formato JSON")
    
    # Campo para distinguir si el registro está sincronizado con la nube (NeonDB)
    is_synced = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.nombres} ({self.numero_documento})"
