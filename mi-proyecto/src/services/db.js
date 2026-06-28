import localforage from 'localforage';

// Inicializar la tienda de IndexedDB
localforage.config({
  name: 'mi_proyecto_db',
  storeName: 'contactos'
});

/**
 * Obtener todos los contactos cacheados
 */
export const getCachedContacts = async () => {
  try {
    const data = await localforage.getItem('contacts_list');
    return data || [];
  } catch (error) {
    console.error("Error al obtener contactos locales:", error);
    return [];
  }
};

/**
 * Guardar toda la lista de contactos en caché (usado cuando hay internet)
 */
export const cacheContacts = async (contacts) => {
  try {
    await localforage.setItem('contacts_list', contacts);
  } catch (error) {
    console.error("Error al cachear contactos:", error);
  }
};

/**
 * Obtener la cola de operaciones pendientes (creaciones y actualizaciones offline)
 */
export const getPendingSync = async () => {
  try {
    const queue = await localforage.getItem('pending_sync');
    return queue || [];
  } catch (error) {
    console.error("Error al obtener cola de sincronización:", error);
    return [];
  }
};

/**
 * Añadir una operación a la cola de pendientes y actualizar la caché local para que la UI lo refleje
 */
export const addPendingOperation = async (operation) => {
  try {
    const queue = await getPendingSync();
    
    // Asignar un ID temporal para que la UI pueda renderizarlo si es creación
    if (operation.type === 'CREATE' && !operation.data.id) {
      operation.data.id = 'temp_' + Date.now();
    }
    
    queue.push(operation);
    await localforage.setItem('pending_sync', queue);

    // Actualizar la lista en caché visualmente
    let contacts = await getCachedContacts();
    if (operation.type === 'CREATE') {
      // Marcar visualmente como offline
      operation.data.is_synced = false;
      contacts.push(operation.data);
    } else if (operation.type === 'UPDATE') {
      const idx = contacts.findIndex(c => c.id === operation.data.id);
      if (idx !== -1) {
        contacts[idx] = { ...contacts[idx], ...operation.data, is_synced: false };
      }
    } else if (operation.type === 'DELETE') {
      contacts = contacts.filter(c => c.id !== operation.id);
    }
    await cacheContacts(contacts);
    
    return operation.data;
  } catch (error) {
    console.error("Error al encolar operación offline:", error);
  }
};

/**
 * Limpiar la cola de sincronización
 */
export const clearPendingSync = async () => {
  try {
    await localforage.setItem('pending_sync', []);
  } catch (error) {
    console.error("Error al limpiar cola de sincronización:", error);
  }
};
