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
      );`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data TEXT,
        status TEXT DEFAULT 'UNREAD',
        createdAt INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS group_requests (
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        userId TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        createdById TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );`
    ]);

    // Safe column migrations in case tables were previously created without these columns
    try {
      await tursoClient.execute("ALTER TABLE groups ADD COLUMN joinCode TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(userId, createdAt DESC);");
    } catch (_) {}
    try {
      await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_group_requests_group ON group_requests(groupId, status);");
    } catch (_) {}
    try {
      await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_group_requests_user ON group_requests(userId, status);");
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
      await tursoClient.execute("ALTER TABLE settlements ADD COLUMN payerName TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE settlements ADD COLUMN payeeName TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE settlements ADD COLUMN notes TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE members ADD COLUMN phone TEXT;");
    } catch (_) {}
    try {
      await tursoClient.execute("ALTER TABLE users ADD COLUMN username TEXT;");
    } catch (_) {}

    // Backfill unique username for any existing users missing one
    try {
      const missingUsers = await tursoClient.execute("SELECT id, name, email FROM users WHERE username IS NULL OR username = '';");
      for (const row of missingUsers.rows) {
        let base = (row.email ? String(row.email).split('@')[0] : String(row.name))
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '');
        if (!base || base.length < 3) base = `user_${Math.random().toString(36).substring(2, 6)}`;
        
        // Ensure uniqueness
        const check = await tursoClient.execute({
          sql: "SELECT id FROM users WHERE LOWER(username) = ? AND id != ? LIMIT 1;",
          args: [base, String(row.id)]
        });
        const assignedUsername = check.rows.length > 0 ? `${base}_${Math.random().toString(36).substring(2, 5)}` : base;
        await tursoClient.execute({
          sql: "UPDATE users SET username = ? WHERE id = ?;",
          args: [assignedUsername, String(row.id)]
        });
      }
    } catch (migErr) {
      console.warn("Notice: user username migration backfill:", migErr);
    }

    // Deduplicate any duplicate usernames (case-insensitive) across existing users before creating unique index
    try {
      const dupRows = await tursoClient.execute(`
        SELECT LOWER(username) AS uname, COUNT(*) AS cnt 
        FROM users 
        WHERE username IS NOT NULL AND username != '' 
        GROUP BY LOWER(username) 
        HAVING cnt > 1;
      `);
      for (const row of dupRows.rows) {
        const uname = String(row.uname);
        const usersWithUname = await tursoClient.execute({
          sql: "SELECT id FROM users WHERE LOWER(username) = ? ORDER BY createdAt ASC;",
          args: [uname]
        });
        // Leave the first user with their username, rename subsequent duplicates
        for (let i = 1; i < usersWithUname.rows.length; i++) {
          const dupUserId = String(usersWithUname.rows[i].id);
          const newUname = `${uname}_${Math.random().toString(36).substring(2, 6)}`;
          await tursoClient.execute({
            sql: "UPDATE users SET username = ? WHERE id = ?;",
            args: [newUname, dupUserId]
          });
        }
      }
    } catch (dupErr) {
      console.warn("Notice: username deduplication check:", dupErr);
    }

    // Enforce case-insensitive unique index on users.username at database level
    try {
      await tursoClient.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(LOWER(username));");
    } catch (idxErr) {
      console.warn("Notice: could not create unique index on username:", idxErr);
    }

    isTablesInitialized = true;
    console.log("Turso tables initialized successfully with unique usernames & join codes.");
  } catch (err) {
    console.error("Failed to initialize Turso tables:", err);
    throw err;
  }
}

// ----------------- Auth Operations -----------------

export async function tursoSignUp(name, email, password, shortProfile = '', username = '') {
  if (!tursoClient) {
    throw new Error("Turso database is not configured. Please add VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN in your .env file.");
  }

  await initTursoTables();

  const normalizedEmail = email.trim().toLowerCase();
  
  // Check if email already exists
  const existing = await tursoClient.execute({
    sql: 'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1;',
    args: [normalizedEmail]
  });

  if (existing.rows.length > 0) {
    throw new Error("A user with this email address already exists.");
  }

  // Derive and validate unique username
  let cleanUsername = (username || normalizedEmail.split('@')[0] || name)
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9_]/g, '');

  if (!cleanUsername || cleanUsername.length < 3) {
    cleanUsername = `user_${Math.random().toString(36).substring(2, 7)}`;
  }

  // If user explicitly provided a username, validate format strictly
  if (username) {
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      throw new Error("Username must be 3-30 characters containing only letters, numbers, and underscores.");
    }

    const existingUsername = await tursoClient.execute({
      sql: 'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1;',
      args: [cleanUsername]
    });

    if (existingUsername.rows.length > 0) {
      throw new Error(`The username @${cleanUsername} is already taken. Please choose another.`);
    }
  } else {
    // If auto-generated from email/name, ensure absolute uniqueness
    let attempts = 0;
    while (attempts < 15) {
      const existingUsername = await tursoClient.execute({
        sql: 'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1;',
        args: [cleanUsername]
      });
      if (existingUsername.rows.length === 0) break;
      cleanUsername = `${(username || normalizedEmail.split('@')[0]).replace(/[^a-z0-9_]/g, '')}_${Math.random().toString(36).substring(2, 6)}`;
      attempts++;
    }
  }

  const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();

  try {
    await tursoClient.execute({
      sql: 'INSERT INTO users (id, name, email, password, shortProfile, username, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);',
      args: [userId, name.trim(), normalizedEmail, password, shortProfile.trim(), cleanUsername, now]
    });
  } catch (insertErr) {
    if (insertErr.message?.includes('UNIQUE constraint failed') || insertErr.message?.includes('idx_users_username_unique')) {
      throw new Error(`The username @${cleanUsername} is already taken. Please choose another.`);
    }
    throw insertErr;
  }

  const user = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    username: cleanUsername,
    shortProfile: shortProfile.trim()
  };

  localStorage.setItem('splitup_turso_user', JSON.stringify(user));
  return user;
}

