import { createClient } from '@libsql/client/web';

const rawUrl = import.meta.env.VITE_TURSO_DATABASE_URL || '';
const rawToken = import.meta.env.VITE_TURSO_AUTH_TOKEN || '';

export const isTursoConfigured = Boolean(
  rawUrl && rawToken && rawUrl.trim().length > 0 && rawToken.trim().length > 0
);

export const tursoClient = isTursoConfigured
  ? createClient({
      url: rawUrl.trim(),
      authToken: rawToken.trim(),
    })
  : null;

// Initial schema migration & default data seed
let isTablesInitialized = false;

export async function initTursoTables() {
  if (!tursoClient || isTablesInitialized) return;

  try {
    await tursoClient.batch([
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        shortProfile TEXT,
        createdAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdBy TEXT,
        joinCode TEXT,
        createdAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        groupId TEXT NOT NULL,
        userId TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        userId TEXT,
        isPersonal INTEGER DEFAULT 0,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        paidBy TEXT NOT NULL,
        paidByMemberId TEXT,
        date INTEGER NOT NULL,
        category TEXT,
        currencyCode TEXT DEFAULT 'BDT',
        notes TEXT,
        participants TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS settlements (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        paidBy TEXT NOT NULL,
        paidTo TEXT NOT NULL,
        amount REAL NOT NULL,
        date INTEGER NOT NULL,
        paymentMethod TEXT DEFAULT 'CASH'
      );`,
      `CREATE TABLE IF NOT EXISTS personal_topics (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        budget REAL DEFAULT 0,
        icon TEXT,
        color TEXT,
        createdAt INTEGER NOT NULL
      );`
    ]);

    // Safe column migrations in case tables were previously created without these columns
    try {
      await tursoClient.execute("ALTER TABLE groups ADD COLUMN joinCode TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE expenses ADD COLUMN userId TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE expenses ADD COLUMN isPersonal INTEGER DEFAULT 0;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE expenses ADD COLUMN topic TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE users ADD COLUMN avatar TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE users ADD COLUMN bkashNumber TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE users ADD COLUMN nagadNumber TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE users ADD COLUMN rocketNumber TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE users ADD COLUMN primaryMfs TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE settlements ADD COLUMN trxId TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE members ADD COLUMN phone TEXT;");
    } catch (_) {}

    isTablesInitialized = true;
    console.log("Turso tables initialized successfully with personal & join code support.");
  } catch (err) {
    console.error("Failed to initialize Turso tables:", err);
    throw err;
  }
}

// ----------------- Auth Operations -----------------

export async function tursoSignUp(name, email, password, shortProfile = '') {
  if (!tursoClient) {
    throw new Error("Turso database is not configured. Please add VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN in your .env file.");
  }

  await initTursoTables();

  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if email already exists
  const existing = await tursoClient.execute({
    sql: 'SELECT id FROM users WHERE email = ? LIMIT 1;',
    args: [normalizedEmail]
  });

  if (existing.rows.length > 0) {
    throw new Error("A user with this email address already exists.");
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  await tursoClient.execute({
    sql: 'INSERT INTO users (id, name, email, password, shortProfile, createdAt) VALUES (?, ?, ?, ?, ?, ?);',
    args: [userId, name.trim(), normalizedEmail, password, shortProfile.trim(), now]
  });

  const user = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    shortProfile: shortProfile.trim()
  };

  localStorage.setItem('splitup_turso_user', JSON.stringify(user));
  return user;
}

export async function tursoSignIn(email, password) {
  if (!tursoClient) {
    throw new Error("Turso database is not configured. Please add VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN in your .env file.");
  }

  await initTursoTables();

  const normalizedEmail = email.trim().toLowerCase();

  const result = await tursoClient.execute({
    sql: 'SELECT id, name, email, shortProfile, avatar, password, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE email = ? LIMIT 1;',
    args: [normalizedEmail]
  });

  if (result.rows.length === 0) {
    throw new Error("Invalid email or password.");
  }

  const userRow = result.rows[0];
  if (userRow.password !== password) {
    throw new Error("Invalid email or password.");
  }

  const user = {
    id: String(userRow.id),
    name: String(userRow.name),
    email: String(userRow.email),
    shortProfile: userRow.shortProfile ? String(userRow.shortProfile) : '',
    avatar: userRow.avatar ? String(userRow.avatar) : '',
    bkashNumber: userRow.bkashNumber ? String(userRow.bkashNumber) : '',
    nagadNumber: userRow.nagadNumber ? String(userRow.nagadNumber) : '',
    rocketNumber: userRow.rocketNumber ? String(userRow.rocketNumber) : '',
    primaryMfs: userRow.primaryMfs ? String(userRow.primaryMfs) : 'BKASH'
  };

  localStorage.setItem('splitup_turso_user', JSON.stringify(user));
  return user;
}

export function tursoGetCurrentUser() {
  const stored = localStorage.getItem('splitup_turso_user');
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function tursoSignOut() {
  localStorage.removeItem('splitup_turso_user');
}

// ----------------- Data Operations -----------------

export async function tursoGetMembers(groupId = null) {
  if (!tursoClient) return [];
  await initTursoTables();

  const sql = groupId 
    ? `SELECT m.*, u.bkashNumber, u.nagadNumber, u.rocketNumber, u.primaryMfs 
       FROM members m 
       LEFT JOIN users u ON (m.userId = u.id OR (m.email IS NOT NULL AND LOWER(m.email) = LOWER(u.email)))
       WHERE m.groupId = ?;` 
    : `SELECT m.*, u.bkashNumber, u.nagadNumber, u.rocketNumber, u.primaryMfs 
       FROM members m 
       LEFT JOIN users u ON (m.userId = u.id OR (m.email IS NOT NULL AND LOWER(m.email) = LOWER(u.email)));`;
  const args = groupId ? [String(groupId)] : [];

  const res = await tursoClient.execute({ sql, args });
  return res.rows.map(row => ({
    id: isNaN(Number(row.id)) ? String(row.id) : Number(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : '',
    groupId: isNaN(Number(row.groupId)) ? String(row.groupId) : Number(row.groupId),
    userId: row.userId ? String(row.userId) : null,
    bkashNumber: row.bkashNumber ? String(row.bkashNumber) : '',
    nagadNumber: row.nagadNumber ? String(row.nagadNumber) : '',
    rocketNumber: row.rocketNumber ? String(row.rocketNumber) : '',
    primaryMfs: row.primaryMfs ? String(row.primaryMfs) : 'BKASH'
  }));
}

export function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function tursoAddMember(groupId, name, email = '', userId = null) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  let resolvedUserId = userId;
  let resolvedName = name.trim();
  let resolvedEmail = email ? email.trim().toLowerCase() : null;

  // If email was provided and no userId, check if user with this email is already registered
  if (resolvedEmail && !resolvedUserId) {
    try {
      const userCheck = await tursoClient.execute({
        sql: 'SELECT id, name FROM users WHERE LOWER(email) = ? LIMIT 1;',
        args: [resolvedEmail]
      });
      if (userCheck.rows.length > 0) {
        resolvedUserId = String(userCheck.rows[0].id);
        if (!resolvedName) resolvedName = String(userCheck.rows[0].name);
      }
    } catch (_) {}
  }

  const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await tursoClient.execute({
    sql: 'INSERT INTO members (id, name, email, groupId, userId) VALUES (?, ?, ?, ?, ?);',
    args: [id, resolvedName, resolvedEmail, String(groupId), resolvedUserId]
  });

  return { id, name: resolvedName, email: resolvedEmail, groupId, userId: resolvedUserId };
}

export async function tursoGetExpenses(groupId = null) {
  if (!tursoClient) return [];
  await initTursoTables();

  const sql = groupId 
    ? 'SELECT * FROM expenses WHERE (isPersonal = 0 OR isPersonal IS NULL) AND groupId = ? ORDER BY date DESC;' 
    : "SELECT * FROM expenses WHERE (isPersonal = 0 OR isPersonal IS NULL) AND groupId != 'personal' ORDER BY date DESC;";
  const args = groupId ? [String(groupId)] : [];

  const res = await tursoClient.execute({ sql, args });
  return res.rows.map(row => {
    let participants = [];
    try {
      participants = row.participants ? JSON.parse(String(row.participants)) : [];
    } catch {
      participants = [];
    }

    return {
      id: String(row.id),
      groupId: isNaN(Number(row.groupId)) ? String(row.groupId) : Number(row.groupId),
      title: String(row.title),
      amount: Number(row.amount),
      paidBy: isNaN(Number(row.paidBy)) ? String(row.paidBy) : Number(row.paidBy),
      paidByMemberId: row.paidByMemberId ? String(row.paidByMemberId) : null,
      date: Number(row.date),
      category: row.category ? String(row.category) : 'OTHER',
      currencyCode: row.currencyCode ? String(row.currencyCode) : 'BDT',
      notes: row.notes ? String(row.notes) : '',
      participants,
      isPersonal: false
    };
  });
}

export async function tursoAddExpense(expense) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const id = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const participantsJson = JSON.stringify(expense.participants || []);

  await tursoClient.execute({
    sql: `INSERT INTO expenses (id, groupId, userId, isPersonal, title, amount, paidBy, paidByMemberId, date, category, currencyCode, notes, participants)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      id,
      String(expense.groupId || '1'),
      expense.userId ? String(expense.userId) : null,
      0,
      expense.title.trim(),
      Number(expense.amount),
      String(expense.paidBy),
      String(expense.paidByMemberId || expense.paidBy),
      Number(expense.date || Date.now()),
      expense.category || 'OTHER',
      expense.currencyCode || 'BDT',
      expense.notes || '',
      participantsJson
    ]
  });

  return { ...expense, id, isPersonal: false };
}

