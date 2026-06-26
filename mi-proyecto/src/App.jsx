import { useState } from 'react';
import { User, Mail, Phone, CreditCard, Edit2, Trash2, UserPlus, Save } from 'lucide-react';
import './index.css';

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.names || !formData.email || !formData.phone) return;

    if (editingId) {
      setContacts(contacts.map(c => c.id === editingId ? { ...formData, id: editingId } : c));
      setEditingId(null);
    } else {
      setContacts([{ ...formData, id: Date.now().toString() }, ...contacts]);
    }
    
    setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
  };

  const handleEdit = (contact) => {
    setFormData(contact);
    setEditingId(contact.id);
  };

  const handleDelete = (id) => {
    setContacts(contacts.filter(c => c.id !== id));
    if (editingId === id) {
      setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
      setEditingId(null);
    }
  };

  return (
    <>
      <h1 className="title">Directorio Personal</h1>
      
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
                <select 
                  className="form-input" 
                  name="documentType" 
                  value={formData.documentType} 
                  onChange={handleInputChange}
                  style={{ appearance: 'none', cursor: 'pointer' }}
                >
                  <option value="DNI">DNI</option>
                  <option value="Pasaporte">Pasaporte</option>
                  <option value="C.E.">C.E.</option>
                </select>
              </div>
              <div style={{ flex: '2' }}>
                <label className="form-label">Número de Documento</label>
                <div style={{ position: 'relative' }}>
                  <CreditCard size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    name="documentNumber"
                    placeholder="Ej. 76543210"
                    style={{ paddingLeft: '2.5rem' }}
                    value={formData.documentNumber}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nombres Completos</label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  className="form-input" 
                  name="names"
                  placeholder="Ej. Juan Pérez"
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.names}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="email" 
                  className="form-input" 
                  name="email"
                  placeholder="correo@ejemplo.com"
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">Teléfono</label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="tel" 
                  className="form-input" 
                  name="phone"
                  placeholder="+51 987 654 321"
                  style={{ paddingLeft: '2.5rem' }}
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              <Save size={20} />
              {editingId ? 'Actualizar Datos' : 'Guardar Datos'}
            </button>
            {editingId && (
              <button 
                type="button" 
                className="btn" 
                style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--surface-border)' }}
                onClick={() => {
                  setEditingId(null);
                  setFormData({ documentType: 'DNI', documentNumber: '', names: '', email: '', phone: '' });
                }}
              >
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
                    <button 
                      className="btn-icon" 
                      onClick={() => handleEdit(contact)}
                      title="Editar"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      className="btn-icon danger" 
                      onClick={() => handleDelete(contact.id)}
                      title="Eliminar"
                    >
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