export async function tursoSignIn(emailOrUsername, password) {
  if (!tursoClient) {
    throw new Error("Turso database is not configured. Please add VITE_TURSO_DATABASE_URL and VITE_TURSO_AUTH_TOKEN in your .env file.");
  }

  await initTursoTables();

  const normalizedInput = emailOrUsername.trim().toLowerCase().replace(/^@/, '');

  const result = await tursoClient.execute({
    sql: 'SELECT id, name, email, username, shortProfile, avatar, password, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1;',
    args: [normalizedInput, normalizedInput]
  });

  if (result.rows.length === 0) {
    throw new Error("Invalid username/email or password.");
  }

  const userRow = result.rows[0];
  if (userRow.password !== password) {
    throw new Error("Invalid username/email or password.");
  }

  const user = {
    id: String(userRow.id),
    name: String(userRow.name),
    email: String(userRow.email),
    username: userRow.username ? String(userRow.username).replace(/^@/, '') : String(userRow.email).split('@')[0],
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

/**
 * Check if a username is available in real-time.
 * @param {string} rawUsername - The candidate username.
 * @param {string|null} currentUserId - The current user's ID if updating their profile (so their own current handle isn't flagged as taken).
 * @returns {Promise<{ available: boolean, cleanUsername: string, reason?: string, isSelf?: boolean }>}
 */
export async function tursoCheckUsernameAvailability(rawUsername, currentUserId = null) {
  if (!rawUsername) {
    return { available: false, cleanUsername: '', reason: 'Username cannot be empty.' };
  }

  const cleanUsername = String(rawUsername)
    .trim()
    .toLowerCase()
    .replace(/^@/, '');

  if (cleanUsername.length < 3) {
    return { 
      available: false, 
      cleanUsername, 
      reason: 'Username must be at least 3 characters.' 
    };
  }

  if (cleanUsername.length > 30) {
    return { 
      available: false, 
      cleanUsername, 
      reason: 'Username cannot exceed 30 characters.' 
    };
  }

  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    return { 
      available: false, 
      cleanUsername, 
      reason: 'Only lowercase letters, numbers, and underscores allowed.' 
    };
  }

  if (!tursoClient) {
    const cur = tursoGetCurrentUser();
    if (cur && cur.id === currentUserId && cur.username?.toLowerCase() === cleanUsername) {
      return { available: true, cleanUsername, isSelf: true };
    }
    return { available: true, cleanUsername };
  }

  try {
    await initTursoTables();

    if (currentUserId) {
      const selfCheck = await tursoClient.execute({
        sql: 'SELECT id, username FROM users WHERE id = ? LIMIT 1;',
        args: [String(currentUserId)]
      });
      if (selfCheck.rows.length > 0 && String(selfCheck.rows[0].username || '').toLowerCase() === cleanUsername) {
        return { available: true, cleanUsername, isSelf: true };
      }
    }

    const check = await tursoClient.execute({
      sql: 'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1;',
      args: [cleanUsername]
    });

    if (check.rows.length > 0) {
      return { 
        available: false, 
        cleanUsername, 
        reason: `@${cleanUsername} is already taken.` 
      };
    }

    return { available: true, cleanUsername };
  } catch (err) {
    console.error("tursoCheckUsernameAvailability error:", err);
    return { available: false, cleanUsername, reason: 'Failed to check username availability.' };
  }
}

// ----------------- Data Operations -----------------

export async function tursoGetMembers(groupId = null) {
  if (!tursoClient) return [];
  await initTursoTables();

  const sql = groupId 
    ? `SELECT m.*, u.username, u.avatar, u.bkashNumber, u.nagadNumber, u.rocketNumber, u.primaryMfs 
       FROM members m 
       LEFT JOIN users u ON (m.userId = u.id OR (m.email IS NOT NULL AND LOWER(m.email) = LOWER(u.email)))
       WHERE m.groupId = ?;` 
    : `SELECT m.*, u.username, u.avatar, u.bkashNumber, u.nagadNumber, u.rocketNumber, u.primaryMfs 
       FROM members m 
       LEFT JOIN users u ON (m.userId = u.id OR (m.email IS NOT NULL AND LOWER(m.email) = LOWER(u.email)));`;
  const args = groupId ? [String(groupId)] : [];

  const res = await tursoClient.execute({ sql, args });
  return res.rows.map(row => ({
    id: isNaN(Number(row.id)) ? String(row.id) : Number(row.id),
    name: String(row.name),
    email: row.email ? String(row.email) : '',
    username: row.username ? String(row.username).replace(/^@/, '') : (row.email ? String(row.email).split('@')[0] : ''),
    avatar: row.avatar ? String(row.avatar) : '',
    phone: row.phone ? String(row.phone) : '',
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

export async function tursoSearchUsers(query, excludeUserIds = []) {
  if (!tursoClient) return [];
  await initTursoTables();
  const raw = (query || '').trim();
  const q = raw.replace(/^@/, '').toLowerCase();
  if (!q) return [];

  const searchPattern = `%${q}%`;
  const res = await tursoClient.execute({
    sql: `SELECT id, name, email, username, avatar, bkashNumber, nagadNumber, rocketNumber, shortProfile 
          FROM users 
          WHERE (
            LOWER(username) LIKE ? OR 
            LOWER(email) LIKE ? OR 
            LOWER(name) LIKE ? OR 
            bkashNumber LIKE ? OR 
            nagadNumber LIKE ?
          )
          LIMIT 15;`,
    args: [searchPattern, searchPattern, searchPattern, searchPattern, searchPattern]
  });

  const excludeSet = new Set((excludeUserIds || []).map(String));
  return res.rows
    .filter(row => !excludeSet.has(String(row.id)))
    .map(row => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      username: row.username ? String(row.username).replace(/^@/, '') : String(row.email).split('@')[0],
      avatar: row.avatar ? String(row.avatar) : '',
      shortProfile: row.shortProfile ? String(row.shortProfile) : '',
      phone: row.bkashNumber || row.nagadNumber || row.rocketNumber || ''
    }));
}

export async function tursoGetSuggestedUsers(excludeUserIds = [], limit = 6) {
  if (!tursoClient) return [];
  await initTursoTables();
  const res = await tursoClient.execute({
    sql: `SELECT id, name, email, username, avatar, shortProfile FROM users ORDER BY createdAt DESC LIMIT 20;`,
    args: []
  });
  const excludeSet = new Set((excludeUserIds || []).map(String));
  return res.rows
    .filter(row => !excludeSet.has(String(row.id)))
    .slice(0, limit)
    .map(row => ({
      id: String(row.id),
      name: String(row.name),
      email: String(row.email),
      username: row.username ? String(row.username).replace(/^@/, '') : String(row.email).split('@')[0],
      avatar: row.avatar ? String(row.avatar) : '',
      shortProfile: row.shortProfile ? String(row.shortProfile) : ''
    }));
}

export async function tursoAddMember(groupId, name, email = '', userId = null, phone = '') {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  let resolvedUserId = userId;
  let resolvedName = name.trim();
  let resolvedEmail = email ? email.trim().toLowerCase() : null;
  let resolvedPhone = phone ? phone.trim() : null;

  // 1. If userId is provided, verify it exists in users table and get canonical details
  if (resolvedUserId) {
    try {
      const userCheck = await tursoClient.execute({
        sql: 'SELECT id, name, email, bkashNumber, nagadNumber, rocketNumber FROM users WHERE id = ? LIMIT 1;',
        args: [String(resolvedUserId)]
      });
      if (userCheck.rows.length > 0) {
        resolvedName = String(userCheck.rows[0].name);
        resolvedEmail = userCheck.rows[0].email ? String(userCheck.rows[0].email).toLowerCase() : resolvedEmail;
        if (!resolvedPhone) {
          resolvedPhone = userCheck.rows[0].bkashNumber || userCheck.rows[0].nagadNumber || userCheck.rows[0].rocketNumber || null;
        }
      }
    } catch (_) {}
  }

  // 2. If no userId but email was provided, check users table
  if (resolvedEmail && !resolvedUserId) {
    try {
      const userCheck = await tursoClient.execute({
        sql: 'SELECT id, name, email FROM users WHERE LOWER(email) = ? LIMIT 1;',
        args: [resolvedEmail]
      });
      if (userCheck.rows.length > 0) {
        resolvedUserId = String(userCheck.rows[0].id);
        if (!resolvedName) resolvedName = String(userCheck.rows[0].name);
      }
    } catch (_) {}
  }

  // 3. If no userId but username or name was provided, search users table
  if (!resolvedUserId) {
    const cleanSearch = resolvedName.replace(/^@/, '').toLowerCase();
    try {
      const userCheck = await tursoClient.execute({
        sql: 'SELECT id, name, email FROM users WHERE LOWER(username) = ? OR LOWER(name) = ? LIMIT 1;',
        args: [cleanSearch, resolvedName.toLowerCase()]
      });
      if (userCheck.rows.length > 0) {
        resolvedUserId = String(userCheck.rows[0].id);
        if (!resolvedEmail && userCheck.rows[0].email) resolvedEmail = String(userCheck.rows[0].email);
        resolvedName = String(userCheck.rows[0].name);
      }
    } catch (_) {}
  }

  // Strict enforcement: A member MUST be a registered user with a valid account
  if (!resolvedUserId) {
    throw new Error(`Only registered SplitUP accounts can be added to a group. "${resolvedName}" does not have an account. Please share the group invite code with them so they can register and join!`);
  }

  // Check if member already exists in this group
  const existingInGroup = await tursoClient.execute({
    sql: 'SELECT id FROM members WHERE groupId = ? AND (userId = ? OR (email IS NOT NULL AND LOWER(email) = ?));',
    args: [String(groupId), String(resolvedUserId), (resolvedEmail || '').toLowerCase()]
  });
  if (existingInGroup.rows.length > 0) {
    throw new Error(`"${resolvedName}" is already a member of this group.`);
  }

  const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await tursoClient.execute({
    sql: 'INSERT INTO members (id, name, email, phone, groupId, userId) VALUES (?, ?, ?, ?, ?, ?);',
    args: [id, resolvedName, resolvedEmail, resolvedPhone, String(groupId), String(resolvedUserId)]
  });

  return { id, name: resolvedName, email: resolvedEmail, phone: resolvedPhone, groupId, userId: resolvedUserId };
}

export async function tursoUpdateMember(memberId, { name, email, phone }) {
  if (!tursoClient || !memberId) return;
  await initTursoTables();

  const updates = [];
  const args = [];

  if (name !== undefined) {
    updates.push('name = ?');
    args.push(name.trim());
  }
  if (email !== undefined) {
    updates.push('email = ?');
    args.push(email ? email.trim().toLowerCase() : null);
  }
  if (phone !== undefined) {
    updates.push('phone = ?');
    args.push(phone ? phone.trim() : null);
  }

  if (updates.length === 0) return;

  args.push(String(memberId));
  await tursoClient.execute({
    sql: `UPDATE members SET ${updates.join(', ')} WHERE id = ?;`,
    args
  });
}

export async function tursoDeleteMember(memberId, groupId = null, requestedByUserId = null) {
  if (!tursoClient || !memberId) return;
  await initTursoTables();

  // Strict security check: Only group creator can remove other members
  if (groupId && requestedByUserId) {
    const grpRes = await tursoClient.execute({
      sql: 'SELECT createdBy FROM groups WHERE id = ? LIMIT 1;',
      args: [String(groupId)]
    });
    if (grpRes.rows.length > 0) {
      const creator = String(grpRes.rows[0].createdBy);
      const memRes = await tursoClient.execute({
        sql: 'SELECT userId FROM members WHERE id = ? LIMIT 1;',
        args: [String(memberId)]
      });
      const memberUserId = memRes.rows.length > 0 ? String(memRes.rows[0].userId) : null;
      const isSelf = memberUserId && String(memberUserId) === String(requestedByUserId);
      const isCreator = String(creator) === String(requestedByUserId);

      if (!isCreator && !isSelf) {
        throw new Error("Only the group creator can remove members from this group.");
      }
    }
  }

  await tursoClient.execute({
    sql: 'DELETE FROM members WHERE id = ?;',
    args: [String(memberId)]
  });
}

export async function tursoUpdateGroup(groupId, { name }) {
  if (!tursoClient || !groupId) return;
  await initTursoTables();
  if (name) {
    await tursoClient.execute({
      sql: 'UPDATE groups SET name = ? WHERE id = ?;',
      args: [name.trim(), String(groupId)]
    });
  }
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

  // Notify group members if shared group expense
  if (!expense.isPersonal && expense.groupId && expense.groupId !== 'personal') {
    try {
      const gid = String(expense.groupId);
      const grpCheck = await tursoClient.execute({
        sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
        args: [gid]
      });
      const groupName = grpCheck.rows.length > 0 ? String(grpCheck.rows[0].name) : 'Group';
      const curUser = tursoGetCurrentUser();
      const senderTag = curUser?.name || 'A member';

      const memRes = await tursoClient.execute({
        sql: 'SELECT DISTINCT userId FROM members WHERE groupId = ? AND userId IS NOT NULL AND userId != ?;',
        args: [gid, String(expense.userId || curUser?.id || '')]
      });

      for (const m of memRes.rows) {
        if (m.userId) {
          await tursoCreateNotification({
            userId: String(m.userId),
            type: 'EXPENSE_ADDED',
            title: `New Expense • ${groupName}`,
            message: `${senderTag} added "${expense.title.trim()}" (${expense.currencyCode || 'BDT'} ${Number(expense.amount).toLocaleString()}) in "${groupName}".`,
            data: {
              groupId: gid,
              groupName,
              expenseId: id,
              amount: Number(expense.amount)
            }
          });
        }
      }
    } catch (notifErr) {
      console.warn("Notice: could not dispatch expense notification:", notifErr);
    }
  }

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

export async function tursoUpdateExpense(expenseId, fields = {}) {
  if (!tursoClient || !expenseId) return;
  await initTursoTables();

  const setClauses = [];
  const args = [];

  if (fields.title !== undefined) {
    setClauses.push('title = ?');
    args.push(fields.title.trim());
  }
  if (fields.amount !== undefined) {
    setClauses.push('amount = ?');
    args.push(Number(fields.amount));
  }
  if (fields.category !== undefined) {
    setClauses.push('category = ?');
    args.push(fields.category);
  }
  if (fields.date !== undefined) {
    setClauses.push('date = ?');
    args.push(Number(fields.date));
  }
  if (fields.notes !== undefined) {
    setClauses.push('notes = ?');
    args.push(fields.notes);
  }
  if (fields.topic !== undefined) {
    setClauses.push('topic = ?');
    args.push(fields.topic ? fields.topic.trim() : '');
  }
  if (fields.paidBy !== undefined) {
    setClauses.push('paidBy = ?');
    args.push(String(fields.paidBy));
  }
  if (fields.paidByMemberId !== undefined) {
    setClauses.push('paidByMemberId = ?');
    args.push(String(fields.paidByMemberId));
  }
  if (fields.participants !== undefined) {
    setClauses.push('participants = ?');
    args.push(typeof fields.participants === 'string' ? fields.participants : JSON.stringify(fields.participants || []));
  }

  if (setClauses.length === 0) return;

  args.push(String(expenseId));
  await tursoClient.execute({
    sql: `UPDATE expenses SET ${setClauses.join(', ')} WHERE id = ?;`,
    args
  });

  // Notify members about expense update
  try {
    const expRow = await tursoClient.execute({
      sql: 'SELECT groupId, title FROM expenses WHERE id = ? LIMIT 1;',
      args: [String(expenseId)]
    });
    if (expRow.rows.length > 0 && expRow.rows[0].groupId && expRow.rows[0].groupId !== 'personal') {
      const gid = String(expRow.rows[0].groupId);
      const grpCheck = await tursoClient.execute({
        sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
        args: [gid]
      });
      const groupName = grpCheck.rows.length > 0 ? String(grpCheck.rows[0].name) : 'Group';
      const curUser = tursoGetCurrentUser();
      const senderTag = curUser?.name || 'A member';

      const memRes = await tursoClient.execute({
        sql: 'SELECT DISTINCT userId FROM members WHERE groupId = ? AND userId IS NOT NULL AND userId != ?;',
        args: [gid, String(curUser?.id || '')]
      });

      for (const m of memRes.rows) {
        if (m.userId) {
          await tursoCreateNotification({
            userId: String(m.userId),
            type: 'EXPENSE_UPDATED',
            title: `Expense Updated • ${groupName}`,
            message: `${senderTag} updated "${fields.title || expRow.rows[0].title}" in "${groupName}".`,
            data: {
              groupId: gid,
              groupName,
              expenseId: String(expenseId)
            }
          });
        }
      }
    }
  } catch (_) {}
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

export async function tursoUpdatePersonalTopic(topicId, fields = {}) {
  if (!tursoClient || !topicId) return;
  await initTursoTables();

  const setClauses = [];
  const args = [];

  if (fields.name !== undefined) {
    setClauses.push('name = ?');
    args.push(fields.name.trim());
  }
  if (fields.description !== undefined) {
    setClauses.push('description = ?');
    args.push(fields.description.trim());
  }
  if (fields.budget !== undefined) {
    setClauses.push('budget = ?');
    args.push(Number(fields.budget || 0));
  }
  if (fields.icon !== undefined) {
    setClauses.push('icon = ?');
    args.push(fields.icon);
  }
  if (fields.color !== undefined) {
    setClauses.push('color = ?');
    args.push(fields.color);
  }

  if (setClauses.length === 0) return;

  args.push(String(topicId));
  await tursoClient.execute({
    sql: `UPDATE personal_topics SET ${setClauses.join(', ')} WHERE id = ?;`,
    args
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
    groupId: String(row.groupId),
    paidBy: String(row.paidBy),
    paidTo: String(row.paidTo),
    payerName: row.payerName ? String(row.payerName) : null,
    payeeName: row.payeeName ? String(row.payeeName) : null,
    amount: Number(row.amount),
    date: Number(row.date),
    paymentMethod: row.paymentMethod ? String(row.paymentMethod) : 'Cash',
    trxId: row.trxId ? String(row.trxId) : null,
    notes: row.notes ? String(row.notes) : null
  }));
}

export async function tursoAddSettlement(settlement) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  // Strict check: Only the user whose ID it is can settle and pay their own debt
  const loggedUser = tursoGetCurrentUser();
  if (loggedUser) {
    const memCheck = await tursoClient.execute({
      sql: 'SELECT id, userId FROM members WHERE id = ? LIMIT 1;',
      args: [String(settlement.paidBy)]
    });
    const payerUserId = memCheck.rows.length > 0 && memCheck.rows[0].userId 
      ? String(memCheck.rows[0].userId) 
      : String(settlement.paidBy);

    if (String(payerUserId) !== String(loggedUser.id)) {
      throw new Error("Permission Denied: Only the debtor can settle and pay their own debt.");
    }
  }

  const id = settlement.id || `stl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  await tursoClient.execute({
    sql: `INSERT INTO settlements (id, groupId, paidBy, paidTo, payerName, payeeName, amount, date, paymentMethod, trxId, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    args: [
      id,
      String(settlement.groupId || '1'),
      String(settlement.paidBy),
      String(settlement.paidTo),
      settlement.payerName || null,
      settlement.payeeName || null,
      Number(settlement.amount),
      Number(settlement.date || Date.now()),
      settlement.paymentMethod || 'Cash',
      settlement.trxId || null,
      settlement.notes || null
    ]
  });

  // Notify payee about recorded settlement
  try {
    let payeeUserId = null;
    const payeeCheck = await tursoClient.execute({
      sql: 'SELECT userId FROM members WHERE id = ? LIMIT 1;',
      args: [String(settlement.paidTo)]
    });
    if (payeeCheck.rows.length > 0 && payeeCheck.rows[0].userId) {
      payeeUserId = String(payeeCheck.rows[0].userId);
    } else {
      const userCheck = await tursoClient.execute({
        sql: 'SELECT id FROM users WHERE id = ? LIMIT 1;',
        args: [String(settlement.paidTo)]
      });
      if (userCheck.rows.length > 0) payeeUserId = String(userCheck.rows[0].id);
    }

    if (payeeUserId) {
      const payerName = settlement.payerName || (tursoGetCurrentUser()?.name) || 'A member';
      const gid = String(settlement.groupId || '1');
      const grpRes = await tursoClient.execute({
        sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
        args: [gid]
      });
      const groupName = grpRes.rows.length > 0 ? String(grpRes.rows[0].name) : 'Group';

      await tursoCreateNotification({
        userId: payeeUserId,
        type: 'SETTLEMENT_RECORDED',
        title: `Settlement Received • ${groupName}`,
        message: `${payerName} recorded a payment of ৳${Number(settlement.amount).toLocaleString()} to you via ${settlement.paymentMethod || 'Cash'}.`,
        data: {
          groupId: gid,
          groupName,
          settlementId: id,
          amount: Number(settlement.amount),
          payerName
        }
      });
    }
  } catch (err) {
    console.warn("Notice: could not dispatch settlement notification:", err);
  }

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

export async function tursoUpdateSettlement(settlementId, fields = {}) {
  if (!tursoClient || !settlementId) return;
  await initTursoTables();

  const setClauses = [];
  const args = [];

  if (fields.amount !== undefined) {
    setClauses.push('amount = ?');
    args.push(Number(fields.amount));
  }
  if (fields.date !== undefined) {
    setClauses.push('date = ?');
    args.push(Number(fields.date));
  }
  if (fields.paymentMethod !== undefined) {
    setClauses.push('paymentMethod = ?');
    args.push(fields.paymentMethod);
  }
  if (fields.trxId !== undefined) {
    setClauses.push('trxId = ?');
    args.push(fields.trxId ? fields.trxId.trim() : null);
  }
  if (fields.paidBy !== undefined) {
    setClauses.push('paidBy = ?');
    args.push(String(fields.paidBy));
  }
  if (fields.paidTo !== undefined) {
    setClauses.push('paidTo = ?');
    args.push(String(fields.paidTo));
  }
  if (fields.payerName !== undefined) {
    setClauses.push('payerName = ?');
    args.push(fields.payerName ? String(fields.payerName) : null);
  }
  if (fields.payeeName !== undefined) {
    setClauses.push('payeeName = ?');
    args.push(fields.payeeName ? String(fields.payeeName) : null);
  }
  if (fields.notes !== undefined) {
    setClauses.push('notes = ?');
    args.push(fields.notes ? String(fields.notes) : null);
  }

  if (setClauses.length === 0) return;

  args.push(String(settlementId));
  await tursoClient.execute({
    sql: `UPDATE settlements SET ${setClauses.join(', ')} WHERE id = ?;`,
    args
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

// ----------------- Notification & Approval Operations -----------------

export async function tursoCreateNotification({ userId, type, title, message, data = {} }) {
  if (!tursoClient || !userId) return null;
  await initTursoTables();

  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = Date.now();
  const dataJson = typeof data === 'string' ? data : JSON.stringify(data);

  try {
    await tursoClient.execute({
      sql: 'INSERT INTO notifications (id, userId, type, title, message, data, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?);',
      args: [id, String(userId), String(type), String(title), String(message), dataJson, 'UNREAD', now]
    });
    return { id, userId, type, title, message, data, status: 'UNREAD', createdAt: now };
  } catch (err) {
    console.warn("Could not insert notification:", err);
    return null;
  }
}

export async function tursoGetNotifications(userId) {
  if (!tursoClient || !userId) return [];
  await initTursoTables();

  try {
    const res = await tursoClient.execute({
      sql: 'SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50;',
      args: [String(userId)]
    });

    return res.rows.map(row => {
      let parsedData = {};
      try {
        parsedData = row.data ? JSON.parse(String(row.data)) : {};
      } catch (_) {}
      return {
        id: String(row.id),
        userId: String(row.userId),
        type: String(row.type),
        title: String(row.title),
        message: String(row.message),
        data: parsedData,
        status: String(row.status || 'UNREAD'),
        createdAt: Number(row.createdAt)
      };
    });
  } catch (err) {
    console.warn("Error fetching notifications:", err);
    return [];
  }
}

export async function tursoMarkNotificationAsRead(notifId) {
  if (!tursoClient || !notifId) return;
  await initTursoTables();
  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "READ" WHERE id = ? AND status = "UNREAD";',
      args: [String(notifId)]
    });
  } catch (_) {}
}

export async function tursoMarkAllNotificationsAsRead(userId) {
  if (!tursoClient || !userId) return;
  await initTursoTables();
  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "READ" WHERE userId = ? AND status = "UNREAD";',
      args: [String(userId)]
    });
  } catch (_) {}
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
  const groupName = String(groupRow.name);
  const createdBy = String(groupRow.createdBy || '');

  // 1. Check if user is the creator
  if (currentUser.id === createdBy || currentUser.name === createdBy) {
    return {
      id: groupId,
      name: groupName,
      joinCode: code,
      alreadyMember: true,
      isCreator: true
    };
  }

  // 2. Check if member already exists in group
  const existing = await tursoClient.execute({
    sql: 'SELECT id FROM members WHERE groupId = ? AND (userId = ? OR (email IS NOT NULL AND LOWER(email) = ?));',
    args: [groupId, currentUser.id, (currentUser.email || '').toLowerCase().trim()]
  });

  if (existing.rows.length > 0) {
    return {
      id: groupId,
      name: groupName,
      joinCode: code,
      alreadyMember: true
    };
  }

  // 3. Check if user already has a pending join request
  const pendingReq = await tursoClient.execute({
    sql: 'SELECT id, status FROM group_requests WHERE groupId = ? AND userId = ? AND type = "JOIN_REQUEST" AND status = "PENDING" LIMIT 1;',
    args: [groupId, String(currentUser.id)]
  });

  if (pendingReq.rows.length > 0) {
    return {
      id: groupId,
      name: groupName,
      joinCode: code,
      status: 'PENDING_APPROVAL',
      alreadyRequested: true,
      message: `Your request to join "${groupName}" is already pending admin approval.`
    };
  }

  // 4. Create Join Request needing Admin approval!
  const requestId = `greq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  await tursoClient.execute({
    sql: 'INSERT INTO group_requests (id, groupId, userId, type, status, createdById, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);',
    args: [requestId, groupId, String(currentUser.id), 'JOIN_REQUEST', 'PENDING', String(currentUser.id), now]
  });

  // 5. Notify the Group Creator / Admin!
  let adminUserId = createdBy;
  const adminCheck = await tursoClient.execute({
    sql: 'SELECT id FROM users WHERE id = ? OR name = ? OR LOWER(email) = ? LIMIT 1;',
    args: [createdBy, createdBy, createdBy.toLowerCase()]
  });
  if (adminCheck.rows.length > 0) {
    adminUserId = String(adminCheck.rows[0].id);
  }

  if (adminUserId) {
    const requesterTag = currentUser.username ? `@${currentUser.username.replace(/^@/, '')}` : currentUser.name;
    await tursoCreateNotification({
      userId: adminUserId,
      type: 'JOIN_REQUEST',
      title: `Join Request • ${groupName}`,
      message: `${requesterTag} requested to join "${groupName}" via code/QR.`,
      data: {
        requestId,
        groupId,
        groupName,
        requesterId: String(currentUser.id),
        requesterName: currentUser.name,
        requesterUsername: currentUser.username || ''
      }
    });
  }

  return {
    id: groupId,
    name: groupName,
    joinCode: code,
    status: 'PENDING_APPROVAL',
    alreadyMember: false,
    message: `Join request sent! The group admin will review and approve your request.`
  };
}

export async function tursoApproveJoinRequest(requestId, adminUser) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const reqCheck = await tursoClient.execute({
    sql: 'SELECT * FROM group_requests WHERE id = ? LIMIT 1;',
    args: [String(requestId)]
  });

  if (reqCheck.rows.length === 0) {
    throw new Error("Join request not found.");
  }

  const req = reqCheck.rows[0];
  const groupId = String(req.groupId);
  const targetUserId = String(req.userId);

  // Get target user details
  const targetUserCheck = await tursoClient.execute({
    sql: 'SELECT id, name, email, bkashNumber, nagadNumber, rocketNumber, username, avatar FROM users WHERE id = ? LIMIT 1;',
    args: [targetUserId]
  });

  if (targetUserCheck.rows.length === 0) {
    throw new Error("User account not found.");
  }

  const targetUser = targetUserCheck.rows[0];
  const groupRes = await tursoClient.execute({
    sql: 'SELECT name, createdBy FROM groups WHERE id = ? LIMIT 1;',
    args: [groupId]
  });
  const groupName = groupRes.rows.length > 0 ? String(groupRes.rows[0].name) : 'Group';

  // Check if already in group
  const memCheck = await tursoClient.execute({
    sql: 'SELECT id FROM members WHERE groupId = ? AND (userId = ? OR (email IS NOT NULL AND LOWER(email) = ?));',
    args: [groupId, targetUserId, (targetUser.email || '').toLowerCase()]
  });

  if (memCheck.rows.length === 0) {
    const memId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const phone = targetUser.bkashNumber || targetUser.nagadNumber || targetUser.rocketNumber || null;
    await tursoClient.execute({
      sql: 'INSERT INTO members (id, name, email, phone, groupId, userId) VALUES (?, ?, ?, ?, ?, ?);',
      args: [memId, String(targetUser.name), targetUser.email ? String(targetUser.email).toLowerCase() : null, phone, groupId, targetUserId]
    });
  }

  // Update request status to APPROVED
  await tursoClient.execute({
    sql: 'UPDATE group_requests SET status = "APPROVED" WHERE id = ?;',
    args: [String(requestId)]
  });

  // Mark notification as RESOLVED
  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "RESOLVED" WHERE json_extract(data, "$.requestId") = ?;',
      args: [String(requestId)]
    });
  } catch (_) {}

  // Send notification to the approved user
  await tursoCreateNotification({
    userId: targetUserId,
    type: 'JOIN_APPROVED',
    title: `Approved to Join "${groupName}"!`,
    message: `Your request to join "${groupName}" was approved. You can now track and share expenses!`,
    data: { groupId, groupName }
  });

  return { success: true, groupId, groupName };
}

export async function tursoDeclineJoinRequest(requestId, adminUser) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const reqCheck = await tursoClient.execute({
    sql: 'SELECT * FROM group_requests WHERE id = ? LIMIT 1;',
    args: [String(requestId)]
  });

  if (reqCheck.rows.length === 0) {
    throw new Error("Join request not found.");
  }

  const req = reqCheck.rows[0];
  const groupId = String(req.groupId);
  const targetUserId = String(req.userId);

  const groupRes = await tursoClient.execute({
    sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
    args: [groupId]
  });
  const groupName = groupRes.rows.length > 0 ? String(groupRes.rows[0].name) : 'Group';

  await tursoClient.execute({
    sql: 'UPDATE group_requests SET status = "DECLINED" WHERE id = ?;',
    args: [String(requestId)]
  });

  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "DECLINED" WHERE json_extract(data, "$.requestId") = ?;',
      args: [String(requestId)]
    });
  } catch (_) {}

  await tursoCreateNotification({
    userId: targetUserId,
    type: 'JOIN_DECLINED',
    title: `Join Request Declined`,
    message: `Your request to join "${groupName}" was declined by the admin.`,
    data: { groupId, groupName }
  });

  return { success: true, groupId, groupName };
}

export async function tursoInviteUserToGroup(groupId, targetUserId, inviterUser) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const groupRes = await tursoClient.execute({
    sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
    args: [String(groupId)]
  });
  if (groupRes.rows.length === 0) throw new Error("Group not found.");
  const groupName = String(groupRes.rows[0].name);

  // Check if target user is already a member
  const memCheck = await tursoClient.execute({
    sql: 'SELECT id FROM members WHERE groupId = ? AND userId = ? LIMIT 1;',
    args: [String(groupId), String(targetUserId)]
  });
  if (memCheck.rows.length > 0) {
    throw new Error("This user is already a member of this group.");
  }

  // Check if invitation already pending
  const pendingCheck = await tursoClient.execute({
    sql: 'SELECT id FROM group_requests WHERE groupId = ? AND userId = ? AND type = "INVITATION" AND status = "PENDING" LIMIT 1;',
    args: [String(groupId), String(targetUserId)]
  });
  if (pendingCheck.rows.length > 0) {
    throw new Error("An invitation has already been sent to this user and is awaiting their acceptance.");
  }

  const requestId = `greq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = Date.now();

  await tursoClient.execute({
    sql: 'INSERT INTO group_requests (id, groupId, userId, type, status, createdById, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?);',
    args: [requestId, String(groupId), String(targetUserId), 'INVITATION', 'PENDING', String(inviterUser.id), now]
  });

  const inviterTag = inviterUser.username ? `@${inviterUser.username.replace(/^@/, '')}` : inviterUser.name;
  await tursoCreateNotification({
    userId: String(targetUserId),
    type: 'GROUP_INVITATION',
    title: `Group Invitation • ${groupName}`,
    message: `${inviterTag} invited you to join "${groupName}".`,
    data: {
      requestId,
      groupId: String(groupId),
      groupName,
      inviterId: String(inviterUser.id),
      inviterName: inviterUser.name,
      inviterUsername: inviterUser.username || ''
    }
  });

  return { success: true, requestId, groupName, message: `Invitation sent! The user can accept or decline from their notifications.` };
}