// ----------------- Personal Expenses Operations -----------------

export async function tursoGetPersonalExpenses(userOrId) {
  if (!tursoClient || !userOrId) return [];
  await initTursoTables();

  const userId = typeof userOrId === 'object' ? userOrId?.id : userOrId;
  const userEmail = typeof userOrId === 'object' ? userOrId?.email : null;

  let sql = "SELECT * FROM expenses WHERE (isPersonal = 1 OR groupId = 'personal') AND (userId = ?";
  const args = [String(userId)];

  if (userEmail) {
    sql += " OR userId IN (SELECT id FROM users WHERE LOWER(email) = LOWER(?))";
    args.push(String(userEmail));
    sql += " OR userId IN (SELECT id FROM members WHERE LOWER(email) = LOWER(?))";
    args.push(String(userEmail));
  }
  sql += ") ORDER BY date DESC;";

  const res = await tursoClient.execute({ sql, args });

  return res.rows.map(row => ({
    id: String(row.id),
    title: String(row.title),
    amount: Number(row.amount),
    category: row.category ? String(row.category) : 'General',
    notes: row.notes ? String(row.notes) : '',
    date: Number(row.date),
    currencyCode: row.currencyCode ? String(row.currencyCode) : 'BDT',
    topic: row.topic ? String(row.topic) : '',
    isPersonal: true
  }));
}

