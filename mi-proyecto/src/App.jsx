import { useState, useEffect } from 'react';
import { User, Mail, Phone, CreditCard, Edit2, Trash2, UserPlus, Save, Database, AlertCircle, CheckCircle2, X, RefreshCcw } from 'lucide-react';
import './index.css';

// Ahora el frontend siempre se conecta al BACKEND de Django
const API_URL = 'http://localhost:8000/api/personas/';

function App() {
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({ 
    documentType: 'DNI', 
    documentNumber: '',
    names: '', 
    email: '', 
    phone: '' 
  });
  const [editingId, setEditingId] = useState(null);
  const [serverStatus, setServerStatus] = useState(navigator.onLine ? 'Conectando al servidor...' : 'Offline');
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    // Detectar cambios en la conexión a internet de la PC/Móvil
    const handleOnline = () => {
      setServerStatus('Conectando al servidor...');
      loadData(); // Autorecargar cuando vuelve el internet
    };
    const handleOffline = () => setServerStatus('Offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (navigator.onLine) {
      loadData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300); // Wait for slideOut animation
  };

  const loadData = async () => {
    try {
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
        setServerStatus('Conectado a Django Proxy');
      } else {
        setServerStatus('Error de conexión');
      }
    } catch (error) {
      console.error('Error fetching from Django backend:', error);
      setServerStatus('Servidor apagado');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.names || !formData.email || !formData.phone) return;

    try {
      let response;
      if (editingId) {
        response = await fetch(`${API_URL}${editingId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      
      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          // Extraer mensajes de error del objeto JSON devuelto por DRF
          const errorMsg = Object.values(errorData).flat().join('\n');
          addToast(errorMsg, 'error');
          return;
        }
        throw new Error('API Request Failed');
      }

      await loadData();
      addToast(editingId ? '¡Usuario actualizado exitosamente!' : '¡Usuario registrado exitosamente!', 'success');
      
      setEditingId(null);
      setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
      
    } catch (error) {
      console.error('Error saving to Django API', error);
      addToast('Error de conexión. Asegúrate de que el servidor Django esté corriendo.', 'error');
    }
  };

  const handleEdit = (contact) => {
    setFormData(contact);
    setEditingId(contact.id);
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_URL}${id}/`, { method: 'DELETE' });
      if (response.ok) {
        await loadData();
        addToast('Registro eliminado', 'info');
      } else {
        throw new Error('Delete failed');
      }
    } catch (error) {
      console.error('Error deleting from Django API', error);
      addToast('No se pudo eliminar el registro', 'error');
    }
    
    if (editingId === id) {
      setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
      setEditingId(null);
    }
  };

  const handleSync = async () => {
    setServerStatus('Sincronizando...');
    try {
      const response = await fetch(`${API_URL}sync/`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        addToast(`Sincronización exitosa. ${data.registros_sincronizados} registros procesados.`, 'success');
        await loadData();
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error(error);
      setServerStatus('Error de conexión');
      addToast('No hay conexión con la nube. Sigue en modo offline.', 'error');
    }
  };

  return (
    <>
      {/* Sistema de Toasts (Alertas) */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type} ${toast.hiding ? 'hiding' : ''}`}>
            {toast.type === 'error' && <AlertCircle size={20} color="var(--danger)" />}
            {toast.type === 'success' && <CheckCircle2 size={20} color="var(--success)" />}
            {toast.type === 'info' && <AlertCircle size={20} color="#3b82f6" />}
            
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{toast.message}</p>
            
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="title" style={{ marginBottom: 0 }}>Directorio Personal</h1>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          {/* Botón de Sincronización Manual */}
          <button 
            onClick={handleSync}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa',
              padding: '0.5rem 1rem', borderRadius: '2rem', border: '1px solid rgba(59, 130, 246, 0.4)',
              cursor: 'pointer', fontWeight: '500'
            }}
          >
            <RefreshCcw size={18} /> Sincronizar
          </button>

          {/* Indicador de Estado del Servidor */}
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem', 
            background: serverStatus.includes('Conectado') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: serverStatus.includes('Conectado') ? '#34d399' : '#f87171',
            padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: '500'
          }}>
            <Database size={18} /> {serverStatus}
          </div>
        </div>
      </div>
      
      <div className="layout-grid">
        {/* Panel Izquierdo - Formulario */}
        <div className="glass-panel" style={{ alignSelf: 'start' }}>
          <h2 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem'}}>
            <UserPlus size={24} color="var(--primary)" />
            {editingId ? 'Editar Registro' : 'Nuevo Registro'}
          </h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: '1' }}>
                <label className="form-label">Tipo Doc.</label>
                <select className="form-input" name="documentType" value={formData.documentType} onChange={handleInputChange} style={{ appearance: 'none', cursor: 'pointer' }}>
                  <option value="DNI">DNI</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="C.E.">C.E.</option>
                </select>
              </div>
              <div style={{ flex: '2' }}>
                <label className="form-label">Número de Documento</label>
                <div style={{ position: 'relative' }}>
                  <CreditCard size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input type="text" className="form-input" name="documentNumber" placeholder="Ej. 76543210" style={{ paddingLeft: '2.5rem' }} value={formData.documentNumber} onChange={handleInputChange} required />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombres Completos</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" className="form-input" name="names" placeholder="Ej. Juan Pérez" style={{ paddingLeft: '2.5rem' }} value={formData.names} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="email" className="form-input" name="email" placeholder="correo@ejemplo.com" style={{ paddingLeft: '2.5rem' }} value={formData.email} onChange={handleInputChange} required />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Teléfono</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="tel" className="form-input" name="phone" placeholder="+51 987 654 321" style={{ paddingLeft: '2.5rem' }} value={formData.phone} onChange={handleInputChange} required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={20} />
              {editingId ? 'Actualizar Datos' : 'Guardar Datos'}
            </button>
            {editingId && (
              <button type="button" className="btn" style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--surface-border)' }} onClick={() => { setEditingId(null); setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' }); }}>
                Cancelar Edición
              </button>
            )}
          </form>
        </div>

        {/* Panel Derecho - Lista */}
        <div className="glass-panel" style={{ alignSelf: 'start', minHeight: '400px' }}>
          <h2 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem'}}>
            <User size={24} color="#a855f7" />
            Registros ({contacts.length})
          </h2>
          
          <div className="list-container">
            {contacts.length === 0 ? (
              <div className="empty-state">
                <User size={48} color="rgba(255,255,255,0.1)" style={{ marginBottom: '1rem' }} />
                <p>No hay registros aún.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Completa el formulario para agregar uno.</p>
              </div>
            ) : (
              contacts.map(contact => (
                <div key={contact.id} className="list-item">
                  <div className="item-info">
                    <h3>{contact.names}</h3>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      <Mail size={12} /> {contact.email}
                    </p>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                      <Phone size={12} /> {contact.phone} • {contact.documentType}: {contact.documentNumber}
                    </p>
                  </div>
                  <div className="item-actions">
                    <button className="btn-icon" onClick={() => handleEdit(contact)} title="Editar">
                      <Edit2 size={18} />
                    </button>
                    <button className="btn-icon danger" onClick={() => handleDelete(contact.id)} title="Eliminar">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
