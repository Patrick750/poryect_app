import { useState, useEffect } from 'react';
import { User, Mail, Phone, CreditCard, Edit2, Trash2, UserPlus, Save, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import localforage from 'localforage';
import './index.css';

const API_URL = 'https://ep-mute-bread-adwqwewu.apirest.c-2.us-east-1.aws.neon.tech/neondb/rest/v1/app';

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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Detectar cambios de red
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Carga inicial
    loadData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cargar datos (Nube o Local)
  const loadData = async () => {
    if (navigator.onLine) {
      try {
        const response = await fetch(API_URL);
        if (response.ok) {
          const data = await response.json();
          setContacts(data);
        }
      } catch (error) {
        console.error('Error fetching from API:', error);
        loadLocalData();
      }
    } else {
      loadLocalData();
    }
  };

  const loadLocalData = async () => {
    const localData = await localforage.getItem('offline_contacts');
    if (localData) setContacts(localData);
  };

  // Sincronizar datos locales hacia la nube
  const syncOfflineData = async () => {
    setIsSyncing(true);
    try {
      const localData = await localforage.getItem('offline_contacts');
      if (localData && localData.length > 0) {
        // Enviar cada registro pendiente a la nube
        for (const contact of localData) {
          // Si el ID es un string temporal generado localmente, lo omitimos para que la DB asigne uno
          const { id, ...dataToSync } = contact; 
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSync)
          });
        }
        // Limpiar base de datos local
        await localforage.removeItem('offline_contacts');
        // Recargar datos desde la nube
        await loadData();
      }
    } catch (error) {
      console.error('Error syncing:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.names || !formData.email || !formData.phone) return;

    if (isOnline) {
      // Guardar en la nube
      try {
        if (editingId) {
          await fetch(`${API_URL}?id=eq.${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        } else {
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
          });
        }
        await loadData();
      } catch (error) {
        console.error('Error saving to API', error);
      }
    } else {
      // Guardar en SQLite (localforage)
      const localData = (await localforage.getItem('offline_contacts')) || [];
      if (editingId) {
        const updated = localData.map(c => c.id === editingId ? { ...formData, id: editingId } : c);
        await localforage.setItem('offline_contacts', updated);
        setContacts(updated);
      } else {
        const newContact = { ...formData, id: Date.now().toString() };
        const updated = [newContact, ...localData];
        await localforage.setItem('offline_contacts', updated);
        setContacts(updated);
      }
    }
    
    setEditingId(null);
    setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
  };

  const handleEdit = (contact) => {
    setFormData(contact);
    setEditingId(contact.id);
  };

  const handleDelete = async (id) => {
    if (isOnline) {
      try {
        await fetch(`${API_URL}?id=eq.${id}`, { method: 'DELETE' });
        await loadData();
      } catch (error) {
        console.error('Error deleting from API', error);
      }
    } else {
      const localData = (await localforage.getItem('offline_contacts')) || [];
      const updated = localData.filter(c => c.id !== id);
      await localforage.setItem('offline_contacts', updated);
      setContacts(updated);
    }
    
    if (editingId === id) {
      setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
      setEditingId(null);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="title" style={{ marginBottom: 0 }}>Directorio Personal</h1>
        
        {/* Indicador de Estado de Red */}
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem', 
          background: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: isOnline ? '#34d399' : '#f87171',
          padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: '500'
        }}>
          {isSyncing ? (
            <><RefreshCw size={18} className="spin" /> Sincronizando...</>
          ) : isOnline ? (
            <><Wifi size={18} /> En Línea (NeonDB)</>
          ) : (
            <><WifiOff size={18} /> Sin Conexión (Modo Local)</>
          )}
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