export async function tursoAddPersonalExpense(expense) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const id = `exp_p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await tursoClient.execute({
    sql: `INSERT INTO expenses (id, groupId, userId, isPersonal, title, amount, paidBy, paidByMemberId, date, category, currencyCode, notes, participants, topic)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      id,
      'personal',
      String(expense.userId),
      1,
      expense.title.trim(),
      Number(expense.amount),
      expense.userName || 'User',
      String(expense.userId),
      Number(expense.date || Date.now()),
      expense.category || 'Other',
      expense.currencyCode || 'BDT',
      expense.notes || '',
      '[]',
      expense.topic ? expense.topic.trim() : ''
    ]
  });

  return { ...expense, id, isPersonal: true };
}

export async function tursoDeleteExpense(expenseId) {
  if (!tursoClient || !expenseId) return;
  await initTursoTables();
  await tursoClient.execute({
    sql: 'DELETE FROM expenses WHERE id = ?;',
    args: [String(expenseId)]
  });
}

// ----------------- Personal Topics Operations -----------------

export async function tursoGetPersonalTopics(userOrId = null) {
  if (!tursoClient) return [];
  await initTursoTables();

  const userId = typeof userOrId === 'object' ? userOrId?.id : userOrId;
  let sql = 'SELECT * FROM personal_topics';
  const args = [];

  if (userId) {
    sql += ' WHERE userId = ?';
    args.push(String(userId));
  }
  sql += ' ORDER BY createdAt DESC;';

  try {
    const res = await tursoClient.execute({ sql, args });
    return res.rows.map(row => ({
      id: String(row.id),
      userId: String(row.userId),
      name: String(row.name),
      description: row.description ? String(row.description) : '',
      budget: Number(row.budget || 0),
      icon: row.icon ? String(row.icon) : 'ph-folder-simple',
      color: row.color ? String(row.color) : '#6c5ce7',
      createdAt: Number(row.createdAt)
    }));
  } catch (err) {
    console.warn("Could not query personal_topics table:", err.message);
    return [];
  }
}

