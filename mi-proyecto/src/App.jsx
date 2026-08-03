import { useState, useEffect } from 'react';
import { User, Mail, Phone, CreditCard, Edit2, Trash2, UserPlus, Save, Database, AlertCircle, CheckCircle2, X, RefreshCcw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import UserDetail from './components/UserDetail';
import { getCachedContacts, cacheContacts, getPendingSync, addPendingOperation, clearPendingSync } from './services/db';
import './index.css';

// Usamos la variable de entorno o caemos en localhost
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/personas/';
const isNative = Capacitor.isNativePlatform();

// Derivar URL de WebSocket desde API_URL
const getWsUrl = () => {
  const url = new URL(API_URL);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws/personas/`;
};

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
  const [serverStatus, setServerStatus] = useState(navigator.onLine ? 'Conectando al servidor...' : 'Modo Offline');
  const [toasts, setToasts] = useState([]);
  
  // Estado para la navegación de la vista detallada
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const handleOnline = () => {
      setServerStatus('Conectando al servidor...');
      loadData();
    };
    const handleOffline = () => {
      setServerStatus('Modo Offline');
      loadData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadData();

    // --- CONEXIÓN WEBSOCKET (SOLO EN WEB) ---
    let ws = null;
    if (!isNative) {
      const connectWebSocket = () => {
        try {
          const wsUrl = getWsUrl();
          ws = new WebSocket(wsUrl);

          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.action === 'REFRESH') {
              fetch(API_URL)
                .then(res => res.json())
                .then(data => {
                  setContacts(data);
                  cacheContacts(data);
                })
                .catch(err => console.error("Error al actualizar vía WebSocket:", err));
            }
          };

          ws.onclose = () => {
            // Reintentar conexión en 3 segundos si se cae el servidor
            setTimeout(connectWebSocket, 3000);
          };
        } catch (e) {
          console.error("Error al iniciar WebSocket:", e);
        }
      };

      connectWebSocket();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (ws) ws.close();
    };
  }, []);


  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 300);
  };

  const loadData = async () => {
    try {
      setServerStatus(isNative ? 'Cargando datos locales (SQLite)...' : 'Cargando datos de servidor...');
      const response = await fetch(API_URL);
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
        if (selectedUser) {
          const updatedUser = data.find(u => u.id === selectedUser.id);
          if (updatedUser) setSelectedUser(updatedUser);
        }
        setServerStatus(isNative ? (navigator.onLine ? 'App Online - Sincronizado' : 'Modo Offline (SQLite)') : 'Conectado al backend');
        
        // Si es móvil y tenemos red, disparamos sincronización de SQLite -> PostgreSQL
        if (isNative && navigator.onLine) {
          triggerBackgroundSync();
        }
      } else {
        setServerStatus('Error en la API');
      }
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setServerStatus('Modo Offline (SQLite)');
    }
  };

  const triggerBackgroundSync = async () => {
    if (!navigator.onLine) return;
    
    try {
      setServerStatus('Sincronizando SQLite -> PostgreSQL...');
      const syncUrl = `${API_URL}sync/`;
      const res = await fetch(syncUrl, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        if (result.registros_sincronizados > 0) {
          addToast(`¡Sincronizados ${result.registros_sincronizados} registro(s) a PostgreSQL!`, 'success');
        }
        // Recargar datos actualizados con los IDs oficiales
        const response = await fetch(API_URL);
        if (response.ok) {
          const freshData = await response.json();
          setContacts(freshData);
        }
        setServerStatus('App Online - Sincronizado');
      }
    } catch (error) {
      console.log('Error al sincronizar con PostgreSQL:', error);
      setServerStatus('Modo Offline (SQLite)');
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

      if (response.ok) {
        const resData = await response.json();
        const msg = isNative ? 
          (resData.status?.includes('offline') ? '¡Guardado en SQLite (Offline)!' : '¡Guardado y Sincronizado!') :
          (editingId ? '¡Registro actualizado en PostgreSQL!' : '¡Registro guardado en PostgreSQL!');
        
        addToast(msg, 'success');
        setEditingId(null);
        setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
        
        loadData();
      } else {
        const errData = await response.json();
        addToast('Error al procesar el registro.', 'error');
        console.error(errData);
      }
    } catch (error) {
      console.error('Error en handleSubmit:', error);
      addToast('Error de conexión con el servidor/API.', 'error');
    }
  };

  const handleEdit = (contact, e) => {
    if (e) e.stopPropagation();
    setFormData(contact);
    setEditingId(contact.id);
    setSelectedUser(null);
  };

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    
    try {
      const response = await fetch(`${API_URL}${id}/`, {
        method: 'DELETE'
      });
      if (response.ok || response.status === 204) {
        addToast('Registro eliminado', 'info');
        if (editingId === id) {
          setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
          setEditingId(null);
        }
        if (selectedUser && selectedUser.id === id) {
          setSelectedUser(null);
        }
        loadData();
      } else {
        addToast('Error al eliminar el registro', 'error');
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      addToast('No se pudo conectar con el servidor para eliminar.', 'error');
    }
  };

  const handleSync = async () => {
    if (!navigator.onLine) {
      addToast('No tienes internet para sincronizar.', 'error');
      return;
    }
    
    setServerStatus('Forzando sincronización...');
    await triggerBackgroundSync();
  };

  return (
    <>
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
        
        {isNative && (
          <div style={{ display: 'flex', gap: '1rem' }}>
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

            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              background: serverStatus.includes('Conectado') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              color: serverStatus.includes('Conectado') ? '#34d399' : '#f87171',
              padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: '500'
            }}>
              <Database size={18} /> {serverStatus}
            </div>
          </div>
        )}

      </div>
      
      {/* NAVEGACIÓN DINÁMICA: Si hay un usuario seleccionado, mostramos UserDetail, si no, el layout regular */}
      {selectedUser ? (
        <UserDetail 
          user={selectedUser} 
          onBack={() => setSelectedUser(null)} 
          onEdit={(user) => handleEdit(user)}
        />
      ) : (
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
                  <div 
                    key={contact.id} 
                    className="list-item clickable" 
                    onClick={() => setSelectedUser(contact)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="item-info">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {contact.names}
                        {isNative && contact.is_synced === false && (
                          <span style={{ 
                            fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.2)', 
                            color: '#f87171', padding: '0.1rem 0.4rem', 
                            borderRadius: '1rem', fontWeight: 'bold' 
                          }}>
                            OFFLINE
                          </span>
                        )}

                      </h3>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <Mail size={12} /> {contact.email}
                      </p>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem' }}>
                        <Phone size={12} /> {contact.phone} • {contact.documentType}: {contact.documentNumber}
                      </p>
                    </div>
                    <div className="item-actions">
                      <button className="btn-icon" onClick={(e) => handleEdit(contact, e)} title="Editar">
                        <Edit2 size={18} />
                      </button>
                      <button className="btn-icon danger" onClick={(e) => handleDelete(contact.id, e)} title="Eliminar">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