export async function tursoAcceptGroupInvitation(requestId, currentUser) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const reqCheck = await tursoClient.execute({
    sql: 'SELECT * FROM group_requests WHERE id = ? LIMIT 1;',
    args: [String(requestId)]
  });

  if (reqCheck.rows.length === 0) throw new Error("Invitation not found.");
  const req = reqCheck.rows[0];
  const groupId = String(req.groupId);
  const inviterId = String(req.createdById);

  const groupRes = await tursoClient.execute({
    sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
    args: [groupId]
  });
  const groupName = groupRes.rows.length > 0 ? String(groupRes.rows[0].name) : 'Group';

  // Add member
  const memCheck = await tursoClient.execute({
    sql: 'SELECT id FROM members WHERE groupId = ? AND (userId = ? OR (email IS NOT NULL AND LOWER(email) = ?));',
    args: [groupId, String(currentUser.id), (currentUser.email || '').toLowerCase()]
  });

  if (memCheck.rows.length === 0) {
    const memId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const phone = currentUser.bkashNumber || currentUser.nagadNumber || currentUser.rocketNumber || null;
    await tursoClient.execute({
      sql: 'INSERT INTO members (id, name, email, phone, groupId, userId) VALUES (?, ?, ?, ?, ?, ?);',
      args: [memId, String(currentUser.name), currentUser.email ? String(currentUser.email).toLowerCase() : null, phone, groupId, String(currentUser.id)]
    });
  }

  await tursoClient.execute({
    sql: 'UPDATE group_requests SET status = "ACCEPTED" WHERE id = ?;',
    args: [String(requestId)]
  });

  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "RESOLVED" WHERE json_extract(data, "$.requestId") = ?;',
      args: [String(requestId)]
    });
  } catch (_) {}

  // Notify inviter
  const userTag = currentUser.username ? `@${currentUser.username.replace(/^@/, '')}` : currentUser.name;
  await tursoCreateNotification({
    userId: inviterId,
    type: 'INVITATION_ACCEPTED',
    title: `Invitation Accepted!`,
    message: `${userTag} accepted your invitation to join "${groupName}".`,
    data: { groupId, groupName, userId: currentUser.id }
  });

  return { success: true, groupId, groupName };
}