export async function tursoAddPersonalTopic(topic) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const id = topic.id || `tpc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  await tursoClient.execute({
    sql: `INSERT INTO personal_topics (id, userId, name, description, budget, icon, color, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      id,
      String(topic.userId),
      topic.name.trim(),
      topic.description ? topic.description.trim() : '',
      Number(topic.budget || 0),
      topic.icon || 'ph-folder-simple',
      topic.color || '#6c5ce7',
      now
    ]
  });

  return { ...topic, id, createdAt: now };
}

export async function tursoDeletePersonalTopic(topicId) {
  if (!tursoClient || !topicId) return;
  await initTursoTables();
  await tursoClient.execute({
    sql: 'DELETE FROM personal_topics WHERE id = ?;',
    args: [String(topicId)]
  });
}

// ----------------- Settlements Operations -----------------

export async function tursoGetSettlements(groupId = null) {
  if (!tursoClient) return [];
  await initTursoTables();

  const sql = groupId 
    ? 'SELECT * FROM settlements WHERE groupId = ? ORDER BY date DESC;' 
    : 'SELECT * FROM settlements ORDER BY date DESC;';
  const args = groupId ? [String(groupId)] : [];

  const res = await tursoClient.execute({ sql, args });
  return res.rows.map(row => ({
    id: String(row.id),
    groupId: isNaN(Number(row.groupId)) ? String(row.groupId) : Number(row.groupId),
    paidBy: isNaN(Number(row.paidBy)) ? String(row.paidBy) : Number(row.paidBy),
    paidTo: isNaN(Number(row.paidTo)) ? String(row.paidTo) : Number(row.paidTo),
    amount: Number(row.amount),
    date: Number(row.date),
    paymentMethod: row.paymentMethod ? String(row.paymentMethod) : 'Cash',
    trxId: row.trxId ? String(row.trxId) : null
  }));
}

export async function tursoAddSettlement(settlement) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const id = `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await tursoClient.execute({
    sql: `INSERT INTO settlements (id, groupId, paidBy, paidTo, amount, date, paymentMethod, trxId)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      id,
      String(settlement.groupId || '1'),
      String(settlement.paidBy),
      String(settlement.paidTo),
      Number(settlement.amount),
      Number(settlement.date || Date.now()),
      settlement.paymentMethod || 'Cash',
      settlement.trxId || null
    ]
  });

  return { ...settlement, id };
}

export async function tursoDeleteSettlement(settlementId) {
  if (!tursoClient || !settlementId) return;
  await initTursoTables();
  await tursoClient.execute({
    sql: 'DELETE FROM settlements WHERE id = ?;',
    args: [String(settlementId)]
  });
}

// ----------------- Group Operations with Join Code -----------------

export async function tursoGetGroups(user = null) {
  if (!tursoClient) return [];
  await initTursoTables();

  let sql = 'SELECT * FROM groups ORDER BY createdAt DESC;';
  let args = [];

  if (user && user.id) {
    sql = `
      SELECT DISTINCT g.* FROM groups g
      LEFT JOIN members m ON g.id = m.groupId
      WHERE g.createdBy = ? OR m.userId = ? OR (m.email IS NOT NULL AND LOWER(m.email) = ?)
      ORDER BY g.createdAt DESC;
    `;
    args = [String(user.id), String(user.id), (user.email || '').toLowerCase().trim()];
  }

  const res = await tursoClient.execute({ sql, args });
  return res.rows.map(row => ({
    id: String(row.id),
    name: String(row.name),
    createdBy: row.createdBy ? String(row.createdBy) : null,
    joinCode: row.joinCode ? String(row.joinCode) : '',
    createdAt: Number(row.createdAt)
  }));
}

