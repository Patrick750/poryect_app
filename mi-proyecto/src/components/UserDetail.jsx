import React from 'react';
import { ArrowLeft, User, Mail, Phone, CreditCard, CloudOff, Cloud, Edit2 } from 'lucide-react';

const UserDetail = ({ user, onBack, onEdit }) => {
  if (!user) return null;

  const isOffline = user.is_synced === false;
  
  // Lista segura de teléfonos
  const phonesList = Array.isArray(user.phones_list) && user.phones_list.length > 0 
    ? user.phones_list 
    : [user.phone].filter(Boolean);

  return (
    <div className="glass-panel" style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Botón de retroceso */}
      <button 
        onClick={onBack}
        style={{
          position: 'absolute', top: '1.5rem', left: '1.5rem',
          background: 'transparent', border: 'none', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          padding: '0.5rem', borderRadius: '0.5rem', transition: 'all 0.2s'
        }}
        onMouseOver={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent' }}
      >
        <ArrowLeft size={20} /> Volver
      </button>

      {/* Botón de edición flotante */}
      <button 
        onClick={() => onEdit(user)}
        style={{
          position: 'absolute', top: '1.5rem', right: '1.5rem',
          background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', 
          color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
          padding: '0.5rem 1rem', borderRadius: '2rem', transition: 'all 0.2s', fontWeight: '500'
        }}
        onMouseOver={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)' }}
        onMouseOut={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)' }}
      >
        <Edit2 size={16} /> Editar
      </button>

      <div style={{ padding: '3rem 1rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* Avatar grande */}
        <div style={{
          width: '120px', height: '120px', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          boxShadow: '0 10px 25px -5px rgba(168, 85, 247, 0.4)',
          marginBottom: '1.5rem'
        }}>
          <User size={60} color="#fff" />
        </div>

        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', textAlign: 'center' }}>{user.names}</h1>
        
        {/* Estado de sincronización */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem',
          background: isOffline ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          color: isOffline ? '#f87171' : '#34d399',
          padding: '0.5rem 1rem', borderRadius: '2rem', fontWeight: 'bold', fontSize: '0.9rem',
          border: `1px solid ${isOffline ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
        }}>
          {isOffline ? <CloudOff size={16} /> : <Cloud size={16} />}
          {isOffline ? 'DATOS OFFLINE (NO SINCRONIZADO)' : 'SINCRONIZADO EN LA NUBE'}
        </div>

        {/* Tarjetas de Información */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem', width: '100%' 
        }}>
          
          {/* Documento */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <CreditCard size={18} />
              <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Documento ({user.documentType})</span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '500' }}>{user.documentNumber}</div>
          </div>

          {/* Correo */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              <Mail size={18} />
              <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Correo Electrónico</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: '500' }}>
              <a href={`mailto:${user.email}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>{user.email}</a>
            </div>
          </div>

          {/* Teléfonos (Soporte Múltiple) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)', gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <Phone size={18} />
              <span style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Teléfonos Registrados ({phonesList.length})</span>
            </div>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {phonesList.map((tel, index) => (
                <div key={index} style={{
                  background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)',
                  padding: '0.75rem 1.5rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}></div>
                  <span style={{ fontSize: '1.1rem', fontWeight: '500' }}>{tel}</span>
                </div>
              ))}
              
              {phonesList.length === 0 && (
                <div style={{ color: 'var(--text-muted)' }}>No hay teléfonos registrados.</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default UserDetail;
