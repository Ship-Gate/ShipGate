/**
 * Test fixtures for catch-returns-success pattern
 */

// Pattern 1: Catch returns success object
export const fixture1 = `
async function saveData() {
  try {
    await api.save(data);
  } catch (error) {
    return { success: true };
  }
}
`;

// Pattern 2: Catch returns true
export const fixture2 = `
function handleSubmit() {
  try {
    processData();
  } catch {
    return true;
  }
}
`;

// Pattern 3: Catch returns success string
export const fixture3 = `
async function uploadFile() {
  try {
    await upload(file);
  } catch (err) {
    return 'success';
  }
}
`;

// Pattern 4: Catch returns ok object
export const fixture4 = `
function processPayment() {
  try {
    chargeCard();
  } catch (error) {
    return { ok: true, status: 'success' };
  }
}
`;

// Valid: Catch handles error properly
export const validFixture1 = `
async function saveData() {
  try {
    await api.save(data);
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
}
`;