export async function tursoCreateGroup(name, createdBy = 'user') {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const id = `grp_${Date.now()}`;
  const now = Date.now();
  const joinCode = generateJoinCode();

  await tursoClient.execute({
    sql: 'INSERT INTO groups (id, name, createdBy, joinCode, createdAt) VALUES (?, ?, ?, ?, ?);',
    args: [id, name.trim(), createdBy, joinCode, now]
  });

  return { id, name: name.trim(), createdBy, joinCode, createdAt: now };
}

export async function tursoDeleteGroup(groupId) {
  if (!tursoClient || !groupId) return;
  await initTursoTables();
  const gid = String(groupId);
  await tursoClient.batch([
    { sql: 'DELETE FROM groups WHERE id = ?;', args: [gid] },
    { sql: 'DELETE FROM members WHERE groupId = ?;', args: [gid] },
    { sql: 'DELETE FROM expenses WHERE groupId = ?;', args: [gid] },
    { sql: 'DELETE FROM settlements WHERE groupId = ?;', args: [gid] }
  ]);
}

export async function tursoJoinGroupByCode(joinCode, currentUser) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const code = joinCode.trim().toUpperCase();
  const res = await tursoClient.execute({
    sql: 'SELECT * FROM groups WHERE UPPER(joinCode) = ? LIMIT 1;',
    args: [code]
  });

  if (res.rows.length === 0) {
    throw new Error("Invalid Join Code. No group found with code: " + code);
  }

  const groupRow = res.rows[0];
  const groupId = String(groupRow.id);

  // Check if member already exists in group
  const existing = await tursoClient.execute({
    sql: 'SELECT id FROM members WHERE groupId = ? AND (userId = ? OR (email IS NOT NULL AND LOWER(email) = ?));',
    args: [groupId, currentUser.id, (currentUser.email || '').toLowerCase().trim()]
  });

  if (existing.rows.length > 0) {
    return {
      id: groupId,
      name: String(groupRow.name),
      joinCode: code,
      alreadyMember: true
    };
  }

  // Add current user as member
  const memberId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await tursoClient.execute({
    sql: 'INSERT INTO members (id, name, email, groupId, userId) VALUES (?, ?, ?, ?, ?);',
    args: [memberId, currentUser.name, (currentUser.email || '').toLowerCase().trim(), groupId, currentUser.id]
  });

  return {
    id: groupId,
    name: String(groupRow.name),
    joinCode: code,
    alreadyMember: false
  };
}

// ----------------- Google OAuth Helper -----------------

export function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to decode JWT:", e);
    return null;
  }
}