export async function tursoDeclineGroupInvitation(requestId, currentUser) {
  if (!tursoClient) throw new Error("Turso client is not initialized.");
  await initTursoTables();

  const reqCheck = await tursoClient.execute({
    sql: 'SELECT * FROM group_requests WHERE id = ? LIMIT 1;',
    args: [String(requestId)]
  });

  if (reqCheck.rows.length === 0) throw new Error("Invitation not found.");
  const req = reqCheck.rows[0];
  const groupId = String(req.groupId);
  const inviterId = String(req.createdById);

  const groupRes = await tursoClient.execute({
    sql: 'SELECT name FROM groups WHERE id = ? LIMIT 1;',
    args: [groupId]
  });
  const groupName = groupRes.rows.length > 0 ? String(groupRes.rows[0].name) : 'Group';

  await tursoClient.execute({
    sql: 'UPDATE group_requests SET status = "DECLINED" WHERE id = ?;',
    args: [String(requestId)]
  });

  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "DECLINED" WHERE json_extract(data, "$.requestId") = ?;',
      args: [String(requestId)]
    });
  } catch (_) {}

  const userTag = currentUser.username ? `@${currentUser.username.replace(/^@/, '')}` : currentUser.name;
  await tursoCreateNotification({
    userId: inviterId,
    type: 'INVITATION_DECLINED',
    title: `Invitation Declined`,
    message: `${userTag} declined your invitation to join "${groupName}".`,
    data: { groupId, groupName }
  });

  return { success: true, groupId, groupName };
}

