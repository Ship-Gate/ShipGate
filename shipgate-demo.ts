/**
 * ShipGate Demo - Ghost Route Detection
 * 
 * This file demonstrates how Shield blocks hallucinated API routes.
 * The route below doesn't exist in your truthpack.
 */

// 🛑 This route will be BLOCKED because it doesn't exist
fetch('/api/users/me')
  .then(res => res.json())
  .then(data => console.log(data));

// ✅ Suggested fix: Use an existing route from your truthpack
// or run 'shipgate scan' to update your truthpack
