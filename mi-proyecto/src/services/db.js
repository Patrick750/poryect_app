import localforage from 'localforage';
import initSqlJs from 'sql.js';

let dbInstance = null;

// Configurar localforage para persistir el archivo binario de la base de datos SQLite (.sqlite)
localforage.config({
  name: 'mi_proyecto_db',
  storeName: 'sqlite_store'
});

/**
 * Inicializar / obtener la instancia de la base de datos SQLite (SQL.js)
 */
export const getSQLiteDB = async () => {
  if (dbInstance) return dbInstance;

  try {
    const SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

    const savedDbArray = await localforage.getItem('sqlite_db_file');
    if (savedDbArray) {
      dbInstance = new SQL.Database(new Uint8Array(savedDbArray));
    } else {
      dbInstance = new SQL.Database();
      // Crear tabla contactos en SQLite
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS contactos (
          id TEXT PRIMARY KEY,
          tipo_documento TEXT,
          numero_documento TEXT,
          nombres TEXT,
          correo TEXT,
          telefono TEXT,
          is_synced INTEGER
        );
      `);
      await saveSQLiteFile();
    }
  } catch (error) {
    console.error("Error al inicializar SQLite:", error);
  }
  return dbInstance;
};

/**
 * Guardar binario de SQLite en almacenamiento persistente
 */
const saveSQLiteFile = async () => {
  if (dbInstance) {
    const data = dbInstance.export();
    await localforage.setItem('sqlite_db_file', Array.from(data));
  }
};

/**
 * Obtener todos los contactos cacheados desde SQLite
 */
export const getCachedContacts = async () => {
  try {
    const db = await getSQLiteDB();
    if (!db) return [];
    
    const stmt = db.prepare("SELECT * FROM contactos");
    const result = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      result.push({
        ...row,
        is_synced: Boolean(row.is_synced)
      });
    }
    stmt.free();
    return result;
  } catch (error) {
    console.error("Error al obtener contactos desde SQLite:", error);
    return [];
  }
};

/**
 * Sincronizar toda la lista de contactos hacia la tabla SQLite local
 */
export const cacheContacts = async (contacts) => {
  try {
    const db = await getSQLiteDB();
    if (!db) return;

    db.run("DELETE FROM contactos");
    const stmt = db.prepare("INSERT INTO contactos (id, tipo_documento, numero_documento, nombres, correo, telefono, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?)");
    
    for (const c of contacts) {
      stmt.run([
        c.id ? String(c.id) : `temp_${Date.now()}_${Math.random()}`,
        c.documentType || c.tipo_documento || 'DNI',
        c.documentNumber || c.numero_documento || '',
        c.names || c.nombres || '',
        c.email || c.correo || '',
        c.phone || c.telefono || '',
        c.is_synced ? 1 : 0
      ]);
    }
    stmt.free();
    await saveSQLiteFile();
  } catch (error) {
    console.error("Error al guardar contactos en SQLite:", error);
  }
};

/**
 * Obtener operaciones pendientes almacenadas
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
 * Añadir operación a la cola y persistir cambio en la tabla SQLite
 */
export const addPendingOperation = async (operation) => {
  try {
    const queue = await getPendingSync();
    
    if (operation.type === 'CREATE' && !operation.data.id) {
      operation.data.id = 'temp_' + Date.now();
    }
    
    queue.push(operation);
    await localforage.setItem('pending_sync', queue);

    const db = await getSQLiteDB();
    if (db) {
      if (operation.type === 'CREATE') {
        const stmt = db.prepare("INSERT INTO contactos (id, tipo_documento, numero_documento, nombres, correo, telefono, is_synced) VALUES (?, ?, ?, ?, ?, ?, 0)");
        stmt.run([
          String(operation.data.id),
          operation.data.documentType || 'DNI',
          operation.data.documentNumber || '',
          operation.data.names || '',
          operation.data.email || '',
          operation.data.phone || '',
          0
        ]);
        stmt.free();
      } else if (operation.type === 'UPDATE') {
        const stmt = db.prepare("UPDATE contactos SET tipo_documento=?, numero_documento=?, nombres=?, correo=?, telefono=?, is_synced=0 WHERE id=?");
        stmt.run([
          operation.data.documentType || 'DNI',
          operation.data.documentNumber || '',
          operation.data.names || '',
          operation.data.email || '',
          operation.data.phone || '',
          String(operation.data.id)
        ]);
        stmt.free();
      } else if (operation.type === 'DELETE') {
        const stmt = db.prepare("DELETE FROM contactos WHERE id=?");
        stmt.run([String(operation.id)]);
        stmt.free();
      }
      await saveSQLiteFile();
    }
    
    return operation.data;
  } catch (error) {
    console.error("Error al añadir operación offline en SQLite:", error);
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