export async function tursoCancelGroupRequest(requestId) {
  if (!tursoClient || !requestId) return;
  await initTursoTables();
  await tursoClient.execute({
    sql: 'UPDATE group_requests SET status = "CANCELLED" WHERE id = ?;',
    args: [String(requestId)]
  });
  try {
    await tursoClient.execute({
      sql: 'UPDATE notifications SET status = "CANCELLED" WHERE json_extract(data, "$.requestId") = ?;',
      args: [String(requestId)]
    });
  } catch (_) {}
}

export async function tursoGetGroupPendingRequests(groupId) {
  if (!tursoClient || !groupId) return { joinRequests: [], invitations: [] };
  await initTursoTables();

  try {
    const res = await tursoClient.execute({
      sql: `SELECT gr.*, u.name, u.username, u.email, u.avatar 
            FROM group_requests gr
            LEFT JOIN users u ON gr.userId = u.id
            WHERE gr.groupId = ? AND gr.status = "PENDING"
            ORDER BY gr.createdAt DESC;`,
      args: [String(groupId)]
    });

    const joinRequests = [];
    const invitations = [];

    for (const row of res.rows) {
      const item = {
        id: String(row.id),
        groupId: String(row.groupId),
        userId: String(row.userId),
        type: String(row.type),
        status: String(row.status),
        createdById: String(row.createdById),
        createdAt: Number(row.createdAt),
        userName: String(row.name || 'User'),
        username: row.username ? String(row.username).replace(/^@/, '') : '',
        email: row.email ? String(row.email) : '',
        avatar: row.avatar ? String(row.avatar) : ''
      };
      if (item.type === 'JOIN_REQUEST') joinRequests.push(item);
      else invitations.push(item);
    }

    return { joinRequests, invitations };
  } catch (err) {
    console.warn("Could not query group_requests:", err);
    return { joinRequests: [], invitations: [] };
  }
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
    sql: 'SELECT id, name, email, username, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE email = ? LIMIT 1;',
    args: [email]
  });

  let user;
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    let username = row.username ? String(row.username).replace(/^@/, '') : email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!row.username) {
      try {
        await tursoClient.execute({
          sql: 'UPDATE users SET username = ? WHERE email = ?;',
          args: [username, email]
        });
      } catch (_) {}
    }
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
      username,
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
    let cleanUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!cleanUsername || cleanUsername.length < 3) cleanUsername = `user_${Math.random().toString(36).substring(2, 6)}`;

    // Check username uniqueness in a loop to ensure 100% collision-free username
    let attempts = 0;
    while (attempts < 15) {
      const taken = await tursoClient.execute({
        sql: 'SELECT id FROM users WHERE LOWER(username) = ? LIMIT 1;',
        args: [cleanUsername]
      });
      if (taken.rows.length === 0) break;
      cleanUsername = `${email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')}_${Math.random().toString(36).substring(2, 6)}`;
      attempts++;
    }

    try {
      await tursoClient.execute({
        sql: 'INSERT INTO users (id, name, email, password, shortProfile, username, avatar, createdAt, primaryMfs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
        args: [userId, name, email, `google_oauth_${googleId}`, 'Google Account', cleanUsername, avatar, now, 'BKASH']
      });
    } catch (insertErr) {
      if (insertErr.message?.includes('UNIQUE constraint failed') || insertErr.message?.includes('idx_users_username_unique')) {
        cleanUsername = `user_${Math.random().toString(36).substring(2, 8)}`;
        await tursoClient.execute({
          sql: 'INSERT INTO users (id, name, email, password, shortProfile, username, avatar, createdAt, primaryMfs) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);',
          args: [userId, name, email, `google_oauth_${googleId}`, 'Google Account', cleanUsername, avatar, now, 'BKASH']
        });
      } else {
        throw insertErr;
      }
    }

    user = {
      id: userId,
      name,
      email,
      username: cleanUsername,
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

export async function tursoUpdateUserProfile(userId, { name, username, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs }) {
  const current = tursoGetCurrentUser() || {};
  const trimmedName = (name !== undefined ? name : current.name || '').trim();
  const trimmedProfile = (shortProfile !== undefined ? shortProfile : current.shortProfile || '').trim();
  const updatedAvatar = avatar !== undefined ? avatar : (current.avatar || '');
  const updatedBkash = bkashNumber !== undefined ? bkashNumber.trim() : (current.bkashNumber || '');
  const updatedNagad = nagadNumber !== undefined ? nagadNumber.trim() : (current.nagadNumber || '');
  const updatedRocket = rocketNumber !== undefined ? rocketNumber.trim() : (current.rocketNumber || '');
  const updatedPrimaryMfs = primaryMfs !== undefined ? primaryMfs : (current.primaryMfs || 'BKASH');

  let updatedUsername = current.username || (current.email ? current.email.split('@')[0] : 'user');
  if (username !== undefined) {
    const cleanUser = username.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,30}$/.test(cleanUser)) {
      throw new Error("Username must be 3-30 characters containing only letters, numbers, and underscores.");
    }
    if (tursoClient) {
      const taken = await tursoClient.execute({
        sql: 'SELECT id FROM users WHERE LOWER(username) = ? AND id != ? LIMIT 1;',
        args: [cleanUser, String(userId)]
      });
      if (taken.rows.length > 0) {
        throw new Error(`The username @${cleanUser} is already taken. Please choose another.`);
      }
    }
    updatedUsername = cleanUser;
  }

  if (!tursoClient) {
    // Offline / local fallback
    const updated = {
      ...current,
      name: trimmedName,
      username: updatedUsername,
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

  try {
    await tursoClient.execute({
      sql: 'UPDATE users SET name = ?, username = ?, shortProfile = ?, avatar = ?, bkashNumber = ?, nagadNumber = ?, rocketNumber = ?, primaryMfs = ? WHERE id = ?;',
      args: [
        trimmedName,
        updatedUsername,
        trimmedProfile, 
        updatedAvatar, 
        updatedBkash, 
        updatedNagad, 
        updatedRocket, 
        updatedPrimaryMfs, 
        String(userId)
      ]
    });
  } catch (updateErr) {
    if (updateErr.message?.includes('UNIQUE constraint failed') || updateErr.message?.includes('idx_users_username_unique')) {
      throw new Error(`The username @${updatedUsername} is already taken. Please choose another.`);
    }
    throw updateErr;
  }

  try {
    await tursoClient.execute({
      sql: 'UPDATE members SET name = ? WHERE userId = ? OR id = ?;',
      args: [trimmedName, String(userId), String(userId)]
    });
  } catch (_) {}

  const updated = {
    ...current,
    name: trimmedName || current.name,
    username: updatedUsername,
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
        sql: 'SELECT id, name, email, username, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE id = ? LIMIT 1;',
        args: [String(userId)]
      });
    }
    if ((!result || result.rows.length === 0) && email) {
      result = await tursoClient.execute({
        sql: 'SELECT id, name, email, username, shortProfile, avatar, bkashNumber, nagadNumber, rocketNumber, primaryMfs FROM users WHERE email = ? LIMIT 1;',
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
        username: row.username ? String(row.username).replace(/^@/, '') : String(row.email).split('@')[0],
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