export async function tursoGoogleSignIn(credentialToken) {
  if (!tursoClient) {
    throw new Error("Turso database is not configured.");
  }
  await initTursoTables();

  const payload = decodeJwt(credentialToken);
  if (!payload || !payload.email) {
    throw new Error("Invalid Google account data received.");
  }

  const email = payload.email.trim().toLowerCase();
  const name = payload.name || email.split('@')[0];
  const avatar = payload.picture || '';
  const googleId = payload.sub || '';

  // Check if user already exists in Turso
  const existing = await tursoClient.execute({
    sql: 'SELECT id, name, email, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE email = ? LIMIT 1;',
    args: [email]
  });

  let user;
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    if (avatar) {
      try {
        await tursoClient.execute({
          sql: 'UPDATE users SET avatar = ? WHERE email = ?;',
          args: [avatar, email]
        });
      } catch (_) {}
    }
    user = {
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      shortProfile: row.shortProfile ? String(row.shortProfile) : '',
      avatar: avatar || (row.avatar ? String(row.avatar) : ''),
      bkashNumber: row.bkashNumber ? String(row.bkashNumber) : '',
      nagadNumber: row.nagadNumber ? String(row.nagadNumber) : '',
      rocketNumber: row.rocketNumber ? String(row.rocketNumber) : '',
      primaryMfs: row.primaryMfs ? String(row.primaryMfs) : 'BKASH'
    };
  } else {
    // New Google user! Register in users
    const userId = `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = Date.now();

    await tursoClient.execute({
      sql: 'INSERT INTO users (id, name, email, password, shortProfile, avatar, createdAt, primaryMfs) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      args: [userId, name, email, `google_oauth_${googleId}`, 'Google Account', avatar, now, 'BKASH']
    });

    user = {
      id: userId,
      name,
      email,
      shortProfile: 'Google Account',
      avatar,
      bkashNumber: '',
      nagadNumber: '',
      rocketNumber: '',
      primaryMfs: 'BKASH'
    };
  }

  localStorage.setItem('splitup_turso_user', JSON.stringify(user));
  return user;
}

// ----------------- Profile & Data Backup/Restore -----------------

export async function tursoUpdateUserProfile(userId, { name, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs }) {
  const current = tursoGetCurrentUser() || {};
  const trimmedName = (name !== undefined ? name : current.name || '').trim();
  const trimmedProfile = (shortProfile !== undefined ? shortProfile : current.shortProfile || '').trim();
  const updatedAvatar = avatar !== undefined ? avatar : (current.avatar || '');
  const updatedBkash = bkashNumber !== undefined ? bkashNumber.trim() : (current.bkashNumber || '');
  const updatedNagad = nagadNumber !== undefined ? nagadNumber.trim() : (current.nagadNumber || '');
  const updatedRocket = rocketNumber !== undefined ? rocketNumber.trim() : (current.rocketNumber || '');
  const updatedPrimaryMfs = primaryMfs !== undefined ? primaryMfs : (current.primaryMfs || 'BKASH');

  if (!tursoClient) {
    // Offline / local fallback
    const updated = {
      ...current,
      name: trimmedName,
      shortProfile: trimmedProfile,
      avatar: updatedAvatar,
      bkashNumber: updatedBkash,
      nagadNumber: updatedNagad,
      rocketNumber: updatedRocket,
      primaryMfs: updatedPrimaryMfs
    };
    localStorage.setItem('splitup_turso_user', JSON.stringify(updated));
    return updated;
  }

  await initTursoTables();

  await tursoClient.execute({
    sql: 'UPDATE users SET name = ?, shortProfile = ?, avatar = ?, bkashNumber = ?, nagadNumber = ?, rocketNumber = ?, primaryMfs = ? WHERE id = ?;',
    args: [
      trimmedName, 
      trimmedProfile, 
      updatedAvatar, 
      updatedBkash, 
      updatedNagad, 
      updatedRocket, 
      updatedPrimaryMfs, 
      String(userId)
    ]
  });

  try {
    await tursoClient.execute({
      sql: 'UPDATE members SET name = ? WHERE userId = ? OR id = ?;',
      args: [trimmedName, String(userId), String(userId)]
    });
  } catch (_) {}

  const updated = {
    ...current,
    name: trimmedName || current.name,
    shortProfile: trimmedProfile,
    avatar: updatedAvatar,
    bkashNumber: updatedBkash,
    nagadNumber: updatedNagad,
    rocketNumber: updatedRocket,
    primaryMfs: updatedPrimaryMfs
  };
  localStorage.setItem('splitup_turso_user', JSON.stringify(updated));
  return updated;
}

export async function tursoSyncCurrentUser(userId, email) {
  if (!tursoClient) return tursoGetCurrentUser();
  try {
    await initTursoTables();
    let result = null;
    if (userId) {
      result = await tursoClient.execute({
        sql: 'SELECT id, name, email, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE id = ? LIMIT 1;',
        args: [String(userId)]
      });
    }
    if ((!result || result.rows.length === 0) && email) {
      result = await tursoClient.execute({
        sql: 'SELECT id, name, email, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE email = ? LIMIT 1;',
        args: [email.trim().toLowerCase()]
      });
    }

    if (result && result.rows.length > 0) {
      const row = result.rows[0];
      const current = tursoGetCurrentUser() || {};
      const updated = {
        ...current,
        id: String(row.id),
        name: String(row.name),
        email: String(row.email),
        shortProfile: row.shortProfile ? String(row.shortProfile) : '',
        avatar: row.avatar ? String(row.avatar) : (current.avatar || ''),
        bkashNumber: row.bkashNumber ? String(row.bkashNumber) : '',
        nagadNumber: row.nagadNumber ? String(row.nagadNumber) : '',
        rocketNumber: row.rocketNumber ? String(row.rocketNumber) : '',
        primaryMfs: row.primaryMfs ? String(row.primaryMfs) : 'BKASH'
      };
      localStorage.setItem('splitup_turso_user', JSON.stringify(updated));
      return updated;
    }
  } catch (err) {
    console.warn("Failed to sync current user from Turso:", err);
  }
  return tursoGetCurrentUser();
}

export async function tursoExportAllData(userId) {
  if (!tursoClient) {
    return {
      version: "2.3.20",
      exportedAt: new Date().toISOString(),
      source: "local",
      data: {}
    };
  }

  await initTursoTables();
  const [groups, members, expenses, settlements] = await Promise.all([
    tursoClient.execute('SELECT * FROM groups;'),
    tursoClient.execute('SELECT * FROM members;'),
    tursoClient.execute('SELECT * FROM expenses;'),
    tursoClient.execute('SELECT * FROM settlements;')
  ]);

  return {
    version: "2.3.20",
    exportedAt: new Date().toISOString(),
    source: "SplitUP Turso Cloud",
    userId,
    groups: groups.rows,
    members: members.rows,
    expenses: expenses.rows,
    settlements: settlements.rows
  };
}

export async function tursoRestoreData(backupData, currentUserId) {
  if (!tursoClient) throw new Error("Turso database is not connected.");
  await initTursoTables();

  if (!backupData || (!backupData.groups && !backupData.expenses)) {
    throw new Error("Invalid backup file format. Missing groups or expenses.");
  }

  const statements = [];

  // Restore Groups
  if (Array.isArray(backupData.groups)) {
    for (const g of backupData.groups) {
      statements.push({
        sql: 'INSERT OR REPLACE INTO groups (id, name, createdBy, joinCode, createdAt) VALUES (?, ?, ?, ?, ?);',
        args: [String(g.id), String(g.name), g.createdBy ? String(g.createdBy) : null, g.joinCode ? String(g.joinCode) : null, Number(g.createdAt || Date.now())]
      });
    }
  }

  // Restore Members
  if (Array.isArray(backupData.members)) {
    for (const m of backupData.members) {
      statements.push({
        sql: 'INSERT OR REPLACE INTO members (id, name, email, groupId, userId) VALUES (?, ?, ?, ?, ?);',
        args: [String(m.id), String(m.name), m.email ? String(m.email) : null, String(m.groupId), m.userId ? String(m.userId) : null]
      });
    }
  }

  // Restore Expenses
  if (Array.isArray(backupData.expenses)) {
    for (const e of backupData.expenses) {
      statements.push({
        sql: `INSERT OR REPLACE INTO expenses (id, groupId, userId, isPersonal, title, amount, paidBy, paidByMemberId, date, category, currencyCode, notes, participants) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          String(e.id),
          String(e.groupId || '1'),
          e.userId ? String(e.userId) : null,
          e.isPersonal ? Number(e.isPersonal) : 0,
          String(e.title || 'Expense'),
          Number(e.amount || 0),
          String(e.paidBy || 'Member'),
          e.paidByMemberId ? String(e.paidByMemberId) : null,
          Number(e.date || Date.now()),
          e.category ? String(e.category) : 'General',
          e.currencyCode ? String(e.currencyCode) : 'BDT',
          e.notes ? String(e.notes) : null,
          typeof e.participants === 'string' ? e.participants : JSON.stringify(e.participants || [])
        ]
      });
    }
  }

  // Restore Settlements
  if (Array.isArray(backupData.settlements)) {
    for (const s of backupData.settlements) {
      statements.push({
        sql: 'INSERT OR REPLACE INTO settlements (id, groupId, paidBy, paidTo, amount, date, paymentMethod) VALUES (?, ?, ?, ?, ?, ?, ?);',
        args: [
          String(s.id),
          String(s.groupId || '1'),
          String(s.paidBy),
          String(s.paidTo),
          Number(s.amount || 0),
          Number(s.date || Date.now()),
          String(s.paymentMethod || 'CASH')
        ]
      });
    }
  }

  if (statements.length > 0) {
    // Execute batch
    await tursoClient.batch(statements);
  }

  return { success: true, count: statements.length };
}
