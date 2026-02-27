/**
 * Should NOT flag: Real user data from database
 */
const users = await db.query('SELECT * FROM users WHERE active = true');
return users.map(u => ({ id: u.id, name: u.name, email: u.email }));
